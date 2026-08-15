// GIF picker result cache — pure freshness logic for reusing an already-loaded
// KLIPY page-1 result when the picker is reopened.
//
// The GIF picker (`GifPicker.svelte`) is `{#if}`-mounted, so it remounts on
// every open and its mount effect calls `loadGifs()`, which otherwise fires a
// fresh KLIPY page-1 fetch every time — a redundant network round-trip and a
// "Loading…" flash even when the last results are seconds old. The module-level
// `gifSearchState` already keeps `items` across unmount; these helpers decide
// whether that surviving set is still fresh enough to display without refetching
// (the GIF analog to the emoji picker's memoized render — see twemoji.ts).

/** How long a page-1 result stays reusable on reopen. */
export const GIF_CACHE_TTL_MS = 60_000;

/**
 * Cache identity for a load: the tab kind plus the normalized query, so
 * equivalent searches ("Cat" / "  cat ") share one entry and trending (empty
 * query) is distinct from any search.
 */
export function gifCacheKey(kind: string, query: string): string {
    return `${kind}\n${query.trim().toLowerCase()}`;
}

/**
 * Whether the results currently in the store can be reused for a requested
 * load instead of hitting the network. True only when something is displayed,
 * it was loaded for the same key, and it is within the TTL. A backwards clock
 * (now < cachedAt) is treated as fresh rather than triggering a refetch.
 */
export function canReuseGifResults(params: {
    requestedKey: string;
    cachedKey: string | null;
    cachedAt: number;
    now: number;
    ttlMs: number;
    itemCount: number;
}): boolean {
    const { requestedKey, cachedKey, cachedAt, now, ttlMs, itemCount } = params;
    if (itemCount === 0) return false;
    if (cachedKey === null || cachedKey !== requestedKey) return false;
    if (now - cachedAt > ttlMs) return false;
    return true;
}
