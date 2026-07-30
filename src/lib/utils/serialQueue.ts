// A minimal promise queue: tasks run strictly one at a time, in the order they
// were handed over. Pure — no timers, no SDK, no globals — so the ordering and
// the failure semantics are unit-testable on their own.

export interface SerialQueue {
    /**
     * Queue `task` behind everything already queued and resolve/reject with ITS
     * outcome. A task is never started before the previous one has settled.
     */
    run<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * Why this exists: an operation that writes shared state and then re-reads that
 * same state to verify the write cannot tolerate interleaving. Two overlapping
 * push-rule writes each issue `GET /pushrules`; the first request can be sent
 * before the second write lands yet resolve after it, so the first verification
 * sees the *other* change (a spurious "did not change" error) and its stale
 * snapshot then becomes the canonical cache the UI reads.
 *
 * Failure semantics, deliberately: the queue SURVIVES a rejection without
 * ADOPTING it. Chaining the raw task promise (`tail = tail.then(task)`) would
 * hand one caller's failure to the next task and skip it; the `static/sw.js`
 * shape (`queue = queue.then(run, run)`) keeps the chain alive but loses the
 * failure entirely. Here the caller — and only the caller — sees the rejection,
 * while the queue advances on a neutralised copy.
 */
export function createSerialQueue(): SerialQueue {
    // Invariant: `tail` is a promise that only ever FULFILS. It carries "the
    // previous task has settled", never how it settled.
    let tail: Promise<void> = Promise.resolve();

    return {
        run<T>(task: () => Promise<T>): Promise<T> {
            // Reassigned synchronously, so the queue order is the call order.
            // `task` runs inside .then(), so a synchronous throw becomes this
            // caller's rejection rather than escaping run().
            const result = tail.then(task);
            tail = result.then(
                () => undefined,
                () => undefined,
            );
            return result;
        },
    };
}
