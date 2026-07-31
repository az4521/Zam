/** What a row remembers about its last reply-target lookup. */
export interface CachedReplyTarget<T> {
    /** The event id the lookup was for. */
    id: string;
    /** The event found, or null if the timeline did not have it yet. */
    target: T | null;
}

/**
 * Whether a reply row needs to search the timeline again.
 *
 * Finding a reply's parent is a linear scan of the loaded timeline chunk, and
 * the row redoes it on every timeline tick — i.e. on every incoming event and
 * every decryption, for every reply on screen. A resolved target cannot change:
 * the SDK returns the same MatrixEvent reference, and edits and redactions
 * mutate that object in place. So the scan only has to run while we do not have
 * one yet, or when the row is asking about a different event.
 *
 * Generic over the event type on purpose: this util imports nothing, so it is
 * testable without the SDK (house pattern — see utils/videoTiles.ts).
 */
export function shouldRescanReplyTarget<T>(
    cached: CachedReplyTarget<T> | null,
    wantedId: string | undefined,
): boolean {
    if (!wantedId) return false;
    if (!cached || cached.id !== wantedId) return true;
    return cached.target === null;
}
