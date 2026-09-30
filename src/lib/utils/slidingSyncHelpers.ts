// Pure decisions behind the sliding-sync wiring in matrix/client.ts, split out
// so they can be tested without a homeserver.

/**
 * The next range end for a growing list, or null once the window already
 * covers all `total` rooms. `end` is the inclusive index the list currently
 * requests up to.
 */
export function nextWindowEnd(
    end: number | undefined,
    total: number,
    step: number,
): number | null {
    if (end === undefined || total <= 0) return null;
    if (end + 1 >= total) return null;
    return Math.min(end + step, total - 1);
}

/**
 * Whether a failed sliding-sync probe means the homeserver lacks the endpoint
 * (so we should fall back to classic /sync). Transient failures (network
 * errors, 5xx, rate limits, auth) return false: those are not evidence the
 * server can't do it, and silently downgrading on a blip would be worse.
 */
export function isSlidingSyncUnsupportedError(err: unknown): boolean {
    const e = err as { httpStatus?: number; errcode?: string } | null;
    if (!e || typeof e !== "object") return false;
    if (e.errcode === "M_UNRECOGNIZED") return true;
    return e.httpStatus === 404 || e.httpStatus === 405 || e.httpStatus === 501;
}
