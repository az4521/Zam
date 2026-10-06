/**
 * Push notification integration for Android. Two transports:
 *   - FCM via Capacitor, delivered through a Sygnal push gateway;
 *   - UnifiedPush via a distributor app the user picks (ntfy, NextPush, ...),
 *     delivered through a Matrix gateway paired with the distributor's
 *     endpoint (see unifiedPush.ts). No Google services needed.
 *
 * On startup (after login), call initPush(). It will:
 *   1. Request notification permission
 *   2. Pick the transport (Settings → Notifications → Push service)
 *   3. Get the FCM token / UnifiedPush endpoint
 *   4. Register a Matrix pusher with the homeserver pointing at the gateway
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import {
    checkPusherGateway,
    mergeGatewayStatus,
    type PusherGatewayStatus,
} from "$lib/utils/pusherVerification";
import { WEBPUSH_APP_ID } from "$lib/webPush";
import { navigateToRoom } from "$lib/stores/rooms.svelte";
import {
    getPushProviderPref,
    getUnifiedPushStatus,
    onUnifiedPushEvents,
    registerUnifiedPush,
    resolvePushProvider,
    setPushProviderPref,
    unregisterUnifiedPush,
    type PushProviderPref,
    type UnifiedPushStatus,
} from "$lib/unifiedPush";

// URL of your Sygnal push gateway's notify endpoint, e.g.
//   https://sygnal.example.com/_matrix/push/v1/notify
// Set at build time via the VITE_PUSH_GATEWAY_URL env var, or edit the fallback
// below. The example placeholder counts as "not configured".
//
// Sygnal is the standard Matrix push gateway (https://github.com/matrix-org/sygnal);
// configure an `apps` entry with type `gcm`/`fcm_v1`, app_id `moe.crafty.matrix`,
// and your Firebase credentials there.
const PUSH_GATEWAY_URL =
    (import.meta.env as Record<string, string | undefined>)
        .VITE_PUSH_GATEWAY_URL ||
    "https://sygnal.crafty.moe/_matrix/push/v1/notify";

// Must match the app_id configured for this app in Sygnal. UnifiedPush pushers
// use it too: Matrix gateways for UnifiedPush ignore the app_id.
const APP_ID = "moe.crafty.matrix";

// FCM push is only attempted when a real gateway is configured. Builds shipped
// WITHOUT a Firebase google-services.json are caught natively instead
// (UnifiedPushPlugin.fcmAvailable): calling into FCM with no Firebase config
// throws ("Default FirebaseApp is not initialized"). UnifiedPush needs neither
// and is gated on neither.
const PUSH_ENABLED = !PUSH_GATEWAY_URL.includes("sygnal.example.com");

let pushInitialised = false;

// Which transport this session's pusher went through, so teardown undoes the
// right one. null until initPush picked one.
let activeProvider: "fcm" | "unifiedpush" | null = null;
let stopUnifiedPushEvents: (() => Promise<void>) | null = null;

// The pushkey (FCM token or UnifiedPush endpoint) we actually registered this
// run. Kept so unregister can delete the RIGHT pusher — deleting with an empty
// pushkey is a no-op (or, worse, matches nothing) and leaves a stale pusher
// pointing at the gateway.
let registeredPushkey: string | null = null;
// The gateway that pushkey was registered against, so an endpoint event that
// changes nothing doesn't re-register.
let registeredGateway: string | null = null;

// ── Diagnostics ────────────────────────────────────────────────────────────
// Live snapshot of what push setup did this session, surfaced in Settings →
// Debug Info so push can be diagnosed on devices with no dev console.

export interface PushDebugState {
    native: boolean;
    gatewayUrl: string;
    pushEnabled: boolean;
    permission: string; // "granted" | "denied" | "prompt" | "unknown"
    fcmToken: string | null;
    pusherRegistered: boolean;
    lastError: string | null;
    // Set when the homeserver reports our pusher routing to a gateway other
    // than the one we asked for (SEC-L4). Not a registration failure, so kept
    // separate from lastError.
    gatewayWarning: string | null;
    /** The transport initPush picked: "fcm" | "unifiedpush" | "none". */
    provider: string | null;
    upDistributor: string | null;
    upEndpoint: string | null;
    /** The Matrix gateway paired with upEndpoint. */
    upGateway: string | null;
}

