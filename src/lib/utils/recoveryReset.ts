/**
 * Phase machine for "reset recovery" (audit CRYPTO-01).
 *
 * The flow straddles a destructive boundary: `resetEncryption()` invalidates
 * the old recovery key and deletes the old backup, and only THEN is a new
 * recovery minted. If the second half fails, the account has no recovery at
 * all — and the old UI dropped the user back on the password step, whose
 * submit re-ran the destructive half. So once destruction has succeeded the
 * machine can only move within the repair states, which run the SETUP half
 * alone. There is no transition out of `repair` that allows destroying again,
 * and cancel is refused there: leaving quietly would strand the account.
 */
export type ResetPhase =
    | "idle"
    | "confirm"
    | "password"
    | "destroying"
    | "repair"
    | "repairing";

/** Every phase, for exhaustive tests. */
export const RESET_PHASES: ResetPhase[] = [
    "idle",
    "confirm",
    "password",
    "destroying",
    "repair",
    "repairing",
];

export type ResetEvent =
    | { type: "begin" }
    | { type: "confirmed" }
    | { type: "submit" }
    | { type: "succeeded" }
    /** The reset threw before the destructive step could take effect. */
    | { type: "failed-before-destroy" }
    /** Destruction succeeded; minting the new recovery did not. */
    | { type: "failed-after-destroy" }
    | { type: "cancel" };

export function nextResetPhase(
    phase: ResetPhase,
    event: ResetEvent,
): ResetPhase {
    switch (phase) {
        case "idle":
            return event.type === "begin" ? "confirm" : "idle";
        case "confirm":
            if (event.type === "confirmed") return "password";
            if (event.type === "cancel") return "idle";
            return "confirm";
        case "password":
            if (event.type === "submit") return "destroying";
            if (event.type === "cancel") return "idle";
            return "password";
        case "destroying":
            if (event.type === "succeeded") return "idle";
            if (event.type === "failed-before-destroy") return "password";
            if (event.type === "failed-after-destroy") return "repair";
            return "destroying";
        case "repair":
            // Deliberately absorbs cancel and every failure event: the old
            // recovery is already gone, so the only way out is a successful
            // setup. No event may return to `password`.
            return event.type === "submit" ? "repairing" : "repair";
        case "repairing":
            if (event.type === "succeeded") return "idle";
            if (
                event.type === "failed-before-destroy" ||
                event.type === "failed-after-destroy"
            ) {
                return "repair";
            }
            return "repairing";
    }
}

export interface ResetPhaseView {
    /** The destructive `resetRecovery()` call may run from here. */
    allowsDestroy: boolean;
    /** Only the non-destructive `setupRecovery()` retry may run from here. */
    allowsRepair: boolean;
    /** An action is in flight. */
    busy: boolean;
    /** The user must not be able to dismiss this as if nothing happened. */
    blocking: boolean;
}

export function resetPhaseView(phase: ResetPhase): ResetPhaseView {
    return {
        allowsDestroy: phase === "password",
        allowsRepair: phase === "repair",
        busy: phase === "destroying" || phase === "repairing",
        blocking: phase === "repair" || phase === "repairing",
    };
}
