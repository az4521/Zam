/**
 * Progress types and pure math for the one-shot full index build
 * (matrix/eventIndex buildFullIndex). No SDK or DOM imports, so it is testable.
 */

export interface FullIndexProgress {
    /** Candidate rooms whose history crawl is finished. */
    roomsDone: number;
    roomsTotal: number;
    /** Backwards pages fetched by this run. */
    pages: number;
    /** Messages newly queued into the index by this run. */
    messagesIndexed: number;
    /** Room whose page is being fetched now (set before the request). */
    currentRoomId?: string;
    currentRoomName?: string;
    /** True while the build pauses because sync has not caught up. */
    waitingForSync?: boolean;
    /** "recent": filling the stretch between the present and what the index
     *  already has; "history": walking back towards the room's first message. */
    currentPass?: "recent" | "history";
    /** How far back the current room's pass has reached (ms); 0 when it hit
     *  the start of the room; undefined before its first page. */
    currentReachedTs?: number;
    /** Rooms skipped for now after a failed page (retried later). */
    roomsRetrying?: number;
}

export type FullIndexReason =
    "complete" | "partial" | "storage" | "aborted" | "unavailable";

export interface FullIndexResult {
    reason: FullIndexReason;
    progress: FullIndexProgress;
    /** Rooms still not done when the run ended (only meaningful for partial). */
    failedRooms: number;
}

/** Which line describes the room being indexed, for the debug panel. */
export type CurrentRoomLine =
    | { kind: "none" }
    | { kind: "room"; room: string }
    | { kind: "recent"; room: string }
    | { kind: "history"; room: string; reachedTs: number }
    | { kind: "start"; room: string };

/**
 * The current-room line: a "recent" pass is catching up between the present
 * and what the index already held; a "history" pass names how far back it has
 * reached, or that it hit the room's first message (0).
 */
export function currentRoomLine(p: FullIndexProgress): CurrentRoomLine {
    if (!p.currentRoomId) return { kind: "none" };
    const room = p.currentRoomName ?? p.currentRoomId;
    if (p.currentPass === "recent") return { kind: "recent", room };
    if (p.currentPass === "history" && p.currentReachedTs !== undefined) {
        return p.currentReachedTs <= 0
            ? { kind: "start", room }
            : { kind: "history", room, reachedTs: p.currentReachedTs };
    }
    return { kind: "room", room };
}

/** Whole-number percent of rooms done. No candidate rooms counts as done. */
export function fullIndexPercent(
    roomsDone: number,
    roomsTotal: number,
): number {
    if (!(roomsTotal > 0)) return 100;
    const done = Math.min(Math.max(roomsDone, 0), roomsTotal);
    return Math.floor((done / roomsTotal) * 100);
}

/** Rooms not finished. Never negative. */
export function unfinishedRoomCount(
    roomsDone: number,
    roomsTotal: number,
): number {
    return Math.max(0, roomsTotal - Math.max(roomsDone, 0));
}

/** Thrown by raceWithTimeout when the wait ran out. */
export class WaitTimeoutError extends Error {
    constructor(ms: number) {
        super(`timed out after ${ms} ms`);
        this.name = "WaitTimeoutError";
    }
}

/**
 * Settles like `promise`, but rejects with WaitTimeoutError after `ms`, or
 * with an AbortError as soon as `signal` aborts. The underlying promise is not
 * cancelled; its late result is ignored (its rejection is still handled).
 */
export function raceWithTimeout<T>(
    promise: Promise<T>,
    ms: number,
    signal?: AbortSignal,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const abortError = () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            return e;
        };
        if (signal?.aborted) {
            reject(abortError());
            return;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
        };
        const onAbort = () => {
            finish();
            reject(abortError());
        };
        timer = setTimeout(() => {
            finish();
            reject(new WaitTimeoutError(ms));
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
        promise.then(
            (value) => {
                finish();
                resolve(value);
            },
            (err: unknown) => {
                finish();
                reject(err);
            },
        );
    });
}

/** 3210 -> "3,210". Plain digit grouping, so output is the same in every locale. */
export function groupThousands(n: number): string {
    const whole = Math.trunc(Math.max(0, n) || 0);
    return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
