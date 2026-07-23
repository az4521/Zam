// Read receipts must only be sent for events the user could actually see.
// Per the Matrix spec, a read receipt marks an event as *displayed* to the
// user — so we may only send one when the app window is focused AND the tab
// is visible. Sending while hidden/unfocused tells other clients the user
// "read" messages they never saw.
//
// Trivial by design: the value is that this gate is a single, tested,
// documented predicate that every markAsRead() call site funnels through.
export const canSendReceipt = (state: {
    hasFocus: boolean;
    visible: boolean;
}): boolean => state.hasFocus && state.visible;
