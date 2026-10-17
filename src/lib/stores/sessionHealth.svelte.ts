/**
 * Reactive session-health flags for the app-shell degradation surfaces
 * (audit SEC-M6). `crypto.ts` and `client.ts` mirror their otherwise-silent
 * failures here so AppShell can show a banner / toast.
 */
class SessionHealthState {
    // null = crypto init has not finished (banner hidden); true = available;
    // false = init failed this session (banner shown).
    cryptoAvailable = $state<boolean | null>(null);
    // True when the IndexedDB sync store failed and we fell back to memory
    // (no offline cache; full re-sync next boot).
    syncStoreFallback = $state(false);
    // The user dismissed the crypto banner for this session.
    cryptoBannerDismissed = $state(false);
    // Sync was not started because crypto failed and it would have deleted
    // the room keys sent to this session (see startSync in client.ts).
    syncHeldForCrypto = $state(false);
}

export const sessionHealthState = new SessionHealthState();

/** Record crypto availability. Any non-failed status clears a stale dismiss. */
export function setSessionCryptoStatus(status: boolean | null): void {
    sessionHealthState.cryptoAvailable = status;
    if (status !== false) sessionHealthState.cryptoBannerDismissed = false;
}

export function markSyncStoreFallback(): void {
    sessionHealthState.syncStoreFallback = true;
}

export function resetSyncStoreFallback(): void {
    sessionHealthState.syncStoreFallback = false;
}

export function setSyncHeldForCrypto(held: boolean): void {
    sessionHealthState.syncHeldForCrypto = held;
}

export function dismissCryptoBanner(): void {
    sessionHealthState.cryptoBannerDismissed = true;
}

/** Whether the crypto-unavailable banner should be visible right now. */
export function shouldShowCryptoBanner(): boolean {
    // Not dismissible while sync is held: it's the only explanation for a
    // session that has stopped updating.
    if (sessionHealthState.syncHeldForCrypto) return true;
    return (
        sessionHealthState.cryptoAvailable === false &&
        !sessionHealthState.cryptoBannerDismissed
    );
}
