import { isRingEventType, ringRequested } from "./callNotify";

export type PushKind = "call" | "message";

/** Decide how to render a fetched pushed event. An MSC4075 ring (the SDK's
 *  `rtc.notification` with `notification_type: "ring"`, or an older
 *  call-notify with a "ring" or absent `notify_type`) IN A DM is an incoming
 *  CALL; everything else, including a ring in a room or space (join-on-demand)
 *  or a ring whose lifetime has passed, renders as a message. Keep this
 *  identical to the inline copies in `static/sw.js` and
 *  MatrixMessagingService.java: neither can import from `src/`, so this test
 *  guards the contract shared with the ported rule there. */
export function pushNotificationKind(
    evtType: string | undefined,
    content?: Record<string, unknown>,
    isDm = true,
    now = Date.now(),
): PushKind {
    if (
        isDm &&
        evtType !== undefined &&
        isRingEventType(evtType) &&
        ringRequested(evtType, content, now)
    )
        return "call";
    return "message";
}
