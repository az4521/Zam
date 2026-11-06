import { untrack } from "svelte";
import { getActiveAccount } from "$lib/stores/accounts.svelte";
import { jxlFallbackUrl, maybeDecodeJxl } from "$lib/utils/jxl";
import { logSync } from "$lib/matrix/syncLog";
import { safeMediaBlob } from "$lib/utils/attachmentMime";
import { downscaleImage } from "$lib/utils/tileImage";
import { BlobUrlCache } from "$lib/utils/blobUrlCache";

/**
 * Authenticated Matrix media (`/_matrix/client/v1/media/...`) needs an
 * `Authorization` header that an `<img>` can't send. Normally the media service
 * worker injects it — but a HARD reload loads the page UNCONTROLLED (the browser
 * bypasses the SW for the navigation, and an already-active SW never re-claims),
 * so those `<img>`s 401 and stay broken until a full normal reload ("horrible
 * UX", user report). Nothing SW-based can help an uncontrolled page.
 *
 * So heal media WITHOUT the SW: fetch it with the token directly and swap the
 * `<img>` to a blob URL. Verified against the homeserver — an authed fetch
 * returns the image bytes where a plain `<img>` request 401s.
 */

function mediaCreds(): { token: string; origin: string } | null {
    const a = getActiveAccount();
    if (!a?.accessToken || !a.homeserverUrl) return null;
    try {
        return {
            token: a.accessToken,
            origin: new URL(a.homeserverUrl).origin,
        };
    } catch {
        return null;
    }
}

/** Only OUR homeserver's authed media endpoints, and only when we hold a token. */
export function isAuthedMediaUrl(src: string): boolean {
    if (!src.includes("/_matrix/client/v1/media/")) return false;
    const c = mediaCreds();
    if (!c) return false;
    try {
        return new URL(src, location.href).origin === c.origin;
    } catch {
        return false;
    }
}

const DOWNLOAD_PATH = "/_matrix/client/v1/media/download/";

/**
 * The server-thumbnail form of an authed media download URL, asking for an
 * animated thumbnail where the server supports it (MSC2705). Anything that
 * isn't a download URL is returned as is.
 */
