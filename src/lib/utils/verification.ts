/**
 * Pure helpers for the SAS (emoji) verification UI: mapping a verification
 * request's phase to human wording, deriving trust badges from device/user
 * verification status, and laying out the 7-emoji SAS grid. SDK-free (takes
 * plain shapes, never a live `matrix-js-sdk` object) so it unit-tests without
 * the rust-crypto WASM.
 */

/**
 * Mirror of matrix-js-sdk's `VerificationPhase` enum (crypto-api) as plain
 * numbers. Duplicated here on purpose: importing the enum would pull the crypto
 * subpath into a module we want SDK-free and testable. crypto.ts passes the
 * real `request.phase` (same numeric values) straight into these helpers.
 */
export const VerificationPhaseValue = {
    Unsent: 1,
    Requested: 2,
    Ready: 3,
    Started: 4,
    Cancelled: 5,
    Done: 6,
} as const;

export type VerificationPhaseKind =
    | "pending"
    | "active"
    | "success"
    | "cancelled";

/**
 * Coarse state for styling and control logic: whether we're still setting up
 * (pending), actively comparing emoji (active), finished (success), or aborted
 * (cancelled). Unknown phases degrade to "pending" (safe: keeps the modal open
 * with a cancel affordance rather than falsely claiming success).
 */
export function verificationPhaseKind(phase: number): VerificationPhaseKind {
    switch (phase) {
        case VerificationPhaseValue.Started:
            return "active";
        case VerificationPhaseValue.Done:
            return "success";
        case VerificationPhaseValue.Cancelled:
            return "cancelled";
        default:
            return "pending";
    }
}

/**
 * Human-readable status line for the current phase. `isSelf` picks wording for
 * verifying one of your own sessions vs another user.
 */
export function verificationPhaseLabel(
    phase: number,
    opts: { isSelf?: boolean } = {},
): string {
    switch (phase) {
        case VerificationPhaseValue.Unsent:
        case VerificationPhaseValue.Requested:
            return "Waiting for the other side to accept…";
        case VerificationPhaseValue.Ready:
            // Method-neutral on purpose, and true where it is actually SHOWN:
            // the modal prints its own copy while the user picks a method, so
            // this only reaches the screen when there is nothing to pick (no QR
            // on either side, and the caller starts the emoji check itself).
            return "Accepted — setting up the check…";
        case VerificationPhaseValue.Started:
            // NOT "compare the emoji": a QR flow spends this entire phase
            // waiting for the other side to confirm, with no emoji in
            // existence. The compare instruction belongs next to the emoji.
            return "Verifying…";
        case VerificationPhaseValue.Done:
            return opts.isSelf ? "Session verified" : "User verified";
        case VerificationPhaseValue.Cancelled:
            return "Verification cancelled";
        default:
            return "Verifying…";
    }
}

export type TrustTone = "verified" | "unverified" | "warning";

export interface TrustBadge {
    label: string;
    tone: TrustTone;
}

/**
 * Badge for a single device from its `DeviceVerificationStatus` (reduced to the
 * one field that decides trust). A device counts as verified only when the SDK
 * says `isVerified()`; being merely signed by its owner is not enough on its own.
 */
export function deviceTrustBadge(
    status: { isVerified: boolean; signedByOwner?: boolean } | null,
): TrustBadge {
    if (status?.isVerified) return { label: "Verified", tone: "verified" };
    return { label: "Unverified", tone: "unverified" };
}

/**
 * Badge for a user from their `UserVerificationStatus`. An identity that
 * changed and needs re-approval wins over everything else (it's a security
 * signal); otherwise verified beats unverified.
 */
export function userTrustBadge(
    status: {
        isVerified: boolean;
        needsApproval?: boolean;
        known?: boolean;
    } | null,
): TrustBadge {
    if (status?.needsApproval)
        return { label: "Identity changed", tone: "warning" };
    if (status?.isVerified) return { label: "Verified", tone: "verified" };
    return { label: "Unverified", tone: "unverified" };
}

export interface SasEmoji {
    symbol: string;
    name: string;
}

/**
 * Normalize the SDK's `[emoji, name]` tuples into `{ symbol, name }` objects,
 * defensively dropping any malformed tuple (missing symbol or name) so a bad
 * payload can't render an empty cell or crash the grid.
 */
export function formatSasEmojis(
    emoji: ReadonlyArray<readonly [string, string]> | undefined,
): SasEmoji[] {
    if (!emoji) return [];
    const out: SasEmoji[] = [];
    for (const pair of emoji) {
        const symbol = pair?.[0];
        const name = pair?.[1];
        if (typeof symbol === "string" && symbol && typeof name === "string") {
            out.push({ symbol, name });
        }
    }
    return out;
}

/**
 * Split the emoji list into fixed-width rows for the grid (default 4 per row,
 * giving the canonical 4 + 3 layout for 7 emojis).
 */
export function sasEmojiRows(emojis: SasEmoji[], perRow = 4): SasEmoji[][] {
    const size = perRow > 0 ? perRow : emojis.length || 1;
    const rows: SasEmoji[][] = [];
    for (let i = 0; i < emojis.length; i += size) {
        rows.push(emojis.slice(i, i + size));
    }
    return rows;
}
