/**
 * A generation guard for UI surfaces that retarget while a request is still in
 * flight — a search panel whose room changes, a profile card that switches
 * user, a pinned-messages fetch that a sync re-triggers.
 *
 * Without one, the *slowest* response wins: it lands last and overwrites the
 * state of whatever the surface is showing now. With one, only the newest
 * request may write, and a superseded request reports nothing at all.
 *
 * Pure by design — no Svelte, no SDK — so the ordering rules below are unit
 * testable. Components own the state; this only answers "is this still mine?".
 */

export type StaleGuardOutcome<T> =
    | { status: "ok"; value: T }
    | { status: "error"; error: unknown }
    | { status: "stale" };

export interface StaleGuard {
    /** True once `dispose()` has run. Nothing is ever current again. */
    readonly disposed: boolean;
    /** Claim the guard for a new request, superseding any in-flight one. */
    begin(): number;
    /** Whether `token` is still the newest claim on a live guard. */
    isCurrent(token: number): boolean;
    /** Supersede everything in flight without starting a new request. */
    cancel(): void;
    /** Permanently invalidate the guard (component teardown). */
    dispose(): void;
    /**
     * Run `work` under a fresh claim and classify the outcome. Never rejects:
     * a rejection or a synchronous throw becomes `{status: "error"}`, and a
     * superseded run becomes `{status: "stale"}` however it settled — the run
     * that superseded it owns that state now.
     */
    run<T>(work: () => Promise<T> | T): Promise<StaleGuardOutcome<T>>;
}

const STALE: StaleGuardOutcome<never> = { status: "stale" };

export function createStaleGuard(): StaleGuard {
    let generation = 0;
    let disposed = false;

    const guard: StaleGuard = {
        get disposed() {
            return disposed;
        },
        begin() {
            return ++generation;
        },
        isCurrent(token: number) {
            return !disposed && token === generation;
        },
        cancel() {
            generation++;
        },
        dispose() {
            disposed = true;
            generation++;
        },
        async run<T>(work: () => Promise<T> | T) {
            // A dead component must not start new I/O.
            if (disposed) return STALE;
            const token = guard.begin();
            try {
                const value = await work();
                return guard.isCurrent(token)
                    ? ({ status: "ok", value } as const)
                    : STALE;
            } catch (error) {
                return guard.isCurrent(token)
                    ? ({ status: "error", error } as const)
                    : STALE;
            }
        },
    };

    return guard;
}
