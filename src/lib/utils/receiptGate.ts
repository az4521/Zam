// Read receipts must only be sent for events the user could actually see.
// Per the Matrix spec, a read receipt marks an event as *displayed* to the
// user — so we may only send one when the app window is focused AND the tab
// is visible AND someone has used the device recently.
//
// The last condition matters as much as the first two: a window keeps focus
// while its owner is away from the desk. Without it, a desktop left open on a
// room marked every incoming message read at once, and the phone then dropped
// each push as "room already read". Same idle rule as the active-session
// heartbeat (isDeviceInUse), so the two features agree on "in use".
//
// Trivial by design: the value is that this gate is a single, tested,
// documented predicate that every markAsRead() call site funnels through.
import { IDLE_LIMIT_MS, isDeviceInUse } from "$lib/utils/activeSession";

export const canSendReceipt = (state: {
    hasFocus: boolean;
    visible: boolean;
    lastInputTs: number | null;
    now: number;
}): boolean =>
    state.visible &&
    isDeviceInUse({
        hasFocus: state.hasFocus,
        lastInputTs: state.lastInputTs,
        now: state.now,
        idleLimitMs: IDLE_LIMIT_MS,
    });