export function thumbnailUrl(
    src: string,
    width: number,
    height: number,
    method: "crop" | "scale" = "crop",
): string {
    const at = src.indexOf(DOWNLOAD_PATH);
    if (at < 0) return src;
    const id = src.slice(at + DOWNLOAD_PATH.length).split(/[?#]/)[0];
    return `${src.slice(0, at)}/_matrix/client/v1/media/thumbnail/${id}?width=${width}&height=${height}&method=${method}&animated=true`;
}

/**
 * Whether a failed media fetch with this HTTP status is worth trying again:
 * server errors, rate limiting and timeouts. A 401/403/404 is permanent.
 */
export function isTransientMediaStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
}

/**
 * Result of an authed media fetch: the object URL, or why it failed.
 * `transient` failures (network error, 5xx, 429, 408) may succeed later.
 */
export type MediaBlobResult =
    { url: string } | { url: null; transient: boolean };

/**
 * Fetch authed media with the token → object URL, or why it isn't available.
 * JXL bytes are transcoded to PNG where the engine can't decode them, since
 * that is also why such an `<img>` errors in the first place.
 */
export async function authedMediaBlobResult(
    src: string,
): Promise<MediaBlobResult> {
    const c = mediaCreds();
    if (!c || !isAuthedMediaUrl(src)) return { url: null, transient: false };
    let res: Response;
    try {
        res = await fetch(src, {
            headers: { Authorization: `Bearer ${c.token}` },
        });
    } catch {
        return { url: null, transient: true };
    }
    if (!res.ok) {
        return { url: null, transient: isTransientMediaStatus(res.status) };
    }
    let raw: Blob;
    try {
        raw = await res.blob();
    } catch {
        // The connection dropped while the body was arriving.
        return { url: null, transient: true };
    }
    try {
        // Retyped like any attachment: these URLs sit in an <img>, where
        // "Open image in new tab" would run an unsanitized SVG in our origin.
        const blob = await safeMediaBlob(raw);
        return {
            url: URL.createObjectURL((await maybeDecodeJxl(blob)) ?? blob),
        };
    } catch {
        return { url: null, transient: false };
    }
}

/** Fetch authed media with the token → object URL, or null if unavailable. */
export async function authedMediaBlobUrl(src: string): Promise<string | null> {
    return (await authedMediaBlobResult(src)).url;
}

/**
 * An avatar of a SIGNED-IN account that is not the active one, fetched as that
 * account: its own token, only against its own homeserver. Everything above
 * authenticates as the active account, so another account's media (a different
 * homeserver, or a token that homeserver never issued) 401s there. Null when
 * the URL isn't that homeserver's authed media or the fetch fails.
 */
export async function accountMediaBlobUrl(
    src: string,
    account: { accessToken: string; homeserverUrl: string },
): Promise<string | null> {
    if (!account.accessToken) return null;
    try {
        const url = new URL(src);
        if (
            url.origin !== new URL(account.homeserverUrl).origin ||
            !url.pathname.includes("/_matrix/client/v1/media/")
        )
            return null;
        const res = await fetch(src, {
            headers: { Authorization: `Bearer ${account.accessToken}` },
        });
        if (!res.ok) return null;
        const blob = await safeMediaBlob(await res.blob());
        return URL.createObjectURL((await maybeDecodeJxl(blob)) ?? blob);
    } catch {
        return null;
    }
}

// Small copies of homeserver images, keyed by box and URL. Shared by every
// place that draws the same avatar at the same size. Most are a few KB, but a
// link preview's is up to 1024x768, so only the most recent are kept; one a
// component still shows is held (holdMediaUrl) and outlives the limit.
const shrunk = new BlobUrlCache(300);
// Each shrink decodes a full image: a large room's member list would
// otherwise start hundreds at once.
const SHRINK_CONCURRENCY = 4;
const SHRINK_TIMEOUT_MS = 20_000;
let shrinksRunning = 0;
const shrinkQueue: (() => void)[] = [];
async function shrinkSlot<T>(run: () => Promise<T>): Promise<T> {
    if (shrinksRunning >= SHRINK_CONCURRENCY) {
        await new Promise<void>((r) => shrinkQueue.push(r));
    }
    shrinksRunning++;
    try {
        return await run();
    } finally {
        shrinksRunning--;
        shrinkQueue.shift()?.();
    }
}

/**
 * A blob URL of a copy of the homeserver image `src` no bigger than a
 * `maxW`×`maxH` box needs (`fit` as in tileImage's fitSize), or null when the
 * original should be shown: it isn't our authed media, is already small, may
 * be animated, or couldn't be fetched or decoded.
 */
export function shrunkMediaUrl(
    src: string,
    maxW: number,
    maxH: number,
    fit: "contain" | "cover" = "contain",
): Promise<string | null> {
    const key = `${maxW}x${maxH}:${fit} ${src}`;
    return (
        shrunk
            .get(key, () =>
                shrinkSlot(async () => {
                    const c = mediaCreds();
                    if (!c || !isAuthedMediaUrl(src)) return null;
                    // A stalled fetch or decode would hold one of the few
                    // slots for good, and every avatar queued behind it would
                    // stay blank. Give up (and so retry next time) instead.
                    const abort = new AbortController();
                    let timer = 0;
                    const timeout = new Promise<never>((_, reject) => {
                        timer = window.setTimeout(() => {
                            abort.abort();
                            reject(new Error("shrink timed out"));
                        }, SHRINK_TIMEOUT_MS);
                    });
                    try {
                        return await Promise.race([
                            (async () => {
                                const res = await fetch(src, {
                                    headers: {
                                        Authorization: `Bearer ${c.token}`,
                                    },
                                    signal: abort.signal,
                                });
                                if (!res.ok)
                                    throw new Error(`HTTP ${res.status}`);
                                const small = await downscaleImage(
                                    await res.blob(),
                                    maxW,
                                    maxH,
                                    fit,
                                );
                                return small
                                    ? URL.createObjectURL(small)
                                    : null;
                            })(),
                            timeout,
                        ]);
                    } finally {
                        clearTimeout(timer);
                    }
                }),
            )
            // A failed fetch (offline, 401 before login settles) is retried next
            // time; only "keep the original" is remembered.
            .catch(() => null)
    );
}

// Still frames of videos that came with no poster, keyed by URL.
const frames = new BlobUrlCache(50);

/**
 * Keep a URL from shrunkMediaUrl or videoFrameUrl alive while it is shown.
 * Call the returned release when it no longer is (the component unmounts or
 * moves on to another URL); until then the cache won't revoke it.
 */
export function holdMediaUrl(url: string | null | undefined): () => void {
    const a = shrunk.hold(url);
    const b = frames.hold(url);
    return () => {
        a();
        b();
    };
}

/**
 * A blob URL of the first frame of the video at `src`, fitted in a
 * `maxW`×`maxH` box, or null if it can't be had (no CORS, undecodable,
 * nothing within 15 s). A `<video>` left mounted to show that frame keeps a
 * decoder and its frame buffers in video memory until it is removed, even
 * paused and scrolled far away; this one is emptied as soon as the frame is
 * drawn.
 */
export function videoFrameUrl(
    src: string,
    maxW: number,
    maxH: number,
): Promise<string | null> {
    const key = `${maxW}x${maxH} ${src}`;
    return frames.get(key, () =>
        shrinkSlot(
            () =>
                new Promise<string | null>((resolve) => {
                    const video = document.createElement("video");
                    let timer = 0;
                    const finish = (url: string | null) => {
                        clearTimeout(timer);
                        video.onloadeddata = video.onerror = null;
                        video.removeAttribute("src");
                        video.load();
                        resolve(url);
                    };
                    timer = window.setTimeout(() => finish(null), 15_000);
                    video.onerror = () => finish(null);
                    video.onloadeddata = () => {
                        try {
                            const w = video.videoWidth;
                            const h = video.videoHeight;
                            if (!w || !h) return finish(null);
                            const scale = Math.min(1, maxW / w, maxH / h);
                            const canvas = document.createElement("canvas");
                            canvas.width = Math.max(1, Math.round(w * scale));
                            canvas.height = Math.max(1, Math.round(h * scale));
                            canvas
                                .getContext("2d")!
                                .drawImage(
                                    video,
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height,
                                );
                            // Throws if the frame is cross-origin without CORS.
                            canvas.toBlob(
                                (blob) =>
                                    finish(
                                        blob ? URL.createObjectURL(blob) : null,
                                    ),
                                "image/webp",
                                0.85,
                            );
                        } catch {
                            finish(null);
                        }
                    };
                    video.crossOrigin = "anonymous";
                    video.muted = true;
                    video.preload = "auto";
                    video.src = src;
                }),
        ),
    );
}

function isLocalUrl(src: string): boolean {
    return src.startsWith("blob:") || src.startsWith("data:");
}

/**
 * Whether the service worker is known to add the token to `<img>` media
 * requests: it controls this page AND holds a token (it said so in reply to
 * GET_MEDIA_AUTH_STATUS, or broadcast MEDIA_AUTH_READY). Until then, media
 * rendered through createMediaRetry is fetched directly with the token rather
 * than left to 401 first. On Android every launch used to send each image
 * token-less, then re-fetch it: three requests apiece, and some never healed.
 * `retryTick` bumps when the worker becomes ready, so media that gave up
 * retries.
 */
export const swMediaAuth = $state({ ready: false, retryTick: 0 });

/** The service worker can now authenticate media: retry what failed. */
export function markSwMediaReady(): void {
    swMediaAuth.ready = true;
    swMediaAuth.retryTick++;
    if (typeof document === "undefined") return;
    for (const img of Array.from(document.images)) {
        if (img.hasAttribute("data-own-retry")) continue;
        if (!img.complete || img.naturalWidth > 0) continue;
        const src = img.currentSrc || img.src;
        if (!isAuthedMediaUrl(src)) continue;
        delete img.dataset.mediaHealed;
        img.src = src;
    }
}

// How many <img>s the healer has had to rescue this session. Logged at a few
// milestones (not per image) so the debug log shows whether media is still
// going out token-less, without flooding it.
let healCount = 0;
function logHeal(): void {
    healCount++;
    if (healCount !== 1 && healCount !== 10 && healCount !== 100) return;
    logSync(
        `media: ${healCount} image(s) failed and were re-fetched with the token` +
            ` (worker ready: ${swMediaAuth.ready}, page controlled:` +
            ` ${!!globalThis.navigator?.serviceWorker?.controller})`,
    );
}

/** Waits before each automatic retry of a transient authed-fetch failure. */
export const MEDIA_RETRY_DELAYS_MS = [1_500, 4_000, 10_000];

export interface MediaRetry {
    /** The src to bind to the `<img>` — the original URL, or a healed blob URL. */
    readonly src: string | null | undefined;
    /**
     * True once the media is genuinely unavailable: a permanent failure, or a
     * transient one that stayed failed through every retry.
     */
    readonly failed: boolean;
    /**
     * True while fetching the blob, or waiting to retry it — show a placeholder,
     * not a broken glyph.
     */
    readonly pending: boolean;
    /** Wire to the `<img>`'s `onerror`. */
    onError: () => void;
}

/**
 * Per-`<img>` heal for Svelte-rendered media (avatars, message images). Call
 * once during component init with a getter for the desired src; bind the
 * returned `src` to the `<img>` and `onError` to its `onerror`. On a load
 * failure it fetches the media with auth and swaps to a blob URL — SW-independent,
 * so it works on an uncontrolled (hard-reloaded) page. A transient failure
 * (network, 5xx, 429, 408) is retried on a backoff, and at once when the window
 * comes back online; a permanent one (401/403/404) is not retried. If the media
 * is still unavailable → `failed`, so the caller shows a placeholder.
 */
export function createMediaRetry(
    getSrc: () => string | null | undefined,
): MediaRetry {
    let effective = $state<string | null | undefined>(undefined);
    let failed = $state(false);
    let pending = $state(false);
    let blobUrl: string | null = null;
    let tried = false;
    // Bumped when the src changes or the component goes away, so a fetch or
    // timer started for an older state does nothing when it lands.
    let gen = 0;
    // Transient retries spent on the current src.
    let attempts = 0;
    let timer = 0;
    // The authed src that is waiting on a retry, or gave up for a transient
    // reason. `online` retries it straight away.
    let waitingSrc: string | null = null;

    function cancelRetry(): void {
        if (timer) clearTimeout(timer);
        timer = 0;
    }

    function startAuthed(s: string, g: number): void {
        pending = true;
        waitingSrc = null;
        void authedMediaBlobResult(s).then((r) => {
            if (g !== gen) {
                if (r.url !== null) URL.revokeObjectURL(r.url);
                return;
            }
            if (r.url !== null) {
                blobUrl = r.url;
                effective = r.url;
                pending = false;
                return;
            }
            if (r.transient) {
                waitingSrc = s;
                if (attempts < MEDIA_RETRY_DELAYS_MS.length) {
                    // Stays pending: the placeholder shows until the retry.
                    timer = window.setTimeout(() => {
                        timer = 0;
                        startAuthed(s, g);
                    }, MEDIA_RETRY_DELAYS_MS[attempts++]);
                    return;
                }
            }
            pending = false;
            failed = true;
        });
    }

    // Follow src changes (avatar swap, room switch); revoke any old blob.
    $effect(() => {
        const s = getSrc();
        untrack(() => {
            gen++;
            cancelRetry();
            waitingSrc = null;
            attempts = 0;
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                blobUrl = null;
            }
            effective = s;
            failed = false;
            pending = false;
            tried = false;
            // No worker adding the token yet: an <img> would only 401 and
            // land in onError anyway, so go straight to the authed fetch.
            if (s && !swMediaAuth.ready && isAuthedMediaUrl(s)) {
                effective = undefined;
                tried = true;
                startAuthed(s, gen);
            }
        });
    });
    // Media that gave up gets another go once the worker can authenticate it.
    $effect(() => {
        void swMediaAuth.retryTick;
        untrack(() => {
            if (!failed) return;
            failed = false;
            tried = false;
            attempts = 0;
            waitingSrc = null;
            effective = getSrc();
        });
    });
    // A transient failure is retried at once when the network is back.
    $effect(() => {
        const onOnline = () => {
            const s = waitingSrc;
            if (!s) return;
            cancelRetry();
            attempts = 0;
            failed = false;
            startAuthed(s, gen);
        };
        window.addEventListener("online", onOnline);
        return () => window.removeEventListener("online", onOnline);
    });
    // Stop and revoke on destroy.
    $effect(() => () => {
        gen++;
        cancelRetry();
        waitingSrc = null;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    });

    return {
        get src() {
            return effective;
        },
        get failed() {
            return failed;
        },
        get pending() {
            return pending;
        },
        async onError() {
            const s = getSrc();
            // A local (decrypted) blob only fails to load if the engine can't
            // decode it, so the one retry worth making there is JXL.
            const local = !!s && isLocalUrl(s);
            if (tried || !s || (!local && !isAuthedMediaUrl(s))) {
                failed = true;
                return;
            }
            tried = true;
            if (!local) {
                startAuthed(s, gen);
                return;
            }
            const g = gen;
            pending = true;
            const url = await jxlFallbackUrl(s);
            if (g !== gen) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            pending = false;
            if (url) {
                blobUrl = url;
                effective = url;
            } else {
                failed = true;
            }
        },
    };
}

