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
    /** Delete this device's crypto store, when its identity is known. */
    deleteCryptoStore: () => unknown;
}

/**
 * The teardown order. Every key of SessionResourceSteps appears exactly once;
 * the first three are load-bearing (see the module comment), the rest are
 * best-effort releases whose order does not matter.
 */
const TEARDOWN_ORDER: (keyof SessionResourceSteps)[] = [
    "leaveCall",
    "disposeSync",
    "stopClient",
    "clearServiceWorkerAuth",
    "unregisterPush",
    "clearNativeSession",
    "deleteCryptoStore",
];

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
