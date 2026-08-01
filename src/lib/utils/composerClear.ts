/**
 * Should the target room's STORED draft be deleted once a send lands?
 *
 * Sent text is not a draft of the room it went to, so the entry normally has
 * to go — otherwise a room the user switched away from re-offers a caption it
 * has already posted, and Enter posts it twice.
 *
 * But the stored draft is only ours to delete if it is still the text we sent.
 * The composer stays editable during an upload, and leaving the room while one
 * is in flight persists whatever the user has typed by then. Deleting that
 * because a caption finally resolved destroys a sentence that was never sent,
 * with no undo — the same loss shouldClearComposerAfterSend prevents in the
 * visible buffer, one layer down in the persisted one.
 *
 * `storedText === null` means there is no entry, so there is nothing to
 * protect and the caller's delete is a harmless no-op. Compared verbatim for
 * the same reason as the sibling predicate: a whitespace-only difference is
 * still the user's edit, and the send used the trimmed text. Verbatim also
 * means byte-identical — not same-length, not case-insensitive: editing "hi"
 * to "yo" or to "Hi" mid-upload is an edit like any other.
 *
 * A stale entry left behind by a `false` here self-heals: the composer is
 * already visibly clear, so the next room switch runs the draft effect's
 * cleanup with blank text, and setDraft treats a blank draft as "no draft"
 * and deletes the entry.
 */
export function shouldClearStoredDraft(input: {
    storedText: string | null;
    textAtSend: string;
}): boolean {
    return input.storedText === null || input.storedText === input.textAtSend;
}

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
 * Note this predicate governs only the VISIBLE clear. The room's stored draft
 * is dropped separately and conditionally, gated on shouldClearStoredDraft:
 * it is deleted only while it is still the text we just sent. Do NOT make that
 * delete unconditional — an earlier revision did, and a caption commit landing
 * after the user typed on then destroyed the longer sentence they had already
 * persisted by switching rooms.
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
