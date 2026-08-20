/**
 * SDK-free pure reconciliation of two contradictory verification signals:
 * - deviceTrust.isVerified (local verification OR cross-signing)
 * - setupState (whole-account encryption posture)
 *
 * Resolves the "az contradiction" where a locally-verified-but-not-set-up
 * session would otherwise show a misleading green "verified" status.
 * The rule: only `ready` setup yields bare "verified"; a device verified
 * locally but lacking full setup reads "needs-setup" to nudge completion.
 */

import type { SecuritySetupState } from "./securityStatusView";

export type VerificationStatusKind =
    | "verified"
    | "needs-setup"
    | "unverified"
    | "unavailable";

export interface VerificationStatusView {
    kind: VerificationStatusKind;
    /** Short badge/status-row label. */
    label: string;
    /** One-sentence nudge for the app-shell indicator. */
    detail: string;
    /** Styling tone. */
    tone: "verified" | "warning" | "unverified" | "neutral";
    /** Whether the app-shell nudge should be offered (kind is a real,
     *  user-actionable problem — not loading/unavailable/verified). */
    actionable: boolean;
    /** Entry-point button label, or null when not actionable. */
    actionLabel: string | null;
}

export function reconcileVerification(args: {
    deviceTrust: { isVerified: boolean; signedByOwner?: boolean } | null;
    setupState: SecuritySetupState;
}): VerificationStatusView {
    const { deviceTrust, setupState } = args;

    switch (setupState) {
        case "loading":
            return {
                kind: "unavailable",
                label: "Checking encryption…",
                detail: "Checking encryption…",
                tone: "neutral",
                actionable: false,
                actionLabel: null,
            };

        case "unavailable":
            return {
                kind: "unavailable",
                label: "Encryption unavailable",
                detail: "Encryption unavailable",
                tone: "neutral",
                actionable: false,
                actionLabel: null,
            };

        case "read-failed":
            return {
                kind: "unavailable",
                label: "Status unavailable",
                detail: "Status unavailable",
                tone: "neutral",
                actionable: false,
                actionLabel: null,
            };

        case "ready":
            // The ONLY bare green "verified" — encryption is fully set up.
            return {
                kind: "verified",
                label: "Verified",
                detail: "This session is verified and encryption is fully set up.",
                tone: "verified",
                actionable: false,
                actionLabel: null,
            };

        case "fresh":
            return {
                kind: "needs-setup",
                label: "Not set up",
                detail: "Set up encryption to secure your messages across devices.",
                tone: "warning",
                actionable: true,
                actionLabel: "Set up",
            };

        case "partial":
            // THE az CONTRADICTION CASE: deviceTrust.isVerified can be true
            // (local verification) while setupState is partial (incomplete
            // account-level setup). This reads "needs-setup", NOT "verified".
            if (deviceTrust?.isVerified === true) {
                return {
                    kind: "needs-setup",
                    label: "Encryption setup incomplete",
                    detail: "This session is verified, but encryption setup is incomplete.",
                    tone: "warning",
                    actionable: true,
                    actionLabel: "Finish setup",
                };
            } else {
                // Device not verified or null — the user needs to verify.
                return {
                    kind: "unverified",
                    label: "Unverified",
                    detail: "This session isn't verified yet.",
                    tone: "unverified",
                    actionable: true,
                    actionLabel: "Verify",
                };
            }
    }
}
