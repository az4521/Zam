/** MSC4075 ring event as matrix-js-sdk 43 sends it (`EventType.RTCNotification`).
 *  We ring through the SDK (`joinRTCSession`'s `notificationType`), so this is
 *  what our own calls send and what current Element clients send. */
export const RTC_NOTIFICATION_EVENT_TYPE =
    "org.matrix.msc4075.rtc.notification";
/** The older MSC4075 call-notify. Still accepted inbound so a ring from an
 *  older Zam (or another older client) rings. continuwuity canonicalises even a
 *  raw `m.call.notify` send to this unstable id (verified live 2026-08-21). */
export const CALL_NOTIFY_EVENT_TYPE = "org.matrix.msc4075.call.notify";
/** The stable call-notify identifier, accepted inbound only. */
export const CALL_NOTIFY_EVENT_TYPE_STABLE = "m.call.notify";

const RING_EVENT_TYPES = new Set([
    RTC_NOTIFICATION_EVENT_TYPE,
    CALL_NOTIFY_EVENT_TYPE,
    CALL_NOTIFY_EVENT_TYPE_STABLE,
]);

/** MSC4075 caps a notification's lifetime at 2 minutes. */
const MAX_RING_LIFETIME_MS = 2 * 60 * 1000;

/** Is `type` any MSC4075 ring/notify event (old or new form)? */
export function isRingEventType(type: string): boolean {
    return RING_EVENT_TYPES.has(type);
}

/**
 * Does this MSC4075 event ask to RING (vs. a quiet "a call started")?
 * New form: `notification_type: "ring" | "notification"`. Old form:
 * `notify_type: "ring" | "notify"`, where an absent value means ring.
 * A new-form ring past `sender_ts + lifetime` is over (e.g. a push delivered
 * late) and no longer rings. Keep identical to the copies in `static/sw.js`
 * and MatrixMessagingService.java.
 */
export function ringRequested(
    type: string,
    content: Record<string, unknown> | undefined,
    now = Date.now(),
): boolean {
    const c = content ?? {};
    if (type === RTC_NOTIFICATION_EVENT_TYPE) {
        if (c.notification_type !== "ring") return false;
        const sent = c.sender_ts;
        const lifetime = c.lifetime;
        if (typeof sent === "number" && typeof lifetime === "number") {
            const ends = sent + Math.min(lifetime, MAX_RING_LIFETIME_MS);
            if (now > ends) return false;
        }
        return true;
    }
    if (
        type === CALL_NOTIFY_EVENT_TYPE ||
        type === CALL_NOTIFY_EVENT_TYPE_STABLE
    )
        return c.notify_type === undefined || c.notify_type === "ring";
    return false;
}

/** True when the local join is the FIRST participant in a DM call — i.e. we are
 *  the caller and should ring the peer, not answer. `peerUserIdsInCall` is the
 *  set of non-self user ids already in the call at join time. */
export function shouldRingPeers(
    isDm: boolean,
    peerUserIdsInCall: string[],
): boolean {
    return isDm && peerUserIdsInCall.length === 0;
}
