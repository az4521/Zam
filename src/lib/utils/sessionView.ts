export type RootView = "shell" | "splash" | "login";

export interface RootViewInput {
    isAuthenticated: boolean;
    restoring: boolean;
}

/** Which of the three root views to render. authenticated → shell; else
 *  restoring → splash; else login. */
export function rootView(input: RootViewInput): RootView {
    if (input.isAuthenticated) return "shell";
    if (input.restoring) return "splash";
    return "login";
}

/** Whether a fresh load should attempt a silent session restore (→ show splash,
 *  not login): a stored session exists AND we are not in add-account mode. */
export function shouldRestoreSession(input: {
    hasStoredSession: boolean;
    isAddAccountMode: boolean;
}): boolean {
    return input.hasStoredSession && !input.isAddAccountMode;
}
