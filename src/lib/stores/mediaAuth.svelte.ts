import { untrack } from "svelte";

/**
 * Authenticated Matrix media (avatars, images, thumbnails) is served from
 * `/_matrix/client/v1/media/...`, which needs an `Authorization` header. An
 * `<img>` can't send one, so the media service worker injects it — but only
 * once it BOTH controls the page and holds a token. On a fresh load, a hard
 * reload, or right after a SW update there's a window where neither is true, so
 * those requests 401 and the image renders broken. Without recovery it stays
 * broken until a full manual reload ("horrible UX", reported 2026-08-16).
 *
 * `initServiceWorker` (client.ts) flips this to ready when the SW announces
 * `MEDIA_AUTH_READY` (activated + holding a token) or is already controlling us.
 * `createMediaRetry` lets each media `<img>` hold a 401 until then and retry,
 * so the page self-heals instead of needing a reload.
 */
export const mediaAuthState = $state({ ready: false, tick: 0 });

/**
 * The media service worker can now authenticate media. Bumps `tick` so held
 * retries re-fire on every (re-)ready — a new controller after an account
 * switch or SW update announces again.
 */
export function signalMediaAuthReady() {
    mediaAuthState.ready = true;
    mediaAuthState.tick++;
    scheduleHeal();
}

// Re-request broken authenticated-media <img>s injected via {@html} — custom
// emotes and mx-reply images inside `.message-body` — so they load now that the
// worker can add the token. Without this they stay broken until a full reload
// (createMediaRetry can't reach them: they aren't Svelte-rendered elements).
// Scoped to `.message-body` on purpose: component <img>s (avatars, message
// images) retry themselves, and poking their `src` here would fight Svelte's
// ownership and fire a spurious onerror. Clearing then re-setting `src` forces
// the reload even though the URL is unchanged; these have no onerror to trip.
export function healBrokenMedia(): void {
    if (typeof document === "undefined") return;
    for (const img of document.querySelectorAll<HTMLImageElement>(
        ".message-body img",
    )) {
        if (
            img.complete &&
            img.naturalWidth === 0 &&
            img.src.includes("/_matrix/client/v1/media/")
        ) {
            const src = img.src;
            img.src = "";
            img.src = src;
        }
    }
}

function scheduleHeal(): void {
    if (typeof document === "undefined") return;
    // Now (for media already broken) plus a couple of delayed passes to catch
    // requests that were still in flight when auth became ready.
    queueMicrotask(healBrokenMedia);
    setTimeout(healBrokenMedia, 400);
    setTimeout(healBrokenMedia, 1500);
}

export interface MediaRetry {
    /** Bump this in a `{#key}` around the `<img>` to remount and re-request it. */
    readonly key: number;
    /** True once the media is genuinely unavailable (failed with the SW ready). */
    readonly failed: boolean;
    /** True while holding a failure, waiting for media auth so we can retry. Show
     *  a placeholder over these to avoid a broken-image glyph — but only where
     *  hiding the `<img>` won't drop reserved layout space (e.g. fixed-size
     *  avatars, not message images that reserve their box via width/height). */
    readonly pending: boolean;
    /** Wire to the `<img>`'s `onerror`. */
    onError: () => void;
    /** Call when the `src` changes (avatar swap, room switch) to start fresh. */
    reset: () => void;
}

/**
 * Per-`<img>` retry state. Call once during component init.
 *
 * - error while the SW isn't ready yet → hold (the media probably just needs the
 *   token); retry automatically the moment media auth becomes ready.
 * - error while the SW IS ready → the media is genuinely missing → `failed`, so
 *   the caller shows a placeholder instead of a broken-image glyph.
 */
export function createMediaRetry(): MediaRetry {
    let key = $state(0);
    let failed = $state(false);
    let waiting = $state(false);

    $effect(() => {
        mediaAuthState.tick; // re-run on each (re-)ready
        if (mediaAuthState.ready && waiting && !failed) {
            untrack(() => {
                waiting = false;
                key++;
            });
        }
    });

    return {
        get key() {
            return key;
        },
        get failed() {
            return failed;
        },
        get pending() {
            return waiting;
        },
        onError() {
            if (mediaAuthState.ready) failed = true;
            else waiting = true;
        },
        reset() {
            untrack(() => {
                key = 0;
                failed = false;
                waiting = false;
            });
        },
    };
}
