export type PushKind = "call" | "message";

/** Decide how to render a fetched pushed event. An MSC4075 m.call.notify with a
 *  "ring" (or absent) notify_type is an incoming CALL; everything else renders
 *  as a message. Keep this identical to the inline copy in `static/sw.js` —
 *  the SW is a standalone static file that cannot import from `src/`, so this
 *  test guards the contract shared with the ported 3-line rule there. */
export function pushNotificationKind(
    evtType: string | undefined,
    notifyType?: string,
): PushKind {
    if (
        evtType === "m.call.notify" &&
        (notifyType === undefined || notifyType === "ring")
    )
        return "call";
    return "message";
}
