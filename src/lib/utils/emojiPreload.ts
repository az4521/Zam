/**
 * Warm a room's custom emoji (MSC2545 `im.ponies` image packs) in the
 * background when the room opens, so the emoji picker and inline `:shortcode:`
 * images render instantly instead of trickling in.
 *
 * Why this exists (measured 2026-08-19): custom emoji are authenticated media
 * (`/_matrix/client/v1/media/download/...`). The homeserver returns NO
 * `Cache-Control`/`ETag`, so the browser cannot persist them, and a REMOTE
 * pack (e.g. a crafty.moe room opened from a mystravil.xyz account) costs a
 * federated fetch of ~0.6–1s EACH the first time — a fresh emoji-heavy room can
 * take tens of seconds to fill in. Resolving the pack list itself is ~0.1ms, so
 * the whole cost is the image fetch. Warming the images on room open moves that
 * cost off the moment the user opens the picker and warms the homeserver's own
 * remote-media cache, so subsequent loads (this session AND later ones) are
 * fast.
 *
 * Deliberately conservative: session-deduped (each url fetched at most once),
 * capped, low-concurrency, and fire-and-forget — it never blocks the UI and a
 * failed warm (e.g. an uncontrolled page with no service worker to inject the
 * token → 401) just falls back to the normal on-demand render path.
 */

/** Max urls to warm per room open — a pathological pack can hold hundreds. */
export const EMOJI_PRELOAD_CAP = 200;
/** Simultaneous warm fetches — kept well under the browser's ~6/host so the
 *  room's own content (messages, avatars) is not starved on open. */
export const EMOJI_PRELOAD_CONCURRENCY = 3;

export interface PreloadablePack {
    emojis: ReadonlyArray<{ url?: string | null }>;
}

/**
 * Pure: the ordered, de-duplicated list of image urls to warm, excluding any
 * already in `alreadyWarmed`, capped at `cap`. Falsy / non-string urls are
 * dropped.
 */
export function planEmojiPreload(
    packs: ReadonlyArray<PreloadablePack>,
    alreadyWarmed: ReadonlySet<string>,
    cap: number = EMOJI_PRELOAD_CAP,
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const pack of packs) {
        for (const emoji of pack.emojis) {
            const url = emoji.url;
            if (!url || typeof url !== "string") continue;
            if (seen.has(url) || alreadyWarmed.has(url)) continue;
            seen.add(url);
            out.push(url);
            if (out.length >= cap) return out;
        }
    }
    return out;
}

/** Load a single image url so the browser (and, on the way, the homeserver's
 *  remote-media cache) warms it. Resolves on load OR error — a broken emoji
 *  must never wedge the pool. No-op outside a DOM. */
function defaultLoad(url: string): Promise<void> {
    return new Promise<void>((resolve) => {
        if (typeof Image === "undefined") {
            resolve();
            return;
        }
        const img = new Image();
        img.decoding = "async";
        img.onload = img.onerror = () => resolve();
        img.src = url;
    });
}

export interface WarmOptions {
    concurrency?: number;
    /** Injectable for tests; defaults to an `Image()` load. */
    load?: (url: string) => Promise<void>;
}

/**
 * Fetch `urls` through a bounded worker pool, skipping any already in `warmed`
 * and marking each warmed BEFORE it loads (so a concurrent caller cannot
 * double-schedule the same url). Best-effort: a rejected load is swallowed and
 * the url stays marked so it is not retried this session.
 */
export async function warmUrls(
    urls: ReadonlyArray<string>,
    warmed: Set<string>,
    opts: WarmOptions = {},
): Promise<void> {
    const load = opts.load ?? defaultLoad;
    const concurrency = opts.concurrency ?? EMOJI_PRELOAD_CONCURRENCY;

    const queue: string[] = [];
    for (const url of urls) {
        if (warmed.has(url)) continue;
        warmed.add(url);
        queue.push(url);
    }
    if (queue.length === 0) return;

    let next = 0;
    const worker = async () => {
        while (next < queue.length) {
            const url = queue[next++];
            try {
                await load(url);
            } catch {
                /* best-effort: a broken emoji must not wedge the pool */
            }
        }
    };
    const workers = Math.max(1, Math.min(concurrency, queue.length));
    await Promise.all(Array.from({ length: workers }, () => worker()));
}

// Session-scoped set of urls already warmed (or in flight). Lives for the life
// of the page; an account switch reloads the page, so it never crosses accounts.
const warmedUrls = new Set<string>();

export interface PreloadOptions extends WarmOptions {
    cap?: number;
}

/**
 * Plan the packs against this session's warmed set, kick off the (throttled,
 * fire-and-forget) warming, and return the urls it scheduled. Safe to call on
 * every room open — re-opening a warmed room plans nothing and does no work.
 */
export function preloadEmojiPacks(
    packs: ReadonlyArray<PreloadablePack>,
    opts: PreloadOptions = {},
): string[] {
    const urls = planEmojiPreload(
        packs,
        warmedUrls,
        opts.cap ?? EMOJI_PRELOAD_CAP,
    );
    if (urls.length > 0) {
        void warmUrls(urls, warmedUrls, opts);
    }
    return urls;
}

/** Test hook: drop the session cache so each test starts cold. */
export function __resetEmojiPreloadCache(): void {
    warmedUrls.clear();
}
