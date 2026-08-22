import type { JoinConsentDescriptor } from "$lib/utils/joinConsent";

/**
 * Promise-based consent gate for clicking a room/alias link (audit SEC-M3).
 *
 * The click happens in MessageItem (one instance per row), so the modal lives
 * once in AppShell and reads this single-slot store. `requestJoinConsent`
 * returns a promise the caller awaits before joining; the dialog resolves it
 * via `resolveJoinConsent`.
 */
interface PendingJoinConsent extends JoinConsentDescriptor {
    resolve: (confirmed: boolean) => void;
}

class JoinConsentState {
    pending = $state<PendingJoinConsent | null>(null);
}

export const joinConsentState = new JoinConsentState();

/** Ask the user to confirm a join. A new request supersedes any open one. */
export function requestJoinConsent(
    descriptor: JoinConsentDescriptor,
): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        // A second link click while a prompt is open cancels the first rather
        // than stacking dialogs.
        joinConsentState.pending?.resolve(false);
        joinConsentState.pending = { ...descriptor, resolve };
    });
}

/** Resolve the open consent request (true = join, false = cancel). */
export function resolveJoinConsent(confirmed: boolean): void {
    const pending = joinConsentState.pending;
    if (!pending) return;
    joinConsentState.pending = null;
    pending.resolve(confirmed);
}
