import {
    fetchKlipy,
    trendingUrl,
    searchUrl,
    type GifKind,
    type GifResult,
} from "$lib/utils/klipy";

const DEBOUNCE_MS = 350;

class GifSearchState {
    kind = $state<GifKind>("gifs");
    query = $state("");
    items = $state<GifResult[]>([]);
    page = $state(1);
    loading = $state(false);
    error = $state<string | null>(null);
    exhausted = $state(false);
}

export const gifSearchState = new GifSearchState();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let requestSeq = 0; // stale-response guard: only the newest request may write

function urlFor(kind: GifKind, query: string, page: number): string {
    const q = query.trim();
    return q ? searchUrl(kind, q, page) : trendingUrl(kind, page);
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
        const { items, hasNext } = await fetchKlipy(urlFor(kind, query, page));
        if (seq !== requestSeq) return; // a newer request superseded this one
        gifSearchState.items = append
            ? [...gifSearchState.items, ...items]
            : items;
        gifSearchState.page = page;
        gifSearchState.exhausted = !hasNext;
    } catch {
        if (seq !== requestSeq) return;
        gifSearchState.error = "Couldn't reach KLIPY — try again.";
        if (!append) gifSearchState.items = [];
    } finally {
        if (seq === requestSeq) gifSearchState.loading = false;
    }
}

/** Immediate page-1 load (tab/kind switch, retry). Cancels any pending debounce. */
export function loadGifs(kind: GifKind, query: string): void {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    void run(kind, query, 1, false);
}

/** Debounced page-1 load (while typing). */
export function queueSearch(kind: GifKind, query: string): void {
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
