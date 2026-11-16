// Pure helpers for the native history prefetch (src/lib/matrix/historyPrefetch.ts,
// HistoryPrefetchPlugin.java). No SDK or Capacitor imports, so they test in isolation.

/** A crawl row as eventIndex.ts keeps it: the room's next token and whether it is finished. */
export interface PrefetchCrawlRow {
    roomId: string;
    from: string | null;
    done: boolean;
}

/** A room in a prefetch plan: `from` is the token the crawler will request next. */
export interface PrefetchRoomStart {
    roomId: string;
    from: string;
}

/** What setPlan sends to native. */
export interface PrefetchPlanInput {
    accountKey: string;
    baseUrl: string;
    accessToken: string;
    /** The /messages filter, already JSON-encoded. */
    filter: string;
    pageSize: number;
    rooms: PrefetchRoomStart[];
}

/** A page taken from native storage, with its chunk parsed. */
export interface TakenPrefetchPage {
    chunk: unknown[];
    end: string | null;
    fetchedAt: number;
}

/** Storage and last-run report for one account. */
export interface PrefetchStatus {
    pages: number;
    bytes: number;
    rooms: number;
    lastRunAt: number | null;
    lastError: string | null;
    lastResult: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Rooms worth prefetching: unfinished rooms with a token. Finished rooms
 * are skipped, and so are rooms with no token (the crawler fetches their
 * first page live). A room listed twice keeps its first row.
 */
export function buildPrefetchRooms(
    rows: readonly PrefetchCrawlRow[],
): PrefetchRoomStart[] {
    const seen = new Set<string>();
    const out: PrefetchRoomStart[] = [];
    for (const row of rows) {
        if (row.done || row.from === null || row.from === "") continue;
        if (seen.has(row.roomId)) continue;
        seen.add(row.roomId);
        out.push({ roomId: row.roomId, from: row.from });
    }
    return out;
}

/**
 * Validate the object takePage resolves with. Native returns the chunk as
 * JSON text so a large page crosses the bridge as one string. Returns null
 * for anything that is not a found page with a parseable array chunk.
 */
export function parseTakenPrefetchPage(raw: unknown): TakenPrefetchPage | null {
    if (!isRecord(raw) || raw.found !== true) return null;
    if (typeof raw.chunk !== "string") return null;
    let chunk: unknown;
    try {
        chunk = JSON.parse(raw.chunk);
    } catch {
        return null;
    }
    if (!Array.isArray(chunk)) return null;
    let end: string | null;
    if (raw.end === null || raw.end === undefined) end = null;
    else if (typeof raw.end === "string") end = raw.end;
    else return null;
    if (typeof raw.fetchedAt !== "number" || !Number.isFinite(raw.fetchedAt))
        return null;
    return { chunk, end, fetchedAt: raw.fetchedAt };
}

const nonNegInt = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Validate the object status resolves with. */
export function parsePrefetchStatus(raw: unknown): PrefetchStatus | null {
    if (!isRecord(raw)) return null;
    if (!nonNegInt(raw.pages) || !nonNegInt(raw.bytes) || !nonNegInt(raw.rooms))
        return null;
    const lastRunAt =
        raw.lastRunAt === null || raw.lastRunAt === undefined
            ? null
            : raw.lastRunAt;
    if (lastRunAt !== null && typeof lastRunAt !== "number") return null;
    const lastError = typeof raw.lastError === "string" ? raw.lastError : null;
    const lastResult =
        typeof raw.lastResult === "string" ? raw.lastResult : null;
    return {
        pages: raw.pages,
        bytes: raw.bytes,
        rooms: raw.rooms,
        lastRunAt,
        lastError,
        lastResult,
    };
}