export const pushDebug: PushDebugState = {
    native: Capacitor.isNativePlatform(),
    gatewayUrl: PUSH_GATEWAY_URL,
    pushEnabled: PUSH_ENABLED,
    permission: "unknown",
    fcmToken: null,
    pusherRegistered: false,
    lastError: null,
    gatewayWarning: null,
    provider: null,
    upDistributor: null,
    upEndpoint: null,
    upGateway: null,
};

export async function initPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (pushInitialised) return;
    pushInitialised = true;

    // Everything below touches native push stacks; guard the whole thing so a
    // missing/broken config can never crash the app — it just disables push.
    try {
        // Request permission. These calls only touch POST_NOTIFICATIONS, not
        // Firebase, so they are safe whichever transport ends up in use.
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt") {
            permission = await PushNotifications.requestPermissions();
        }
        pushDebug.permission = permission.receive;
        if (permission.receive !== "granted") {
            // Not latched: granting later from Settings re-runs this.
            pushInitialised = false;
            pushDebug.lastError = "Notification permission not granted";
            console.warn("[push] Notification permission denied");
            return;
        }

        const status = await getUnifiedPushStatus();
        const provider = resolvePushProvider(
            getPushProviderPref(),
            status,
            PUSH_ENABLED,
        );
        pushDebug.provider = provider.kind;
        if (provider.kind === "unifiedpush") {
            await initUnifiedPush(matrixClient, provider.distributor, status);
        } else if (provider.kind === "fcm") {
            await initFcm(matrixClient);
        } else {
            // Not latched either: after installing a distributor, picking it
            // in Settings retries.
            pushInitialised = false;
            pushDebug.lastError =
                "No push service available: FCM can't run on this device/build and no UnifiedPush distributor is selected";
            console.info("[push] No push transport available - push disabled.");
        }
    } catch (err) {
        pushInitialised = false;
        activeProvider = null;
        pushDebug.lastError = "Push init failed: " + String(err);
        console.warn("[push] Push init failed - continuing without push.", err);
    }
}

async function initFcm(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    activeProvider = "fcm";

    PushNotifications.addListener("registration", async (token: Token) => {
        // Never log the token itself: it's a long-lived device-correlating
        // credential, and anything on the console is reachable through adb,
        // remote debugging and crash reporters. Settings → Debug Info shows
        // a truncated form when a human actually needs to compare it.
        console.log("[push] FCM registration received");
        pushDebug.fcmToken = token.value;
        await registerPusher(matrixClient, token.value, PUSH_GATEWAY_URL);
    });

    PushNotifications.addListener("registrationError", (err) => {
        pushDebug.lastError = "FCM registration error: " + JSON.stringify(err);
        console.error("[push] Registration error:", err);
    });

    // Foreground notifications: the OS won't show them automatically, so we
    // could show an in-app toast here if desired. For now just note that one
    // arrived — the payload carries room/sender/message metadata and must
    // not reach the console.
    PushNotifications.addListener("pushNotificationReceived", () => {
        console.log("[push] Foreground notification received");
    });

    // User tapped a notification
    PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
            const roomId = action.notification.data?.room_id;
            // event_id_only FCM data carries the event; thread it so the tap
            // jumps to the exact message, not just the room.
            const eventId = action.notification.data?.event_id;
            if (roomId) {
                // Navigate to the room (switching space if needed).
                navigateToRoom(roomId, eventId);
            }
        },
    );

    // Register with FCM last — triggers the 'registration' event with the
    // token. Throws if Firebase isn't configured (caught in initPush).
    await PushNotifications.register();
}

/**
 * UnifiedPush: the distributor hands us an endpoint URL, which becomes the
 * pushkey, and the homeserver POSTs to the Matrix gateway paired with it
 * (discovered natively, see UnifiedPushService.discoverGateway). The
 * notifications are posted by the same native code as FCM ones, so taps,
 * replies and mark-as-read go through MainActivity as before.
 */
