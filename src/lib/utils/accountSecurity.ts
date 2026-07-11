/**
 * Pure helpers for the account-security settings: change-password form
 * validation, the deactivate-account typed confirmation, and a
 * User-Interactive Auth flow check. SDK-free so they can be unit-tested.
 */

/**
 * Validate the change-password form. Returns a human-readable error for the
 * first problem found, or null when the form can be submitted. Passwords are
 * compared verbatim — whitespace is significant and nothing is trimmed.
 * The server still applies its own password policy; its errors are surfaced
 * separately.
 */
export function validatePasswordChange(fields: {
    current: string;
    next: string;
    confirm: string;
}): string | null {
    if (!fields.current) return "Enter your current password.";
    if (!fields.next) return "Enter a new password.";
    if (fields.next.length < 8)
        return "New password must be at least 8 characters.";
    if (fields.next === fields.current)
        return "New password must be different from your current password.";
    if (fields.confirm !== fields.next) return "Passwords do not match.";
    return null;
}

/**
 * Whether the typed confirmation matches the account's user id closely
 * enough to arm the deactivate button. Surrounding whitespace (copy-paste
 * artifacts) is forgiven; anything else must match exactly.
 */
export function deactivationConfirmed(
    typed: string,
    userId: string | null,
): boolean {
    return !!userId && typed.trim() === userId;
}

/**
 * Whether a User-Interactive Auth challenge can be completed with just the
 * account password — i.e. some advertised flow is exactly one
 * m.login.password stage. Anything else (SSO, recaptcha, multi-stage) is
 * not something this client can drive.
 */
export function supportsPasswordUia(
    flows: { stages: string[] }[] | undefined,
): boolean {
    return (
        flows?.some(
            (f) => f.stages.length === 1 && f.stages[0] === "m.login.password",
        ) ?? false
    );
}
