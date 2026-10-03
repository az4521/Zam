// A short, in-memory record of what the sync loop did: restarts, failed
// requests, timeline resets and crashes. Shown under Settings > Debug Info so
// a stuck sync on a phone (no dev console) can be diagnosed after the fact.
// Holds room ids and error codes only, never message content.

const MAX_ENTRIES = 60;

const entries: string[] = [];

export function logSync(message: string): void {
    entries.push(`${new Date().toISOString().slice(11, 23)} ${message}`);
    if (entries.length > MAX_ENTRIES)
        entries.splice(0, entries.length - MAX_ENTRIES);
}

/** Oldest first. A copy, so callers can't edit the log. */
export function getSyncLog(): string[] {
    return [...entries];
}

/** A one-line description of a sync error for the log. */
export function describeSyncError(err: unknown): string {
    const e = err as {
        httpStatus?: number;
        errcode?: string;
        name?: string;
        message?: string;
    } | null;
    if (!e) return String(err);
    const parts = [
        e.httpStatus ? `HTTP ${e.httpStatus}` : null,
        e.errcode ?? null,
        e.name && e.name !== "Error" ? e.name : null,
        e.message ? e.message.slice(0, 160) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : String(err);
}
