/**
 * Pure retry/backoff decision for a dropped geolocation `watchPosition`.
 *
 * A live-location share keeps one long-running watch open. When that watch
 * starts erroring persistently — not the odd POSITION_UNAVAILABLE blip, which
 * is routine — it has effectively dropped and will not recover on its own; the
 * fix is to clearWatch + re-watchPosition. This module decides WHEN to do that:
 * only after the watch has failed repeatedly (so a single blip is ignored),
 * then on an exponential backoff, and never more than a capped number of times
 * so a device with no signal at all is not hammered (audit finding LOC-01).
 *
 * No DOM/SDK/Svelte state — plain numbers in, a delay (ms) or null out.
 */

/** Consecutive transient watch errors (with no good fix in between) that mark
 *  the watch as dropped rather than merely blipping. */
export const GEO_WATCH_ERROR_THRESHOLD = 3;
/** Backoff before the first restart; doubled for each further restart. */
export const GEO_WATCH_RETRY_BASE_MS = 2000;
/** Backoff ceiling — never wait longer than this between restarts. */
export const GEO_WATCH_RETRY_MAX_MS = 30000;
/** Give up after this many restarts with no good fix in between (no spamming). */
export const GEO_WATCH_RETRY_MAX_ATTEMPTS = 5;

export interface GeoWatchRetryOptions {
    errorThreshold?: number;
    baseMs?: number;
    maxMs?: number;
    maxAttempts?: number;
}

/**
 * Delay (ms) before the next geolocation-watch restart, or null to do nothing.
 *
 * @param consecutiveErrors transient watch errors since the last good fix (or
 *   the last restart). Below `errorThreshold` this is a routine blip → null.
 * @param restarts restarts already made since the last good fix. At or past
 *   `maxAttempts` → null (give up, leave the last watch in place; the banner's
 *   "last updated at …" label already tells the user positions have gone quiet).
 *
 * Returns an exponential backoff from `baseMs`, doubled per prior restart,
 * clamped to `maxMs`. Non-finite or negative inputs → null.
 */
export function planWatchRestart(
    consecutiveErrors: number,
    restarts: number,
    opts: GeoWatchRetryOptions = {},
): number | null {
    const threshold = opts.errorThreshold ?? GEO_WATCH_ERROR_THRESHOLD;
    const base = opts.baseMs ?? GEO_WATCH_RETRY_BASE_MS;
    const max = opts.maxMs ?? GEO_WATCH_RETRY_MAX_MS;
    const cap = opts.maxAttempts ?? GEO_WATCH_RETRY_MAX_ATTEMPTS;

    if (!Number.isFinite(consecutiveErrors) || !Number.isFinite(restarts)) {
        return null;
    }
    if (restarts < 0) return null;
    if (consecutiveErrors < threshold) return null;
    if (restarts >= cap) return null;

    return Math.min(base * 2 ** restarts, max);
}
