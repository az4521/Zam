import { t } from "$lib/i18n";
import {
    fetchKlipy,
    trendingUrl,
    searchUrl,
    type GifKind,
    type GifPage,
    type GifResult,
} from "$lib/utils/klipy";
import {
    gifCacheKey,
    canReuseGifResults,
    GIF_CACHE_TTL_MS,
} from "$lib/utils/gifCache";
import { GIF_RESULT_CAP, pagesToDrop } from "$lib/utils/gifResultWindow";

const DEBOUNCE_MS = 350;

/** Where results come from. The built-in source is KLIPY; a plugin's GIF
 *  provider is another. `key` keeps their reopen caches apart. */
export interface GifSource {
    key: string;
    /** Empty query = trending/featured. */
    fetch(query: string, page: number, kind: GifKind): Promise<GifPage>;
}

export const KLIPY_SOURCE: GifSource = {
    key: "klipy",
    fetch: (query, page, kind) => {
        const q = query.trim();
        return fetchKlipy(
            q ? searchUrl(kind, q, page) : trendingUrl(kind, page),
            kind,
        );
    },
};

let source: GifSource = KLIPY_SOURCE;

class GifSearchState {
    kind = $state<GifKind>("gifs");
    query = $state("");
    items = $state<GifResult[]>([]);
    page = $state(1);
    loading = $state(false);
    error = $state<string | null>(null);
    exhausted = $state(false);
    /** True when the results come from a plugin, not KLIPY. */
    pluginSource = $state(false);
}

export const gifSearchState = new GifSearchState();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let requestSeq = 0; // stale-response guard: only the newest request may write

// Reopen cache: the (kind, query) and time of the last successful page-1 load.
// The store's `items` already survive unmount; these let loadGifs skip the
// redundant refetch when the surviving set is still fresh for the same key.
let cachedKey: string | null = null;
let cachedAt = 0;

/** Item count of each page held, oldest first. Dropping the oldest pages
 *  (once past GIF_RESULT_CAP) needs these to cut on page boundaries. */
let pageLengths: number[] = [];

function resetResults(): void {
    gifSearchState.items = [];
    gifSearchState.page = 1;
    gifSearchState.exhausted = false;
    pageLengths = [];
}

/** Drop the `n` oldest pages. Returns how many results went with them. */
function dropLeadingPages(n: number): number {
    if (n <= 0) return 0;
    let count = 0;
    for (let i = 0; i < n; i++) count += pageLengths[i];
    pageLengths = pageLengths.slice(n);
    gifSearchState.items = gifSearchState.items.slice(count);
    return count;
}

/** Cache identity: plain `kind` for KLIPY so its keys are unchanged. */
function sourceKind(kind: GifKind): string {
    return source === KLIPY_SOURCE ? kind : `${source.key}:${kind}`;
}

function useSource(next: GifSource | undefined): void {
    const resolved = next ?? KLIPY_SOURCE;
    if (resolved.key !== source.key) {
        // Another source's tiles must not show under this one while it loads.
        requestSeq++;
        resetResults();
        gifSearchState.loading = false;
        cachedKey = null;
    }
    source = resolved;
    gifSearchState.pluginSource = resolved !== KLIPY_SOURCE;
}

async function run(
    kind: GifKind,
    query: string,
    page: number,
    append: boolean,
): Promise<void> {
    const seq = ++requestSeq;
    // Record kind/query so loadMore() can reuse them for the next page.
    gifSearchState.kind = kind;
    gifSearchState.query = query;
    gifSearchState.loading = true;
    gifSearchState.error = null;
    // Fresh load: drop any stale exhaustion from a prior search so it can't
    // survive into this request's in-flight window or an error.
    // A fresh query clears the previous query's results up front.
    if (!append) resetResults();
    try {
        const { items, hasNext } = await source.fetch(query, page, kind);
        if (seq !== requestSeq) return; // a newer request superseded this one
        if (append) {
            const seen = new Set(gifSearchState.items.map((i) => i.id));
            const fresh = items.filter((i) => !seen.has(i.id));
            gifSearchState.items = [...gifSearchState.items, ...fresh];
            pageLengths.push(fresh.length);
            // loadMore made room for a page of the usual size; a larger one
            // is trimmed here.
            dropLeadingPages(pagesToDrop(pageLengths, GIF_RESULT_CAP, 0));
        } else {
            gifSearchState.items = items;
            pageLengths = [items.length];
        }
        gifSearchState.page = page;
        gifSearchState.exhausted = !hasNext;
        // Mark the now-displayed set reusable on reopen. Recorded on appended
        // pages too so an actively-scrolled list stays fresh under the same key.
        cachedKey = gifCacheKey(sourceKind(kind), query);
        cachedAt = Date.now();
    } catch {
        if (seq !== requestSeq) return;
        gifSearchState.error =
            source === KLIPY_SOURCE
                ? t("gifSearch.couldnTReachKlipyTryAgain")
                : t("gifSearch.couldNotLoadGifsTryAgain");
        if (!append) gifSearchState.items = [];
    } finally {
        if (seq === requestSeq) gifSearchState.loading = false;
    }
}

/** Immediate page-1 load (tab/kind switch, retry). Cancels any pending debounce. */
export function loadGifs(
    kind: GifKind,
    query: string,
    gifSource?: GifSource,
): void {
    useSource(gifSource);
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    // Reopening the picker (or switching back to the GIFs tab) within the TTL
    // reuses the results still in the store instead of refetching — no network
    // round-trip and no "Loading…" flash. Bump requestSeq so any request still
    // in flight can't overwrite the reused set when it resolves.
    if (
        canReuseGifResults({
            requestedKey: gifCacheKey(sourceKind(kind), query),
            cachedKey,
            cachedAt,
            now: Date.now(),
            ttlMs: GIF_CACHE_TTL_MS,
            itemCount: gifSearchState.items.length,
        })
    ) {
        requestSeq++;
        gifSearchState.kind = kind;
        gifSearchState.query = query;
        gifSearchState.loading = false;
        gifSearchState.error = null;
        return;
    }
    void run(kind, query, 1, false);
}

/** Debounced page-1 load (while typing). */
export function queueSearch(
    kind: GifKind,
    query: string,
    gifSource?: GifSource,
): void {
    useSource(gifSource);
    gifSearchState.kind = kind;
    gifSearchState.query = query;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        void run(kind, query, 1, false);
    }, DEBOUNCE_MS);
}

/** Whether the next loadMore() would drop the oldest results to stay capped. */
export function loadMoreWouldTrim(): boolean {
    const next = pageLengths[pageLengths.length - 1] ?? 0;
    return pagesToDrop(pageLengths, GIF_RESULT_CAP, next) > 0;
}

/**
 * Fetch the next page. Once the held results would pass GIF_RESULT_CAP, the
 * oldest whole pages are dropped first so pagination never stops while the
 * user keeps scrolling. Returns how many results were dropped, so the caller
 * can keep its scroll position.
 */
export function loadMore(): number {
    if (gifSearchState.loading || gifSearchState.exhausted) return 0;
    const next = pageLengths[pageLengths.length - 1] ?? 0;
    const dropped = dropLeadingPages(
        pagesToDrop(pageLengths, GIF_RESULT_CAP, next),
    );
    void run(
        gifSearchState.kind,
        gifSearchState.query,
        gifSearchState.page + 1,
        true,
    );
    return dropped;
}
