/**
 * Pure helpers for inviting someone to a room by a third-party identifier
 * (3PID) — email only. The SDK call and identity-server discovery live in
 * `client.ts`; this module is SDK-free so it can be unit-tested.
 */

/**
 * Validate an email address for a 3PID invite. Deliberately permissive but
 * rejects the common mistakes: surrounding whitespace is trimmed first, then
 * the address must contain no internal whitespace, exactly one "@" with a
 * non-empty local part, and a domain with a dotted label (non-empty on both
 * sides of the last dot).
 */
export function isValidEmail(address: string): boolean {
    const addr = address.trim();
    if (!addr) return false;
    if (/\s/.test(addr)) return false;
    const at = addr.indexOf("@");
    if (at <= 0) return false; // no "@", or empty local part
    if (at !== addr.lastIndexOf("@")) return false; // more than one "@"
    const domain = addr.slice(at + 1);
    const dot = domain.lastIndexOf(".");
    // domain needs a dot that is neither the first nor the last character
    if (dot <= 0 || dot === domain.length - 1) return false;
    return true;
}

export interface ThreePidInviteState {
    /** Whether the email-invite affordance should be enabled. */
    available: boolean;
    /** One-line reason shown when `available` is false. */
    reason?: string;
}

/**
 * Decide whether email invites are offered. Permission is checked before the
 * identity server: if the user can't invite at all, the email path is moot
 * regardless of IS availability.
 */
export function getThreePidInviteState(opts: {
    hasIdentityServer: boolean;
    canInvite: boolean;
}): ThreePidInviteState {
    if (!opts.canInvite) {
        return {
            available: false,
            reason: "You don't have permission to invite people to this room.",
        };
    }
    if (!opts.hasIdentityServer) {
        return {
            available: false,
            reason: "Your homeserver has no identity server, so email invites aren't available.",
        };
    }
    return { available: true };
}
