/**
 * Migration selector for favourite GIFs.
 *
 * The list moved from the `m.favourite_gifs` account-data key (which squatted
 * the reserved `m.*` namespace) to `moe.crafty.matrix.favourite_gifs`. Reads
 * prefer the NEW key and fall back to the legacy key ONLY when the new one has
 * never been written.
 *
 * `null` means "the key is absent" (never set); an empty array means "the key
 * exists and is deliberately empty". Once the new key exists — even empty — it
 * is authoritative and the legacy list is ignored, so clearing your favourites
 * can never be undone by a stale legacy blob.
 *
 * Generic so it can select account-data events (in-memory) and server GETs with
 * the same rule.
 */
export function pickFavouriteGifs<T>(
    current: T[] | null,
    legacy: T[] | null,
): T[] {
    if (current !== null) return current;
    if (legacy !== null) return legacy;
    return [];
}
