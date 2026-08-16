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

// `{@html}`-injected media (custom emotes, mx-reply images) can't use the
// composable — they aren't Svelte-rendered elements. A single capture-phase
// error listener heals them in place (the `error` event doesn't bubble, hence
// capture). Scoped to `.message-body` so component `<img>`s keep their own
// state, and idempotent so it can be called from every app mount.
let healerInstalled = false;
export function installMediaHealer(): void {
    if (healerInstalled || typeof document === "undefined") return;
    healerInstalled = true;
    document.addEventListener(
        "error",
        (e) => {
            const img = e.target;
            if (!(img instanceof HTMLImageElement) || img.dataset.mediaHealed)
                return;
            if (!img.closest(".message-body")) return;
            const src = img.currentSrc || img.src;
            if (!isAuthedMediaUrl(src)) return; // not our authed media / no token
            img.dataset.mediaHealed = "1";
            authedMediaBlobUrl(src).then((url) => {
                if (url) img.src = url;
            });
        },
        true,
    );
}
