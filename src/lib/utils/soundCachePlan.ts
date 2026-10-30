// Pure bookkeeping for the on-device soundboard cache (matrix/soundCache.ts):
// which entries to drop to stay inside the limits. Cache Storage has no
// notion of "last used", so the cache keeps an index of its own.

/** Total bytes kept. Clips are at most 1 MB each. */
export const SOUND_CACHE_MAX_BYTES = 64 * 1024 * 1024;
export const SOUND_CACHE_MAX_ENTRIES = 300;

export interface SoundCacheEntry {
    size: number;
    /** Epoch ms of the last read or write. */
    used: number;
}

export type SoundCacheIndex = Record<string, SoundCacheEntry>;

/** An index from whatever was stored: bad entries are dropped, never thrown. */
export function parseSoundCacheIndex(raw: unknown): SoundCacheIndex {
    const out: SoundCacheIndex = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== "object") continue;
        const { size, used } = value as { size?: unknown; used?: unknown };
        if (
            typeof size === "number" &&
            Number.isFinite(size) &&
            size >= 0 &&
            typeof used === "number" &&
            Number.isFinite(used)
        )
            out[key] = { size, used };
    }
    return out;
}

/** The keys to remove, least recently used first, so that what is left fits
 *  `maxBytes` and `maxEntries`. `keep` is never chosen, even if it alone is
 *  over the limits. */
export function planSoundCacheEviction(
    index: SoundCacheIndex,
    maxBytes: number,
    maxEntries: number,
    keep?: string,
): string[] {
    let bytes = 0;
    let count = 0;
    for (const entry of Object.values(index)) {
        bytes += entry.size;
        count++;
    }
    const drop: string[] = [];
    const oldest = Object.entries(index)
        .filter(([key]) => key !== keep)
        .sort((a, b) => a[1].used - b[1].used);
    for (const [key, entry] of oldest) {
        if (bytes <= maxBytes && count <= maxEntries) break;
        drop.push(key);
        bytes -= entry.size;
        count--;
    }
    return drop;
}