async function initUnifiedPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    distributor: string,
    status: UnifiedPushStatus,
): Promise<void> {
    activeProvider = "unifiedpush";
    pushDebug.upDistributor = distributor;

    stopUnifiedPushEvents = await onUnifiedPushEvents({
        onEndpoint: ({ endpoint, gateway }) => {
            console.log("[push] UnifiedPush endpoint received");
            pushDebug.upEndpoint = endpoint;
            pushDebug.upGateway = gateway;
            void registerPusher(matrixClient, endpoint, gateway);
        },
        onUnregistered: () => {
            pushDebug.upEndpoint = null;
            pushDebug.upGateway = null;
            pushDebug.lastError =
                "The UnifiedPush distributor dropped this app's registration";
            void deleteRegisteredPusher(matrixClient);
        },
        onFailed: (reason) => {
            pushDebug.lastError = "UnifiedPush registration failed: " + reason;
            console.warn("[push] UnifiedPush registration failed:", reason);
        },
    });

    // An endpoint we already hold (possibly delivered while the app was not
    // running): register it now rather than waiting on the distributor.
    if (
        status.endpoint &&
        status.gateway &&
        status.savedDistributor === distributor
    ) {
        pushDebug.upEndpoint = status.endpoint;
        pushDebug.upGateway = status.gateway;
        await registerPusher(matrixClient, status.endpoint, status.gateway);
    }

    // Re-register on every start, as the UnifiedPush spec asks: it is how a
    // distributor that lost its state gets us back. An unchanged endpoint
    // makes registerPusher a no-op.
    await registerUnifiedPush(distributor);
}

async function registerPusher(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    pushkey: string,
    gatewayUrl: string,
): Promise<void> {
    const deviceId = matrixClient.getDeviceId();
    const userId = matrixClient.getUserId();
    if (!deviceId || !userId) return;
    if (pushkey === registeredPushkey && gatewayUrl === registeredGateway)
        return;

    try {
        await (matrixClient as any).setPusher({
            kind: "http",
            app_id: APP_ID,
            app_display_name: "Zam",
            device_display_name: `Android (${deviceId})`,
            pushkey,
            lang: navigator.language || "en",
            data: {
                url: gatewayUrl,
                format: "event_id_only",
                // Names the account in every push: several accounts on this
                // device share the pushkey, and the native service picks the
                // matching session by this (MatrixMessagingService.ACCOUNT_KEY).
                default_payload: { zam_account: userId },
            },
            // multi-account: false would delete other users' pushers for this token
            append: true,
        });
        registeredPushkey = pushkey;
        registeredGateway = gatewayUrl;
        pushDebug.pusherRegistered = true;
        console.log("[push] Pusher registered");
        await removeStaleDevicePushers(matrixClient, deviceId, pushkey);
        // Re-read the pushers the homeserver actually kept and warn if it
        // routed us somewhere other than our gateway (SEC-L4). Best-effort:
        // a verification failure must never undo a successful registration.
        try {
            const status = await verifyPushGateways(matrixClient);
            if (status.status === "mismatch") {
                const warning = `Push gateway mismatch: the homeserver routes this device's pushes to ${status.mismatchedUrls.join(
                    ", ",
                )} instead of ${gatewayUrl}`;
                pushDebug.gatewayWarning = warning;
                console.warn("[push] " + warning);
            } else {
                pushDebug.gatewayWarning = null;
            }
        } catch {
            /* verification is best-effort */
        }
    } catch (err) {
        pushDebug.pusherRegistered = false;
        pushDebug.lastError = "Failed to register pusher: " + String(err);
        console.error("[push] Failed to register pusher:", err);
    }
}

/**
 * Delete this device's OTHER pushers: the one a rotated FCM token or
 * UnifiedPush endpoint left behind, or the old transport's after a switch.
 * They are recognisable by the display name registerPusher gives them, which
 * carries the Matrix device id. Best-effort.
 */
async function removeStaleDevicePushers(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    deviceId: string,
    keep: string,
): Promise<void> {
    try {
        const res = await (matrixClient as any).getPushers();
        for (const p of (res?.pushers ?? []) as any[]) {
            if (
                p.app_id === APP_ID &&
                p.device_display_name === `Android (${deviceId})` &&
                typeof p.pushkey === "string" &&
                p.pushkey &&
                p.pushkey !== keep
            ) {
                await deletePusher(matrixClient, p.pushkey).catch(() => {});
            }
        }
    } catch {
        /* best-effort */
    }
}

