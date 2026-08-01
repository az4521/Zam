/**
 * Session startup as ONE transaction.
 *
 * A login or a session restore may only become observable — AppShell mounted,
 * the account persisted — once the sync loop is actually running. The root
 * route used to flip `auth.isAuthenticated` (and, on the login path, persist
 * the account) BEFORE awaiting `startSync`, so a failed startup left the shell
 * rendered over a dead client and left the error landing in an already
 * unmounted LoginView (audit AUTH-01).
 *
 * Deferring the flip introduces the opposite hazard: the token can be revoked
 * WHILE startup runs, in which case the expiry teardown happens first and a
 * late "startup finished" must not resurrect the session on top of it. Every
 * attempt therefore carries a monotonic id, and both an expiry and a newer
 * attempt mint a new one — a result whose id is no longer live is dropped.
 *
 * Pure and framework-free: the route owns every side effect. An ignored event
 * returns the SAME state object, which is how callers tell "this result was
 * applied" from "this result was too late to matter".
 */

export type SessionStartupPhase = "idle" | "starting" | "active" | "failed";

export interface SessionStartupState {
    readonly phase: SessionStartupPhase;
    /** Id of the newest attempt. Strictly increasing, never reused. */
    readonly attempt: number;
    /** Failure text for the login view, or null. */
    readonly error: string | null;
}

export const IDLE_SESSION_STARTUP: SessionStartupState = {
    phase: "idle",
    attempt: 0,
    error: null,
};

export type SessionStartupEvent =
    /** A login or restore is starting: supersedes anything in flight. */
    | { type: "begin" }
    /** `attempt`'s sync loop is running. */
    | { type: "succeeded"; attempt: number }
    /** `attempt` could not start a session. */
    | { type: "failed"; attempt: number; error: string }
    /** The session died from the outside (token revoked). */
    | { type: "invalidated"; error: string };

export function reduceSessionStartup(
    state: SessionStartupState,
    event: SessionStartupEvent,
): SessionStartupState {
    if (event.type === "begin")
        return { phase: "starting", attempt: state.attempt + 1, error: null };
    if (event.type === "invalidated")
        return {
            phase: "failed",
            attempt: state.attempt + 1,
            error: event.error,
        };
    // Anything reported by an attempt that is no longer the live one is a
    // result the app has already moved past.
    if (!isLiveAttempt(state, event.attempt)) return state;
    if (event.type === "succeeded")
        return { phase: "active", attempt: state.attempt, error: null };
    return { phase: "failed", attempt: state.attempt, error: event.error };
}

/**
 * Whether `attempt` is still the startup the app is waiting on — false once it
 * has committed, failed, or been superseded by an expiry or a newer attempt,
 * which is exactly when its result must be discarded instead of applied.
 */
export function isLiveAttempt(
    state: SessionStartupState,
    attempt: number,
): boolean {
    return state.phase === "starting" && state.attempt === attempt;
}
