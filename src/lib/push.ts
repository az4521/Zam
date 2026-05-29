/**
 * Push notification integration for Android via Capacitor + FCM.
 *
 * On startup (after login), call initPush(). It will:
 *   1. Request notification permission
 *   2. Get the FCM device token
 *   3. Register a Matrix pusher with the homeserver pointing at the gateway
 *   4. Listen for foreground push notifications (background ones are shown by the OS)
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";

// URL of your push gateway (see push-gateway/ directory). Set at build time via
// the VITE_PUSH_GATEWAY_URL env var, or edit the fallback below. The example
// placeholder counts as "not configured".
const PUSH_GATEWAY_URL =
    (import.meta.env as Record<string, string | undefined>)
        .VITE_PUSH_GATEWAY_URL ||
    "https://your-gateway.example.com/_matrix/push/v1/notify";

// Must match the app_id registered in your push gateway config.
const APP_ID = "moe.crafty.matrix";

// Push is only attempted when a real gateway is configured. This is also our
// guard against builds shipped WITHOUT a Firebase google-services.json: calling
// into FCM (PushNotifications.register) with no Firebase config throws natively
// ("Default FirebaseApp is not initialized"), so we simply don't touch it. The
// app then runs normally, just without push.
const PUSH_ENABLED = !PUSH_GATEWAY_URL.includes("your-gateway.example.com");

let pushInitialised = false;

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
        if (permission.receive !== "granted") {
            console.warn("[push] Notification permission denied");
            return;
        }

        PushNotifications.addListener("registration", async (token: Token) => {
            console.log("[push] FCM token:", token.value);
            await registerPusher(matrixClient, token.value);
        });

        PushNotifications.addListener("registrationError", (err) => {
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
                    // Navigate to the room — import setActiveRoom lazily to avoid circular deps
                    import("$lib/stores/rooms.svelte").then(
                        ({ setActiveRoom }) => {
                            setActiveRoom(roomId);
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
            app_display_name: "Matrix Client",
            device_display_name: `Android (${deviceId})`,
            pushkey: fcmToken,
            lang: navigator.language || "en",
            data: {
                url: PUSH_GATEWAY_URL,
                format: "event_id_only",
            },
            // Replace any existing pusher for this device
            append: false,
        });
        console.log("[push] Pusher registered");
    } catch (err) {
        console.error("[push] Failed to register pusher:", err);
    }
}

export async function unregisterPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!Capacitor.isNativePlatform() || !PUSH_ENABLED) return;
    const deviceId = matrixClient.getDeviceId();
    if (!deviceId) return;

    try {
        // Delete the pusher by setting kind to null
        await (matrixClient as any).setPusher({
            kind: null,
            app_id: APP_ID,
            pushkey: "",
            app_display_name: "",
            device_display_name: "",
            lang: "en",
            data: {},
        });
    } catch {
        /* ignore */
    }

    pushInitialised = false;
    await PushNotifications.removeAllListeners();
}
