// A minimal promise queue: tasks run strictly one at a time, in the order they
// were handed over. Pure — no SDK, no globals beyond `setTimeout`/`clearTimeout`
// (and those only when a timeout is configured) — so the ordering and the
// failure semantics are unit-testable on their own.

export interface SerialQueue {
    /**
     * Queue `task` behind everything already queued and resolve/reject with ITS
     * outcome. A task is never started before the previous one has settled — or,
     * when `timeoutMs` is configured, before it has settled OR been abandoned.
     */
    run<T>(task: () => Promise<T>): Promise<T>;
}

export interface SerialQueueOptions {
    /**
     * How long the queue waits for a task before it stops WAITING for it and
     * starts the next one. Measured from the moment that task STARTS, not from
     * the moment it was queued, so it bounds one task's own run rather than its
     * turn in the line. The abandoned task keeps running and its own caller
     * still receives its real outcome — nothing is cancelled and nothing is
     * fabricated. Omit for the strict behaviour: wait forever.
     */
    timeoutMs?: number;
    /** Diagnostic hook, called once each time a task is abandoned. */
    onTimeout?: () => void;
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
 *
 * Timeout semantics: with `timeoutMs` set, the guarantee weakens from "two
 * tasks never overlap" to "two tasks never overlap for longer than
 * `timeoutMs`". That is the intended trade — a request still outstanding after
 * the timeout is, for practical purposes, already dead (matrix-js-sdk attaches
 * no abort signal because `localTimeoutMs` is unset), and letting it block
 * every later write for the rest of the session is strictly worse than letting
 * it overlap one.
 */
export function createSerialQueue(
    options: SerialQueueOptions = {},
): SerialQueue {
    const { timeoutMs, onTimeout } = options;

    // Invariant: `tail` is a promise that only ever FULFILS. It carries "the
    // previous task has settled" — or, with a timeout, "the queue is no longer
    // waiting for it" — never how it settled.
    let tail: Promise<void> = Promise.resolve();

    return {
        run<T>(task: () => Promise<T>): Promise<T> {
            if (timeoutMs === undefined) {
                // Strict path: wait forever, and create no timer at all.
                // Byte-for-byte the behaviour of the queue before timeouts.
                // `task` runs inside .then(), so a synchronous throw becomes
                // this caller's rejection rather than escaping run().
                const result = tail.then(task);
                // Reassigned synchronously, so the queue order is the call
                // order. The NEUTRALISED copy is what the queue advances on,
                // never `result` itself: a rejection must reach its caller and
                // nobody else.
                tail = result.then(
                    () => undefined,
                    () => undefined,
                );
                return result;
            }

            // `advanced` fulfils on whichever comes first: this task settling,
            // or the queue giving up on it. It never rejects and is never handed
            // to a caller, so it is the neutralised copy the queue advances on.
            let advance!: () => void;
            const advanced = new Promise<void>((resolve) => {
                advance = resolve;
            });
            // `ReturnType<typeof setTimeout>`, never `number`: this project
            // type-checks against both the DOM and the node lib types.
            let timer: ReturnType<typeof setTimeout> | undefined;
            let timedOut = false;

            // The clock starts inside the same job that starts the task, so it
            // measures that task's own run. Arming it at queue time instead
            // would expire every waiting task at the same instant and let the
            // whole backlog stampede out in parallel.
            const result = tail.then(() => {
                timer = setTimeout(() => {
                    timedOut = true;
                    onTimeout?.();
                    advance();
                }, timeoutMs);
                return task();
            });

            // Registered on `result` before any caller can attach anything, so
            // the timer is already gone when the caller's own `await` resumes: a
            // settled write must not leave a live timer behind, not even for one
            // microtask. Both channels run it — the queue must advance past a
            // rejection without adopting it.
            const finish = () => {
                clearTimeout(timer);
                // Resolving twice is a no-op, but skipping it keeps the
                // late-settle path from doing anything observable at all.
                if (!timedOut) advance();
            };
            void result.then(finish, finish);

            // Reassigned synchronously, so the queue order is the call order.
            tail = advanced;
            return result;
        },
    };
}
