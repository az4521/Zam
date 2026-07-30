/**
 * Ordering for an EXPLICIT logout, extracted so the ordering itself is testable.
 *
 * The local wipe must not be sequenced behind the network call. `AppShell`
 * gives logout a bounded 4s window and then reloads, so awaiting a hung
 * `POST /logout` first means the sync store and the plaintext rust-crypto
 * store can survive sign-out (audit CRYPTO-04).
 *
 * `invalidateSession` is still STARTED first: in matrix-js-sdk,
 * `client.logout(true)` stops the client and aborts in-flight requests
 * synchronously before issuing the request, and `clearStores()` throws while
 * the client is running. So dispatch, don't await.
 */
export interface LogoutTarget {
    /** Invalidate the access token server-side. Also stops the client. */
    invalidateSession(): Promise<unknown>;
    /** Delete the local sync + crypto stores. */
    wipeLocalStores(): Promise<unknown>;
}

export interface LogoutOutcome {
    /**
     * We called `invalidateSession()`. Calling it is what stops the client, so
     * this stays `true` even if the call rejected or threw synchronously — it
     * is NOT a claim that the server accepted the logout, and the request may
     * still be in flight when this resolves.
     */
    invalidationStarted: boolean;
    /** The local wipe completed without throwing. */
    localWipeOk: boolean;
}

export async function runLogoutSequence(
    target: LogoutTarget,
): Promise<LogoutOutcome> {
    let invalidationStarted = true;
    try {
        // Dispatch only — never await. A rejection here is expected on a dead
        // network and must not become an unhandled rejection.
        void Promise.resolve(target.invalidateSession()).catch(() => {});
    } catch {
        // A synchronous throw still means we tried; the client-stopping side
        // effect either happened or there was no client to stop.
    }
    let localWipeOk = true;
    try {
        await target.wipeLocalStores();
    } catch {
        localWipeOk = false;
    }
    return { invalidationStarted, localWipeOk };
}
