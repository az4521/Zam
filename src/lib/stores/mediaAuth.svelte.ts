import { untrack } from "svelte";
import { getActiveAccount } from "$lib/stores/accounts.svelte";

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

/** Fetch authed media with the token → object URL, or null if unavailable. */
export async function authedMediaBlobUrl(src: string): Promise<string | null> {
    const c = mediaCreds();
    if (!c || !isAuthedMediaUrl(src)) return null;
    try {
        const res = await fetch(src, {
            headers: { Authorization: `Bearer ${c.token}` },
        });
        if (!res.ok) return null;
        return URL.createObjectURL(await res.blob());
    } catch {
        return null;
    }
}

export interface MediaRetry {
    /** The src to bind to the `<img>` — the original URL, or a healed blob URL. */
    readonly src: string | null | undefined;
    /** True once the media is genuinely unavailable (auth fetch also failed). */
    readonly failed: boolean;
    /** True while fetching the blob — show a placeholder, not a broken glyph. */
    readonly pending: boolean;
    /** Wire to the `<img>`'s `onerror`. */
    onError: () => void;
}

/**
 * Per-`<img>` heal for Svelte-rendered media (avatars, message images). Call
 * once during component init with a getter for the desired src; bind the
 * returned `src` to the `<img>` and `onError` to its `onerror`. On a load
 * failure it fetches the media with auth and swaps to a blob URL — SW-independent,
 * so it works on an uncontrolled (hard-reloaded) page. If that also fails the
 * media is genuinely gone → `failed`, so the caller shows a placeholder.
 */
export function createMediaRetry(
    getSrc: () => string | null | undefined,
): MediaRetry {
    let effective = $state<string | null | undefined>(undefined);
    let failed = $state(false);
    let pending = $state(false);
    let blobUrl: string | null = null;
    let tried = false;

    // Follow src changes (avatar swap, room switch); revoke any old blob.
    $effect(() => {
        const s = getSrc();
        untrack(() => {
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
                blobUrl = null;
            }
            effective = s;
            failed = false;
            pending = false;
            tried = false;
        });
    });
    // Revoke on destroy.
    $effect(() => () => {
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
            if (tried || !s || !isAuthedMediaUrl(s)) {
                failed = true;
                return;
            }
            tried = true;
            pending = true;
            const url = await authedMediaBlobUrl(s);
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
// fetch) in a small LRU. Evicted URLs aren't revoked: an element may still
// show them, and a leaked image blob is cheaper than a broken one.
const HEAL_CACHE_MAX = 500;
const healCache = new Map<string, Promise<string | null>>();

function healedBlobUrl(src: string): Promise<string | null> {
    const hit = healCache.get(src);
    if (hit) {
        healCache.delete(src); // refresh LRU position
        healCache.set(src, hit);
        return hit;
    }
    const p = authedMediaBlobUrl(src).then((url) => {
        if (!url) healCache.delete(src); // allow a later retry
        return url;
    });
    healCache.set(src, p);
    if (healCache.size > HEAL_CACHE_MAX) {
        const oldest = healCache.keys().next().value;
        if (oldest !== undefined) healCache.delete(oldest);
    }
    return p;
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
            if (!isAuthedMediaUrl(src)) return; // not our authed media / no token
            img.dataset.mediaHealed = src;
            const failedSrc = img.src;
            healedBlobUrl(src).then((url) => {
                // Skip if the element moved on to another src meanwhile.
                if (url && img.src === failedSrc) img.src = url;
            });
        },
        true,
    );
}
