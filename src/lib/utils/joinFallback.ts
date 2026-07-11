/**
 * Client-side fallback for multi-candidate joins. Some homeservers
 * (continuwuity) stop at the first `server_name` candidate that answers
 * "not found" instead of trying the rest, so a join that would succeed via
 * a later candidate fails with M_NOT_FOUND. When that happens the client
 * retries the remaining candidates one at a time.
 */

import { getErrcode } from "./knock";

/**
 * True when `candidate` appears in the error message as a whole hostname —
 * i.e. not merely as a prefix/suffix of a longer name like `matrix.org.uk`.
 */
function isImplicated(candidate: string, message: string): boolean {
    const hostChar = /[a-z0-9.-]/;
    let idx = message.indexOf(candidate);
    while (idx !== -1) {
        const before = message[idx - 1] ?? "";
        const after = message[idx + candidate.length] ?? "";
        if (!hostChar.test(before) && !hostChar.test(after)) return true;
        idx = message.indexOf(candidate, idx + 1);
    }
    return false;
}

/**
 * Given the error from a failed multi-candidate join, return the via servers
 * worth retrying individually (in the original order), or `[]` when a
 * per-candidate retry isn't warranted: the failure wasn't M_NOT_FOUND, there
 * was at most one candidate to begin with, or the error message already
 * implicates every candidate.
 */
export function viaFallbackCandidates(
    err: unknown,
    via: string[] | undefined,
): string[] {
    if (!via || via.length < 2) return [];
    if (getErrcode(err) !== "M_NOT_FOUND") return [];
    const e = err as { data?: { error?: unknown }; message?: unknown };
    const raw =
        typeof e?.data?.error === "string"
            ? e.data.error
            : typeof e?.message === "string"
              ? e.message
              : "";
    const message = raw.toLowerCase();
    return via.filter((v) => !isImplicated(v.toLowerCase(), message));
}
