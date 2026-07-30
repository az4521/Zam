/**
 * Collapse concurrent calls that share a key onto a single in-flight promise.
 *
 * Built for `createDirectMessage`: creating a DM now waits for the new room to
 * reach the SDK store, so it can hold for seconds, and its "reuse the existing
 * DM" check reads `m.direct` account data that the *other* create has not
 * written yet. Two overlapping creates therefore both miss the check and leave
 * the user with two DM rooms for one contact. Per-component guards cannot close
 * that: the menu unmounts on a backdrop click (fresh component, fresh guard),
 * and two different surfaces can be open at once. The dedupe has to live at the
 * shared boundary.
 *
 * No imports, so it can be unit-tested — the house pattern (see
 * `roomArrival.ts`). The caller owns the work; this only decides whether to
 * start it.
 */
export interface InFlightByKey<T> {
    /**
     * Run `start()` for `key`, or join the call already running for it. The
     * joiner gets the SAME promise: same value, same failure.
     */
    run(key: string, start: () => Promise<T>): Promise<T>;
    /** How many keys are in flight. Diagnostics and leak assertions. */
    size(): number;
}

export function createInFlightByKey<T>(): InFlightByKey<T> {
    const inFlight = new Map<string, Promise<T>>();

    return {
        run(key, start) {
            const joined = inFlight.get(key);
            if (joined) return joined;

            // Released on rejection as well as resolution. Keeping a rejected
            // promise in the map would hand the same old failure to every later
            // caller for this key — one flaky create would disable that
            // contact's Message button for the rest of the session.
            const running: Promise<T> = start().finally(() => {
                if (inFlight.get(key) === running) inFlight.delete(key);
            });
            inFlight.set(key, running);
            return running;
        },
        size: () => inFlight.size,
    };
}
