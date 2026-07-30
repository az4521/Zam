/**
 * Ordering for an EXPLICIT logout, extracted so the ordering itself is testable.
 *
 * Two properties, and the whole point is that they hold together:
 *
 * 1. **The local wipe is never sequenced behind the network call.** `AppShell`
 *    gives logout a bounded 4s window and then reloads, so awaiting a hung
 *    `POST /logout` first means the sync store and the plaintext rust-crypto
 *    store can survive sign-out (audit CRYPTO-04).
 * 2. **The network invalidation still gets the remainder of the caller's
 *    window.** Once the wipe is done we await the already-dispatched
 *    invalidation, so the caller's bound — `AppShell`'s
 *    `Promise.race([logout(), 4000ms])`, the only bound there is or needs to
 *    be — is spent on invalidating the access token server-side rather than
 *    killing that request at `window.location.assign`. Resolving the moment
 *    the wipe finished would leave a live token behind.
 *
 * `invalidateSession` is STARTED first because that is what makes the wipe
 * legal: in matrix-js-sdk, `client.logout(true)` stops the client and aborts
 * in-flight requests synchronously before issuing the request, and
 * `clearStores()` throws while the client is running. So dispatch first, await
 * last.
 */
export interface LogoutTarget {
    /** Invalidate the access token server-side. Also stops the client. */
    invalidateSession(): Promise<unknown>;
    /** Delete the local sync + crypto stores. */
    wipeLocalStores(): Promise<unknown>;
    /** Release local references. Runs after the wipe settles, before the
     *  network invalidation is awaited, so a hung /logout can't strand a
     *  stopped client in the module slot. */
    onLocalWipeSettled?(): void;
}

export interface LogoutOutcome {
    /**
     * The call was dispatched: `invalidateSession()` returned without throwing,
     * so the request is out and its client-stopping side effect has happened.
     * This is NOT a claim that the server accepted the logout — see
     * `invalidationOk` for that, and expect `true` here with `false` there
     * whenever the network is down.
     *
     * `false` means the call could not even be dispatched (it threw
     * synchronously), so the client may never have been stopped and no request
     * was ever made.
     */
    invalidationStarted: boolean;
    /**
     * The invalidation resolved, i.e. the access token really is dead
     * server-side. `false` means it rejected, or throwing synchronously meant
     * it never went out at all — the device may still be usable until the
     * token expires, and the user should revoke it from Settings.
     *
     * Note this is only ever observable when the caller waits for the whole
     * sequence; a caller that abandons it early (a bounded race) learns
     * nothing either way, which is not the same thing as `false`.
     */
    invalidationOk: boolean;
    /** The local wipe completed without throwing. */
    localWipeOk: boolean;
}

export async function runLogoutSequence(
    target: LogoutTarget,
): Promise<LogoutOutcome> {
    let invalidationStarted = true;
    // Attach the handlers at DISPATCH time, not after the wipe: the request can
    // settle while we are awaiting the wipe, and a rejection landing in that gap
    // with nothing attached is an unhandled rejection. `then(ok, fail)` records
    // the result without ever rejecting this promise.
    let invalidationSettled: Promise<boolean> | null = null;
    try {
        invalidationSettled = Promise.resolve(target.invalidateSession()).then(
            () => true,
            () => false,
        );
    } catch {
        // Never dispatched, so the client may still be running and nothing is
        // in flight for the await below to wait on. Report it rather than
        // claiming we asked the server anything.
        invalidationStarted = false;
    }
    let localWipeOk = true;
    try {
        await target.wipeLocalStores();
    } catch {
        localWipeOk = false;
    }
    // Drop local references now, while the invalidation may still be in flight.
    // Sequencing this behind the network would leave a caller holding a stopped
    // client for the whole window. A throwing hook is the caller's problem and
    // must not change what we report.
    try {
        target.onLocalWipeSettled?.();
    } catch {
        // ignore
    }
    // The wipe has already happened, so this await cannot delay it — it only
    // spends the caller's remaining window on the token invalidation. Runs even
    // when the wipe failed: a live token is worth killing either way.
    const invalidationOk = invalidationSettled
        ? await invalidationSettled
        : false;
    return { invalidationStarted, invalidationOk, localWipeOk };
}
