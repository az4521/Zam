// Pure append rule shared by the composer-insert host primitive. Matches the
// legacy MessageInput.insertGif behavior (`text ? text + " " + url : url`)
// exactly so the migrated GIF picker inserts identically. Zero SDK/DOM imports.
export function composerInsertText(current: string, insert: string): string {
    return current ? current + " " + insert : insert;
}

export interface ComposerSelection {
    start: number;
    end: number;
}

/**
 * Insert `insert` over `selection` (the caret, or the selected text, which it
 * replaces). `pad` keeps the insert a separate word (GIF links, timestamps):
 * a space is added on a side that touches non-space text. Without a selection
 * it appends: `pad` then follows composerInsertText, otherwise plain concat.
 * Returns the new text and the caret offset just after the insert.
 */
export function insertAtSelection(
    current: string,
    insert: string,
    selection: ComposerSelection | null,
    pad = false,
): { text: string; caret: number } {
    if (!selection) {
        const text = pad
            ? composerInsertText(current, insert)
            : current + insert;
        return { text, caret: text.length };
    }
    const start = Math.max(0, Math.min(selection.start, current.length));
    const end = Math.max(start, Math.min(selection.end, current.length));
    const before = current.slice(0, start);
    const after = current.slice(end);
    let middle = insert;
    if (pad && before && !/\s$/.test(before)) middle = " " + middle;
    const caret = before.length + middle.length;
    if (pad && after && !/^\s/.test(after)) middle += " ";
    return { text: before + middle + after, caret };
}
