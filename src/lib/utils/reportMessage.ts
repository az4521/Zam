export interface ReportPayload {
    reason: string;
    score: number;
}

/** A report can be submitted once the reason has non-whitespace content. */
export function canSubmitReport(reason: string): boolean {
    return reason.trim().length > 0;
}

/**
 * Build the `reportEvent` payload: trimmed reason, and a score of -100
 * ("most offensive" per the spec) when flagged, else 0 (inoffensive default).
 */
export function buildReport(reason: string, offensive: boolean): ReportPayload {
    return { reason: reason.trim(), score: offensive ? -100 : 0 };
}

/**
 * Human-readable message from a thrown SDK error. MatrixError carries the
 * server's own wording in `data.error`; plain Errors have `message`; anything
 * else gets a generic fallback.
 */
export function reportErrorMessage(err: unknown): string {
    if (err && typeof err === "object") {
        const data = (err as { data?: { error?: unknown } }).data;
        if (data && typeof data.error === "string" && data.error) {
            return data.error;
        }
        const message = (err as { message?: unknown }).message;
        if (typeof message === "string" && message) return message;
    }
    return "Failed to send report";
}
