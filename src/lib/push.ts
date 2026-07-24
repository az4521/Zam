/**
 * Push notification integration for Android via Capacitor + FCM, delivered
 * through a Sygnal push gateway.
 *
 * On startup (after login), call initPush(). It will:
 *   1. Request notification permission
 *   2. Get the FCM device token
 *   3. Register a Matrix pusher with the homeserver pointing at Sygnal
 *   4. Listen for foreground push notifications (background ones are shown by the OS)
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";

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

// Must match the app_id configured for this app in Sygnal.
const APP_ID = "moe.crafty.matrix";

// Push is only attempted when a real gateway is configured. This is also our
// guard against builds shipped WITHOUT a Firebase google-services.json: calling
// into FCM (PushNotifications.register) with no Firebase config throws natively
// ("Default FirebaseApp is not initialized"), so we simply don't touch it. The
// app then runs normally, just without push.
const PUSH_ENABLED = !PUSH_GATEWAY_URL.includes("sygnal.example.com");

let pushInitialised = false;

// The pushkey (FCM token) we actually registered this run. Kept so unregister
// can delete the RIGHT pusher — deleting with an empty pushkey is a no-op (or,
// worse, matches nothing) and leaves a stale pusher pointing at the gateway.
let registeredPushkey: string | null = null;

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
}

export const pushDebug: PushDebugState = {
    native: Capacitor.isNativePlatform(),
    gatewayUrl: PUSH_GATEWAY_URL,
    pushEnabled: PUSH_ENABLED,
    permission: "unknown",
    fcmToken: null,
    pusherRegistered: false,
    lastError: null,
};

export async function initPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!PUSH_ENABLED) {
        console.info(
            "[push] No push gateway configured (VITE_PUSH_GATEWAY_URL) — push disabled.",
        );
        return;
    }
    if (pushInitialised) return;
    pushInitialised = true;

    // Everything below touches the native FCM stack; guard the whole thing so a
    // missing/broken Firebase config can never crash the app — it just disables
    // push.
    try {
        // Request permission
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt") {
            permission = await PushNotifications.requestPermissions();
        }
        pushDebug.permission = permission.receive;
        if (permission.receive !== "granted") {
            pushDebug.lastError = "Notification permission not granted";
            console.warn("[push] Notification permission denied");
            return;
        }

        PushNotifications.addListener("registration", async (token: Token) => {
            console.log("[push] FCM token:", token.value);
            pushDebug.fcmToken = token.value;
            await registerPusher(matrixClient, token.value);
        });

        PushNotifications.addListener("registrationError", (err) => {
            pushDebug.lastError =
                "FCM registration error: " + JSON.stringify(err);
            console.error("[push] Registration error:", err);
        });

        // Foreground notifications: the OS won't show them automatically, so we
        // could show an in-app toast here if desired. For now just log.
        PushNotifications.addListener(
            "pushNotificationReceived",
            (notification) => {
                console.log("[push] Foreground notification:", notification);
            },
        );

        // User tapped a notification
        PushNotifications.addListener(
            "pushNotificationActionPerformed",
            (action) => {
                const roomId = action.notification.data?.room_id;
                if (roomId) {
                    // Navigate to the room (switching space if needed) — import
                    // lazily to avoid circular deps.
                    import("$lib/stores/rooms.svelte").then(
                        ({ navigateToRoom }) => {
                            navigateToRoom(roomId);
                        },
                    );
                }
            },
        );

        // Register with FCM last — triggers the 'registration' event with the
        // token. Throws if Firebase isn't configured (caught below).
        await PushNotifications.register();
    } catch (err) {
        pushInitialised = false;
        pushDebug.lastError =
            "Push init failed (Firebase not configured?): " + String(err);
        console.warn(
            "[push] Push init failed (Firebase not configured?) — continuing without push.",
            err,
        );
    }
}

async function registerPusher(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    fcmToken: string,
): Promise<void> {
    const deviceId = matrixClient.getDeviceId();
    if (!deviceId) return;

    try {
        await (matrixClient as any).setPusher({
            kind: "http",
            app_id: APP_ID,
            app_display_name: "Zam",
            device_display_name: `Android (${deviceId})`,
            pushkey: fcmToken,
            lang: navigator.language || "en",
            data: {
                url: PUSH_GATEWAY_URL,
                format: "event_id_only",
            },
            // multi-account: false would delete other users' pushers for this token
            append: true,
        });
        registeredPushkey = fcmToken;
        pushDebug.pusherRegistered = true;
        console.log("[push] Pusher registered");
    } catch (err) {
        pushDebug.pusherRegistered = false;
        pushDebug.lastError = "Failed to register pusher: " + String(err);
        console.error("[push] Failed to register pusher:", err);
    }
}

export async function unregisterPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!Capacitor.isNativePlatform() || !PUSH_ENABLED) return;
    const deviceId = matrixClient.getDeviceId();
    if (!deviceId) return;

    if (registeredPushkey) {
        try {
            // Delete the pusher by setting kind to null. Must use the REAL
            // pushkey we registered — an empty one deletes nothing.
            await (matrixClient as any).setPusher({
                kind: null,
                app_id: APP_ID,
                pushkey: registeredPushkey,
                app_display_name: "",
                device_display_name: "",
                lang: "en",
                data: {},
            });
            registeredPushkey = null;
        } catch {
            /* ignore */
        }
    }

    pushInitialised = false;
    await PushNotifications.removeAllListeners();
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
