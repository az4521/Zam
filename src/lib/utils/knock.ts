/**
 * Pure helpers for the knock-to-join flow: deciding when a failed join should
 * offer "Request to join" instead, and shaping the knock request options.
 */

export interface KnockOpts {
    reason?: string;
    viaServers?: string[];
}

/** Join rules under which a room accepts knocks (MSC2403 / MSC3787). */
export function isKnockJoinRule(rule: string | null | undefined): boolean {
    return rule === "knock" || rule === "knock_restricted";
}

/**
 * Extract the Matrix errcode from a thrown error. MatrixError exposes it at
 * the top level; some shapes only carry it in the response body (`data`).
 */
export function getErrcode(err: unknown): string | undefined {
    if (typeof err !== "object" || err === null) return undefined;
    const e = err as { errcode?: unknown; data?: { errcode?: unknown } };
    if (typeof e.errcode === "string") return e.errcode;
    if (typeof e.data?.errcode === "string") return e.data.errcode;
    return undefined;
}

/**
 * Decide whether a failed join should offer "Request to join". Only a
 * M_FORBIDDEN rejection qualifies, and only when the room's join rule is
 * knockable — or unknown (no local state for the room), in which case the
 * knock attempt itself is the cheapest way to learn the server's verdict.
 */
export function shouldOfferKnock(
    err: unknown,
    joinRule?: string | null,
): boolean {
    if (getErrcode(err) !== "M_FORBIDDEN") return false;
    return joinRule == null || isKnockJoinRule(joinRule);
}

/**
 * User-facing message for a failed Matrix request: the server's own error
 * string when present, otherwise the JS error message, otherwise a fallback.
 */
export function matrixErrorMessage(err: unknown, fallback: string): string {
    if (typeof err === "object" && err !== null) {
        const e = err as { data?: { error?: unknown }; message?: unknown };
        if (typeof e.data?.error === "string" && e.data.error) {
            return e.data.error;
        }
        if (typeof e.message === "string" && e.message) return e.message;
    }
    return fallback;
}

/** Build the SDK knock options, dropping empty reason/via values. */
export function buildKnockOpts(reason?: string, via?: string[]): KnockOpts {
    const opts: KnockOpts = {};
    const trimmed = reason?.trim();
    if (trimmed) opts.reason = trimmed;
    if (via?.length) opts.viaServers = via;
    return opts;
}

/**
 * Extract a trimmed, non-empty knock `reason` from an m.room.member content
 * object (the incoming-knock side; see buildKnockOpts for the outgoing side).
 * Total: returns undefined for any shape without a usable string reason. The
 * result is untrusted user text — render it escaped, never via {@html}.
 */
export function knockReasonFromContent(content: unknown): string | undefined {
    if (typeof content !== "object" || content === null) return undefined;
    const reason = (content as { reason?: unknown }).reason;
    if (typeof reason !== "string") return undefined;
    const trimmed = reason.trim();
    return trimmed ? trimmed : undefined;
}