function deletePusher(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    pushkey: string,
): Promise<unknown> {
    // Delete the pusher by setting kind to null. Must use the REAL pushkey we
    // registered — an empty one deletes nothing.
    return (matrixClient as any).setPusher({
        kind: null,
        app_id: APP_ID,
        pushkey,
        app_display_name: "",
        device_display_name: "",
        lang: "en",
        data: {},
    });
}

async function deleteRegisteredPusher(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!registeredPushkey) return;
    try {
        await deletePusher(matrixClient, registeredPushkey);
        registeredPushkey = null;
        registeredGateway = null;
        pushDebug.pusherRegistered = false;
    } catch {
        /* ignore */
    }
}

/** Stop whichever transport is running; the homeserver is left alone. */
async function stopTransport(): Promise<void> {
    if (activeProvider === "fcm") {
        await PushNotifications.removeAllListeners().catch(() => {});
    }
    if (stopUnifiedPushEvents) {
        await stopUnifiedPushEvents().catch(() => {});
        stopUnifiedPushEvents = null;
    }
    activeProvider = null;
    pushInitialised = false;
}

/**
 * Settings → Notifications → Push service. Removes this device's pusher,
 * drops the old transport (including the UnifiedPush registration, unless the
 * same distributor stays in use) and sets push up again with the new choice.
 */
export async function switchPushProvider(
    matrixClient: import("matrix-js-sdk").MatrixClient | null,
    pref: PushProviderPref,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const keepUnifiedPush =
        activeProvider === "unifiedpush" &&
        pref === `up:${pushDebug.upDistributor}`;
    setPushProviderPref(pref);
    if (matrixClient) await deleteRegisteredPusher(matrixClient);
    await stopTransport();
    if (!keepUnifiedPush) {
        await unregisterUnifiedPush();
        pushDebug.upDistributor = null;
        pushDebug.upEndpoint = null;
        pushDebug.upGateway = null;
    }
    pushDebug.provider = null;
    pushDebug.lastError = null;
    pushDebug.gatewayWarning = null;
    if (matrixClient) await initPush(matrixClient);
}

// The Android WebView has no Notification API, so the Settings permission row
// reads and requests the OS permission through the native plugin instead.
function toNotificationPermission(receive: string): NotificationPermission {
    if (receive === "granted" || receive === "denied") return receive;
    return "default";
}

export async function checkNativeNotificationPermission(): Promise<NotificationPermission> {
    try {
        const p = await PushNotifications.checkPermissions();
        return toNotificationPermission(p.receive);
    } catch {
        return "default";
    }
}

/** Ask for the OS permission, then (if granted) finish push setup that
 *  initPush skipped while it was missing. */
export async function requestNativeNotificationPermission(
    matrixClient: import("matrix-js-sdk").MatrixClient | null,
): Promise<NotificationPermission> {
    let receive: string;
    try {
        receive = (await PushNotifications.requestPermissions()).receive;
    } catch {
        return checkNativeNotificationPermission();
    }
    pushDebug.permission = receive;
    if (receive === "granted" && matrixClient) await initPush(matrixClient);
    return toNotificationPermission(receive);
}

export async function unregisterPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const deviceId = matrixClient.getDeviceId();
    if (!deviceId) return;

    // The UnifiedPush registration itself is kept: its endpoint is not tied
    // to an account, and the next login reuses it.
    await deleteRegisteredPusher(matrixClient);
    await stopTransport();
}

/**
 * Take every delivered Android notification down.
 *
 * On Android the notifications the user actually sees are posted by
 * MatrixMessagingService (native Java), so none of the page's own close
 * machinery can reach them — nothing in src/ could take a native notification
 * down before this. Capacitor's implementation is NotificationManager
 * .cancelAll(), which covers exactly those.
 *
 * Deliberately separate from unregisterPush: that one returns early when the
 * device id is missing, which has nothing to do with whether there are
 * notifications on screen.
 *
 * Synchronous and fire-and-forget on purpose: this is registered as a
 * notification surface, and the registry's try/catch cannot catch a rejected
 * promise — hence the .catch() here — while an awaited teardown call could
 * hang the way out of a session.
 */
export function clearDeliveredNativeNotifications(): void {
    if (!Capacitor.isNativePlatform()) return;
    PushNotifications.removeAllDeliveredNotifications().catch(() => {});
}

// ── Diagnostics queries (used by Settings → Debug Info) ─────────────────────

