// A mutex for backward pagination that never loses a request.
//
// Why this exists: the timeline's fill points (room open, sync PREPARED, stub
// heal, timeline reset, the top-sentinel IntersectionObserver) all funnel into
// one backfill routine guarded by a single component-scoped flag. With a plain
// boolean, a call that arrives while the flag is held is simply dropped — and
// nothing re-triggers it: the observer only fires again on an intersection
// *transition* (for a short/empty list the sentinel is already and stays
// intersecting), and the room-open effect only re-runs when the room id
// changes. So a room opened while a PREVIOUS room was still paginating (or
// while a gappy-sync scrollback recovery held the flag) could render empty and
// stay empty until the user scrolled or a live message arrived.
//
// The fix is to remember the dropped request: `tryEnter` records that someone
// was turned away, and `exit` reports it so the holder can re-run once. Several
// turned-away requests coalesce into a single re-run — the work is idempotent,
// so one catch-up pass is enough and a burst can never loop.
//
// Deliberately pure and free of any timeline/SDK knowledge so it can be tested
// exhaustively; the caller owns what "re-run" means.
export interface BackfillGate {
    /** True if the caller now holds the gate. False = turned away and remembered. */
    tryEnter(): boolean;
    /** Release. True if a request was turned away and should be re-run now. */
    exit(): boolean;
}

export function createBackfillGate(): BackfillGate {
    let busy = false;
    let pending = false;
    return {
        tryEnter(): boolean {
            if (busy) {
                pending = true;
                return false;
            }
            busy = true;
            return true;
        },
        exit(): boolean {
            busy = false;
            if (pending) {
                pending = false;
                return true;
            }
            return false;
        },
    };
}
