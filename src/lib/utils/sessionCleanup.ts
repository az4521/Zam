/**
 * Registry of per-session cleanup hooks.
 *
 * Module-level caches that hold per-account data register a cleanup here
 * instead of being listed by hand in each sign-out / stop / account-switch
 * path, so a newly added cache cannot be missed by one of them.
 *
 * `runSessionTeardown()` is safe to call repeatedly: every hook runs on every
 * pass, so hooks must be idempotent (clearing an empty Map is).
 */

const teardownHooks = new Set<() => void>();

/**
 * Register `fn` to run on every session teardown. Returns an unregister
 * function. Registering the same function twice keeps a single entry.
 */
export function onSessionTeardown(fn: () => void): () => void {
    teardownHooks.add(fn);
    return () => {
        teardownHooks.delete(fn);
    };
}

/**
 * Run every registered hook. A throwing hook is logged and does not stop the
 * remaining hooks from running.
 */
export function runSessionTeardown(): void {
    // Snapshot first so a hook that unregisters (or registers) during the pass
    // does not change which hooks this pass runs.
    for (const fn of [...teardownHooks]) {
        try {
            fn();
        } catch (err) {
            console.warn("[session] teardown hook failed", err);
        }
    }
}