export interface RegisteredPusher {
    app_id: string;
    app_display_name?: string;
    device_display_name?: string;
    /** The gateway URL the homeserver will POST to (data.url). */
    url?: string;
    /** First/last few chars of the pushkey (FCM token) for identification. */
    pushkeyPreview: string;
}

/**
 * Ask the homeserver which pushers it has registered for this account. This is
 * the source of truth for "did we tell the homeserver about our gateway URL?".
 */
export async function fetchRegisteredPushers(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<RegisteredPusher[]> {
    const res = await (matrixClient as any).getPushers();
    const pushers = (res?.pushers ?? []) as any[];
    return pushers.map((p) => {
        const key: string = p.pushkey ?? "";
        const preview =
            key.length > 16 ? `${key.slice(0, 8)}…${key.slice(-6)}` : key;
        return {
            app_id: p.app_id,
            app_display_name: p.app_display_name,
            device_display_name: p.device_display_name,
            url: p.data?.url,
            pushkeyPreview: preview,
        };
    });
}

/**
 * Re-fetch this account's pushers and verify they route to our configured
 * gateway, covering both the FCM (Android) and webpush (browser) app ids
 * (SEC-L4). Used by Settings to show whether the homeserver honoured the
 * gateway URL we asked for. Never throws: a read failure yields a "none"
 * verdict so the caller can treat it as "nothing to report".
 *
 * UnifiedPush pushers (pushkey = the endpoint URL; an FCM token or webpush
 * key never is one) each route to the gateway paired with THEIR device's
 * distributor, which only that device knows. So this device's own is checked
 * against the gateway it registered, and other devices' are left out rather
 * than flagged as reroutes.
 */
export async function verifyPushGateways(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<PusherGatewayStatus> {
    try {
        const res = await (matrixClient as any).getPushers();
        const pushers = ((res?.pushers ?? []) as any[]).map((p) => ({
            app_id: p.app_id as string,
            url: p.data?.url as string | undefined,
            pushkey: typeof p.pushkey === "string" ? p.pushkey : "",
        }));
        const isUnifiedPush = (p: { app_id: string; pushkey: string }) =>
            p.app_id === APP_ID && /^https?:\/\//.test(p.pushkey);
        const sygnal = checkPusherGateway(
            PUSH_GATEWAY_URL,
            [APP_ID, WEBPUSH_APP_ID],
            pushers.filter((p) => !isUnifiedPush(p)),
        );
        const ownUp = pushers.filter(
            (p) => isUnifiedPush(p) && p.pushkey === pushDebug.upEndpoint,
        );
        if (!ownUp.length || !pushDebug.upGateway) return sygnal;
        return mergeGatewayStatus(
            sygnal,
            checkPusherGateway(pushDebug.upGateway, [APP_ID], ownUp),
        );
    } catch {
        return {
            status: "none",
            ours: 0,
            expectedUrl: PUSH_GATEWAY_URL,
            mismatchedUrls: [],
        };
    }
}

export interface GatewayHealth {
    reachable: boolean;
    status: number | null;
    detail: string;
}

/**
 * Probe the Sygnal gateway. Sygnal exposes GET /health (200 when the app/FCM
 * config loaded). We derive the base URL from the configured notify endpoint.
 */
export async function checkGatewayHealth(): Promise<GatewayHealth> {
    let healthUrl: string;
    try {
        const u = new URL(PUSH_GATEWAY_URL);
        healthUrl = `${u.origin}/health`;
    } catch {
        return {
            reachable: false,
            status: null,
            detail: "Invalid gateway URL",
        };
    }
    try {
        const res = await fetch(healthUrl, { method: "GET" });
        let body = "";
        try {
            body = (await res.text()).slice(0, 200);
        } catch {
            /* ignore */
        }
        return {
            reachable: res.ok,
            status: res.status,
            detail: res.ok
                ? body || "OK"
                : `HTTP ${res.status}${body ? `: ${body}` : ""}`,
        };
    } catch (err) {
        return {
            reachable: false,
            status: null,
            detail:
                "Unreachable: " +
                (err instanceof Error ? err.message : String(err)),
        };
    }
}

/** The configured gateway notify endpoint (for display). */
export const PUSH_GATEWAY_NOTIFY_URL = PUSH_GATEWAY_URL;
export const PUSH_APP_ID = APP_ID;
