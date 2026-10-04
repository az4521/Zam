// Decrypting push notifications.
//
// Pushes are event_id_only, and the two things that turn them into a visible
// notification (static/sw.js on the web, MatrixMessagingService.java on
// Android) fetch the event from the homeserver themselves. Neither holds the
// E2EE keys — those live in this page's crypto store — so an encrypted message
// used to arrive as plain "m.room.encrypted" and the notification could only
// say "<sender> sent a message".
//
// This module lets them ask a running page instead: given a room and event id,
// it decrypts the event with the live client and answers with the cleartext
// type and content. When no page is running (the app was killed, no tab open)
// nobody answers and the callers keep their generic fallback after a timeout.

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { fetchSingleEvent } from "$lib/matrix/client";
import { getClient } from "$lib/matrix/runtime";

export interface DecryptedForPush {
    type: string;
    content: Record<string, unknown>;
}

/**
 * The cleartext of one event, or null when this page cannot provide it: no
 * client, a room this account is not in, or an event that will not decrypt.
 * Never throws.
 */
export async function decryptForPush(
    roomId: unknown,
    eventId: unknown,
): Promise<DecryptedForPush | null> {
    if (typeof roomId !== "string" || typeof eventId !== "string") return null;
    try {
        const client = getClient();
        const room = client?.getRoom(roomId);
        // Not in this room → the push belongs to some other session; say
        // nothing rather than decrypting on its behalf.
        if (!client || !room) return null;
        let ev = room.findEventById(eventId) ?? null;
        if (ev) await client.decryptEventIfNeeded(ev);
        if (
            !ev ||
            ev.isDecryptionFailure() ||
            ev.getType() === "m.room.encrypted"
        )
            ev = await fetchSingleEvent(roomId, eventId);
        if (!ev || ev.isDecryptionFailure()) return null;
        const type = ev.getType();
        if (type === "m.room.encrypted") return null;
        return {
            type,
            content: (ev.getContent() ?? {}) as Record<string, unknown>,
        };
    } catch {
        return null;
    }
}

interface PushDecryptPlugin {
    respond(options: {
        requestId: string;
        type?: string;
        content?: Record<string, unknown>;
    }): Promise<void>;
    addListener(
        eventName: "decryptRequest",
        listenerFunc: (e: {
            requestId: string;
            roomId: string;
            eventId: string;
        }) => void,
    ): Promise<PluginListenerHandle>;
}

const PushDecrypt = registerPlugin<PushDecryptPlugin>("PushDecrypt");

/**
 * Answer decrypt requests from the service worker (a MessagePort reply to a
 * DECRYPT_FOR_PUSH message) and, on Android, from the native push service.
 * Returns the teardown.
 */
export function startPushDecryptResponder(): () => void {
    const cleanups: (() => void)[] = [];

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const onMessage = (e: MessageEvent) => {
            const data = e.data as {
                type?: string;
                roomId?: unknown;
                eventId?: unknown;
            } | null;
            if (data?.type !== "DECRYPT_FOR_PUSH") return;
            const port = e.ports[0];
            if (!port) return;
            void decryptForPush(data.roomId, data.eventId).then((result) => {
                try {
                    port.postMessage(result);
                } catch {
                    /* the worker gave up on us */
                }
            });
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
        cleanups.push(() =>
            navigator.serviceWorker.removeEventListener("message", onMessage),
        );
    }

    if (
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android" &&
        Capacitor.isPluginAvailable("PushDecrypt")
    ) {
        let handle: PluginListenerHandle | null = null;
        let stopped = false;
        void PushDecrypt.addListener("decryptRequest", (req) => {
            void decryptForPush(req.roomId, req.eventId).then((result) =>
                PushDecrypt.respond({
                    requestId: req.requestId,
                    ...(result ?? {}),
                }).catch(() => {}),
            );
        })
            .then((h) => {
                if (stopped) void h.remove();
                else handle = h;
            })
            .catch(() => {});
        cleanups.push(() => {
            stopped = true;
            void handle?.remove();
        });
    }

    return () => {
        for (const c of cleanups) c();
    };
}
