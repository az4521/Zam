// Pure rules for modal widgets (MSC2790). A modal widget gets no prompt of its
// own: whatever it asks for is limited to what its opener already holds.

/** The slice of an approval the modal rules read. */
export interface OpenerApproval {
    capabilities: readonly string[];
    openId: boolean | null;
}

/**
 * The capabilities a modal may hold: the ones it requested that the opener's
 * approval already covers. Nothing is asked of the user.
 */
export function modalCapabilityGrant(
    opener: OpenerApproval | null,
    requested: ReadonlySet<string>,
): Set<string> {
    const have = new Set(opener?.capabilities ?? []);
    return new Set([...requested].filter((c) => have.has(c)));
}

/** A modal may get an OpenID token only when the opener already may. */
export function modalOpenIdGrant(opener: OpenerApproval | null): boolean {
    return opener?.openId === true;
}
