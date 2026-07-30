/**
 * Should the composer be wiped once a send lands?
 *
 * A caption (MSC2530) rides on the first queued file, so its "sent" moment is
 * an upload completing — possibly seconds after Send, and the composer stays
 * editable the whole time. Clearing unconditionally at that point destroyed
 * whatever the user had done since, so both halves of this predicate exist to
 * protect work the clear does not own:
 *
 * - **Room:** the composer is shared across rooms (this component stays
 *   mounted), so after a room switch it is showing the NEW room's restored
 *   draft. Wiping it would delete text that was never sent anywhere.
 * - **Text:** if the text differs from what the send captured, the user typed
 *   while the upload was in flight. That new sentence is not the caption we
 *   just delivered, so it is not ours to throw away (and re-rendering would
 *   also yank the caret back to offset 0 mid-typing).
 *
 * Compared verbatim, not trimmed: the send used the trimmed text, but the
 * composer holds what the user actually typed, and a whitespace-only edit is
 * still an edit — the caret has moved and the model changed.
 *
 * Note this predicate governs only the VISIBLE clear. Deleting the room's
 * stored draft is unconditional at the call site: text that has been sent is
 * not a draft of the room it went to, whichever room is on screen now.
 */
export function shouldClearComposerAfterSend(input: {
    currentRoomId: string;
    targetRoomId: string;
    currentText: string;
    textAtSend: string;
}): boolean {
    return (
        input.currentRoomId === input.targetRoomId &&
        input.currentText === input.textAtSend
    );
}
