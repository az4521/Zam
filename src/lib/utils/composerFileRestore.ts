/**
 * Pure restore-set computation for the composer attachment drawer.
 *
 * On send the drawer is cleared optimistically. If some files fail, only the
 * ones that were NOT successfully sent are restored — restoring an already-sent
 * file would duplicate it on the next send (audit MEDIA-03). This helper is the
 * single enforcement point for that invariant, kept pure so it stays testable.
 */
export function filesToRestoreAfterSend<T extends { id: string }>(
    batch: readonly T[],
    sentIds: ReadonlySet<string>,
): T[] {
    return batch.filter((item) => !sentIds.has(item.id));
}
