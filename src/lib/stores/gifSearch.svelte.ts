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

/** Cache identity: plain `kind` for KLIPY so its keys are unchanged. */
function sourceKind(kind: GifKind): string {
    return source === KLIPY_SOURCE ? kind : `${source.key}:${kind}`;
}

function useSource(next: GifSource | undefined): void {
    const resolved = next ?? KLIPY_SOURCE;
    if (resolved.key !== source.key) {
        // Another source's tiles must not show under this one while it loads.
        requestSeq++;
        gifSearchState.items = [];
        gifSearchState.page = 1;
        gifSearchState.exhausted = false;
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
    if (!append) gifSearchState.exhausted = false;
    try {
        const { items, hasNext } = await source.fetch(query, page, kind);
        if (seq !== requestSeq) return; // a newer request superseded this one
        if (append) {
            const seen = new Set(gifSearchState.items.map((i) => i.id));
            gifSearchState.items = [
                ...gifSearchState.items,
                ...items.filter((i) => !seen.has(i.id)),
            ];
        } else {
            gifSearchState.items = items;
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

export function loadMore(): void {
    if (gifSearchState.loading || gifSearchState.exhausted) return;
    void run(
        gifSearchState.kind,
        gifSearchState.query,
        gifSearchState.page + 1,
        true,
    );
}
