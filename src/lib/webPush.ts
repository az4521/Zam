/**
 * Web Push (PWA) notifications via the standard Web Push API + a Sygnal
 * `webpush` app.
 *
 * Flow:
 *   1. Ask for Notification permission.
 *   2. Subscribe the service worker's PushManager with the server's VAPID
 *      public key.
 *   3. Register a Matrix HTTP pusher whose pushkey is the subscription endpoint
 *      and whose data carries the p256dh/auth keys, in the shape Sygnal's
 *      webpush pushkin expects.
 *
 * Server side you need a Sygnal `apps` entry of type `webpush` with a matching
 * `vapid_private_key` / `vapid_contact_email`, and the public key exposed to
 * the build as VITE_VAPID_PUBLIC_KEY. See ANDROID_PUSH_SETUP.md / docs.
 *
 * This is the browser/PWA counterpart to push.ts (Capacitor/FCM/Android).
 */

import { Capacitor } from "@capacitor/core";

const PUSH_GATEWAY_URL =
    (import.meta.env as Record<string, string | undefined>)
        .VITE_PUSH_GATEWAY_URL ||
    "https://sygnal.crafty.moe/_matrix/push/v1/notify";

const VAPID_PUBLIC_KEY =
    (import.meta.env as Record<string, string | undefined>)
        .VITE_VAPID_PUBLIC_KEY ||
    "BHDunEhVBbl-lVD3ICUfxPlIavtUGZtlMQ5fGCgkstZ-bzyINux5N_SNpoO5apHAaPNf5NSBzBIcTBWdZY1trwI";

// app_id for the Sygnal webpush app (distinct from the FCM/Android one).
const APP_ID = "moe.crafty.matrix.webpush";

/** Web push only applies to the browser/PWA build, and needs the platform APIs. */
export function webPushSupported(): boolean {
    return (
        !Capacitor.isNativePlatform() &&
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export function webPushConfigured(): boolean {
    return !!VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const raw = atob(base64);
    const buf = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    return buf;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
    if (!buf) return "";
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Subscribe to web push and register the pusher. Safe to call repeatedly; it
 * reuses an existing subscription. No-ops when unsupported/unconfigured.
 */
export async function initWebPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!webPushSupported() || !webPushConfigured()) return;

    if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
    }
    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        });
    }

    await registerWebPusher(matrixClient, sub);
}

async function registerWebPusher(
    matrixClient: import("matrix-js-sdk").MatrixClient,
    sub: PushSubscription,
): Promise<void> {
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
    const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));

    try {
        await (matrixClient as any).setPusher({
            kind: "http",
            app_id: APP_ID,
            app_display_name: "Matrix Client (Web)",
            device_display_name: navigator.userAgent.slice(0, 80),
            // The endpoint is the unique pushkey for this browser subscription.
            pushkey: endpoint,
            lang: navigator.language || "en",
            data: {
                url: PUSH_GATEWAY_URL,
                format: "event_id_only",
                // Sygnal webpush pushkin reads these from data.
                endpoint,
                keys: { p256dh, auth },
                default_payload: {},
            },
            append: false,
        });
        console.log("[webpush] Pusher registered");
    } catch (err) {
        console.error("[webpush] Failed to register pusher:", err);
    }
}

/** Remove the web push subscription + pusher (on logout). */
export async function teardownWebPush(
    matrixClient: import("matrix-js-sdk").MatrixClient,
): Promise<void> {
    if (!webPushSupported()) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            try {
                await (matrixClient as any).setPusher({
                    kind: null,
                    app_id: APP_ID,
                    pushkey: sub.endpoint,
                    app_display_name: "",
                    device_display_name: "",
                    lang: "en",
                    data: {},
                });
            } catch {
                /* ignore */
            }
            await sub.unsubscribe();
        }
    } catch {
        /* ignore */
    }
}
