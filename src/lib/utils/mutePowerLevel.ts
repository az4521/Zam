/**
 * Power level validation that allows muting (negative power levels).
 *
 * The Matrix spec allows power levels to be negative for muting users (typically
 * -1). This extends the basic power level validation to support muting while
 * maintaining all other validation rules.
 */

export interface ParseMutePowerLevelResult {
    ok: boolean;
    /** The parsed level when ok; null otherwise. */
    value: number | null;
    /** Empty when ok; else a user-facing reason. */
    error: string;
}

/**
 * Special power level value for muting a user. Matrix allows any negative
 * value, but -1 is the conventional mute level.
 */
export const MUTE_POWER_LEVEL = -1;

/**
 * Validate a hand-typed power level that may include muting. Accepts:
 * - The special mute value (-1)
 * - Whole, non-negative integers in [0, ceiling]
 *
 * Rejects any other negative values (< -1) as they're not meaningful mute
 * levels and may indicate user error.
 */
export function parseMutePowerLevelInput(
    raw: string,
    ceiling: number,
): ParseMutePowerLevelResult {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, value: null, error: "Enter a power level" };
    }
    if (!/^-?\d+$/.test(trimmed)) {
        return { ok: false, value: null, error: "Must be a whole number" };
    }
    const value = Number(trimmed);

    // Accept the conventional mute level
    if (value === MUTE_POWER_LEVEL) {
        return { ok: true, value, error: "" };
    }

    // Reject other negatives as likely mistakes
    if (value < 0) {
        return {
            ok: false,
            value: null,
            error: `Use ${MUTE_POWER_LEVEL} to mute`,
        };
    }

    if (value > ceiling) {
        return {
            ok: false,
            value: null,
            error: `You can't set a level above your own (${ceiling})`,
        };
    }

    return { ok: true, value, error: "" };
}