// Every other authed `<img>` (reaction emotes, picker/pack grids, member
// lists, `{@html}`-injected custom emotes and mx-reply images...) is healed by
// one capture-phase error listener instead (the `error` event doesn't bubble,
// hence capture). That also covers browsers with NO service worker at all:
// Tor Browser disables them, so there every homeserver image lands here.
// `<img>`s driven by createMediaRetry carry `data-own-retry` and are skipped so
// the two don't race. Idempotent so it can be called from every app mount.
//
// Healed blobs are shared per URL (the same emote across many reactions is one
// fetch) in a small LRU. One is only revoked once no <img> on the page shows
// it; a row that comes back later starts from the authed URL and heals again.
const healCache = new BlobUrlCache(200, (url) => {
    for (const img of Array.from(document.images)) {
        if (img.src === url) return true;
    }
    return false;
});

function healedBlobUrl(src: string): Promise<string | null> {
    return healCache
        .get(src, async () => {
            const url = await (isLocalUrl(src)
                ? jxlFallbackUrl(src)
                : authedMediaBlobUrl(src));
            // Not remembered, so a later error can try again.
            if (!url) throw new Error("not healable");
            return url;
        })
        .catch(() => null);
}

let healerInstalled = false;
export function installMediaHealer(): void {
    if (healerInstalled || typeof document === "undefined") return;
    healerInstalled = true;
    document.addEventListener(
        "error",
        (e) => {
            const img = e.target;
            if (!(img instanceof HTMLImageElement)) return;
            if (img.hasAttribute("data-own-retry")) return;
            const src = img.currentSrc || img.src;
            // Keyed on the src we healed, not a one-shot flag: a reused
            // element given a NEW authed src must be healable again.
            if (img.dataset.mediaHealed === src) return;
            // Our authed media (no token / SW), or a local blob the engine
            // couldn't decode (JXL, see utils/jxl).
            if (!isAuthedMediaUrl(src) && !isLocalUrl(src)) return;
            img.dataset.mediaHealed = src;
            if (!isLocalUrl(src)) logHeal();
            const failedSrc = img.src;
            healedBlobUrl(src).then((url) => {
                // Skip if the element moved on to another src meanwhile.
                if (url && img.src === failedSrc) img.src = url;
            });
        },
        true,
    );
}
