// Pure append rule shared by the composer-insert host primitive. Matches the
// legacy MessageInput.insertGif behavior (`text ? text + " " + url : url`)
// exactly so the migrated GIF picker inserts identically. Zero SDK/DOM imports.
export function composerInsertText(current: string, insert: string): string {
    return current ? current + " " + insert : insert;
}
