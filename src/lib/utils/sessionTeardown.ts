/**
 * Releasing a dead session's device resources, in the one order that is safe.
 *
 * Session expiry used to stop the Matrix client and swap to the login view
 * without ever leaving the voice call, so LiveKit — and the MICROPHONE —
 * stayed live with no UI left that could stop them (audit LIFE-01).
 *
 * Order is the whole point:
 *   - the call is left FIRST, while the client still exists and the app shell
 *     is still mounted (leaving notifies the voice store, which only mirrors
 *     it while AppShell is subscribed);
 *   - the sync listeners are detached while their client still owns the slot;
 *   - only then is the client stopped;
 *   - the remaining releases are best-effort network / storage work.
 *
 * Every step is independent and MUST NOT be awaited: the user's route back to
 * the login view is at the end of this, so a step that throws, rejects, or
 * hangs can never stop the steps after it.
 *
 * What is deliberately NOT here: the device's crypto store. Expiry releases
 * the session, never the key material — a single `M_UNKNOWN_TOKEN` (password
 * changed on another client, this device deleted elsewhere, a server hiccup)
 * would otherwise `indexedDB.deleteDatabase` the rust-crypto stores, which
 * nothing can undo. Wiping is reserved for an EXPLICIT sign-out, where
 * `logout()` does it through `client.clearStores({ cryptoDatabasePrefix })`.
 * The user settled this on 2026-07-30; `sessionTeardown.test.ts` pins it.
 */

export interface SessionResourceSteps {
    /** Leave the voice call. First: needs the live client and a mounted shell. */
    leaveCall: () => unknown;
    /** Detach this session's sync listeners, before the client is stopped. */
    disposeSync: () => unknown;
    /** Stop the Matrix client and release the module slot. */
    stopClient: () => unknown;
    /** Tell the service worker to forget the session's credentials. */
    clearServiceWorkerAuth: () => unknown;
    /** Drop the account's push registrations (networked, best effort). */
    unregisterPush: () => unknown;
    /** Clear the native (Capacitor) session mirror. */
    clearNativeSession: () => unknown;
}

/**
 * The teardown order. Every key of SessionResourceSteps appears exactly once;
 * the first three are load-bearing (see the module comment), the rest are
 * best-effort releases whose order does not matter.
 *
 * `satisfies` (rather than a type annotation) keeps the literal tuple type, so
 * the exhaustiveness proof below can read the names back out — and it already
 * rejects a name that is not a member of the interface.
 */
export const TEARDOWN_ORDER = [
    "leaveCall",
    "disposeSync",
    "stopClient",
    "clearServiceWorkerAuth",
    "unregisterPush",
    "clearNativeSession",
] as const satisfies readonly (keyof SessionResourceSteps)[];

/**
 * A release that exists on the interface but is missing from the order list
 * would simply never run — LIFE-01's exact failure mode, reached by adding a
 * step and forgetting the list. Nothing at runtime can notice that (there is
 * no step to observe), and a test would have to duplicate the list to try, so
 * the drift is caught by the type checker instead: whatever the order list
 * forgot survives this `Exclude`, and anything surviving it fails the `never`
 * constraint below, naming the forgotten member in the error.
 */
type UnreleasedStep = Exclude<
    keyof SessionResourceSteps,
    (typeof TEARDOWN_ORDER)[number]
>;
type AssertEveryStepIsReleased<Missing extends never> = Missing;
type _EveryStepIsReleased = AssertEveryStepIsReleased<UnreleasedStep>;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { then?: unknown }).then === "function"
    );
}

export function releaseSessionResources(steps: SessionResourceSteps): void {
    for (const name of TEARDOWN_ORDER) {
        try {
            const result = steps[name]();
            // Async steps are fired, never awaited — but their rejection must
            // not surface as an unhandled one.
            if (isPromiseLike(result)) result.then(undefined, () => {});
        } catch {
            // Best effort: teardown must never block the return to login.
        }
    }
}
