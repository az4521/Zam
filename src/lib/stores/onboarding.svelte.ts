// First-run state: the guided encryption setup dialog, and the password a
// password sign-in just used.
//
// Setting up recovery uploads cross-signing keys, which the server guards
// with the account password. Asking for it again a few seconds after the
// user typed it is the main reason first-time setup felt broken, so a
// password sign-in leaves it here, in memory only (never storage), for a
// few minutes. The setup dialog takes it once; reload, sign-out or the
// timeout drops it.

const PASSWORD_TTL_MS = 10 * 60 * 1000;
// sessionStorage, so an add-account sign-in (which reloads into the new
// account) still opens setup once it boots.
const FRESH_SIGN_IN_KEY = "zam_fresh_sign_in";

let remembered: { userId: string; password: string; at: number } | null = null;

/** Keep the password a sign-in (or registration) just used, for setup. */
export function rememberSignInPassword(userId: string, password: string): void {
    remembered = password ? { userId, password, at: Date.now() } : null;
}

/** The remembered password for `userId`, if still fresh. Does not consume it. */
export function peekSignInPassword(userId: string | null): string | null {
    if (!remembered || !userId || remembered.userId !== userId) return null;
    if (Date.now() - remembered.at > PASSWORD_TTL_MS) {
        remembered = null;
        return null;
    }
    return remembered.password;
}

/** Drop the remembered password (setup finished, or the user left). */
export function forgetSignInPassword(): void {
    remembered = null;
}

class OnboardingStore {
    /** The guided encryption setup dialog is showing. */
    encryptionSetupOpen = $state(false);
    /**
     * Opened by a fresh sign-in rather than by the user: it closes itself
     * when there turns out to be nothing to do.
     */
    automatic = $state(false);
    /** Device verification was started from the dialog; reopen once it ends. */
    resumeAfterVerification = $state(false);
}

export const onboardingState = new OnboardingStore();

/** A sign-in just landed: offer encryption setup once the app is up. */
export function markFreshSignIn(userId: string): void {
    try {
        sessionStorage.setItem(FRESH_SIGN_IN_KEY, userId);
    } catch {
        // Storage blocked: the footer nudge still leads to setup.
    }
}

/** Whether `userId` just signed in here; consumes the mark. */
export function takeFreshSignIn(userId: string | null): boolean {
    try {
        const marked = sessionStorage.getItem(FRESH_SIGN_IN_KEY);
        if (!marked || marked !== userId) return false;
        sessionStorage.removeItem(FRESH_SIGN_IN_KEY);
        return true;
    } catch {
        return false;
    }
}

/** Open the guided setup (from a nudge, or automatically after sign-in). */
export function openEncryptionSetup(automatic = false): void {
    onboardingState.automatic = automatic;
    onboardingState.encryptionSetupOpen = true;
}

export function closeEncryptionSetup(): void {
    onboardingState.encryptionSetupOpen = false;
    onboardingState.automatic = false;
}
