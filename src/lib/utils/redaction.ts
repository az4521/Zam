/**
 * May the current user redact (delete) this event?
 *
 * Own events are always offered - the server enforces the send level for a
 * self-redaction, which is normally `events_default` (0) and thus already
 * satisfied, so gating it client-side would only hide a working button.
 * Another user's event requires the room's `redact` power level.
 *
 * Callers pass an ALREADY-EFFECTIVE `myPowerLevel` (the v12 creator lift is
 * folded in by getMyPowerLevel / getUserPowerLevel), so this stays a plain
 * numeric comparison with no SDK knowledge.
 */
export function mayRedactEvent(params: {
    isOwnEvent: boolean;
    myPowerLevel: number;
    redactLevel: number;
}): boolean {
    return params.isOwnEvent || params.myPowerLevel >= params.redactLevel;
}

/**
 * Normalize a raw reason input to a trimmed string, or undefined when blank,
 * so an empty box sends no `reason` at all rather than an empty one.
 */
export function normalizeRedactionReason(raw: string): string | undefined {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
