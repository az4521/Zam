export type PushKind = "call" | "message";

/** Both wire forms of an MSC4075 call-notify. The unstable one is what
 *  matrix-js-sdk sends and what continuwuity stores; the stable one is accepted
 *  in case another client/homeserver uses it. Keep in sync with the inline
 *  copies in `static/sw.js` and MatrixMessagingService.java. */
const CALL_NOTIFY_TYPES = new Set([
    "org.matrix.msc4075.call.notify",
    "m.call.notify",
]);

/** Decide how to render a fetched pushed event. An MSC4075 call-notify with a
 *  "ring" (or absent) notify_type is an incoming CALL; everything else renders
 *  as a message. Keep this identical to the inline copy in `static/sw.js` —
 *  the SW is a standalone static file that cannot import from `src/`, so this
 *  test guards the contract shared with the ported rule there. */
export function pushNotificationKind(
    evtType: string | undefined,
    notifyType?: string,
): PushKind {
    if (
        evtType !== undefined &&
        CALL_NOTIFY_TYPES.has(evtType) &&
        (notifyType === undefined || notifyType === "ring")
    )
        return "call";
    return "message";
}
