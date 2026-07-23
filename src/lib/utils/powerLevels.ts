/**
 * Effective power-level rules for room-v12 (MSC4289) creators. A creator's
 * implicit power is NOT written to `m.room.power_levels`, and matrix-js-sdk 41
 * reports it as `users_default` (0). These pure helpers let the SDK boundary
 * compute the real effective level. SDK-free so they can be unit-tested.
 */

/**
 * Power level a room-v12 creator is treated as having. MSC4289 makes creator
 * power effectively infinite; 100 is the representable admin ceiling — it
 * passes every realistic gate and displays cleanly.
 */
export const CREATOR_POWER_LEVEL = 100;

/**
 * Room versions in which the creator (and `additional_creators`) hold
 * *immutable* implicit power. Only these grant the creator bonus — in older
 * versions a creator can be legitimately demoted, so their raw level is
 * authoritative. Extend if a server reports an unstable MSC4289 version string.
 */
const IMMUTABLE_CREATOR_ROOM_VERSIONS = new Set(["12"]);

export function roomVersionHasImmutableCreators(version: string): boolean {
    return IMMUTABLE_CREATOR_ROOM_VERSIONS.has(version);
}

export interface EffectivePowerLevelInput {
    /** The raw power level the SDK reports for the user. */
    rawPowerLevel: number;
    /** Whether the user is the room creator or an additional creator. */
    isCreator: boolean;
    /** Whether the room version grants immutable creator power (v12+). */
    immutableCreators: boolean;
}

/**
 * The user's effective power level: their raw level, except a creator in an
 * immutable-creator room is lifted to at least `CREATOR_POWER_LEVEL`. `max`
 * keeps a genuinely-higher raw level and makes the lift a no-op if the SDK ever
 * starts reporting creator power itself.
 *
 * A non-finite raw level is treated as 0. matrix-js-sdk 41 reports a v12
 * creator's `RoomMember.powerLevel` as `NaN` (no users entry to compute from);
 * `NaN` slips past a `?? 0` guard and poisons `Math.max` (→ `NaN`), which then
 * fails every `>= required` gate. Normalizing here is the single choke point.
 */
export function effectivePowerLevel(input: EffectivePowerLevelInput): number {
    const raw = Number.isFinite(input.rawPowerLevel) ? input.rawPowerLevel : 0;
    if (input.immutableCreators && input.isCreator) {
        return Math.max(raw, CREATOR_POWER_LEVEL);
    }
    return raw;
}

export interface ParsePowerLevelResult {
    ok: boolean;
    /** The parsed level when ok; null otherwise. */
    value: number | null;
    /** Empty when ok; else a user-facing reason. */
    error: string;
}

/**
 * Validate a hand-typed power level against the actor's ceiling. Accepts only a
 * whole, non-negative integer in [0, ceiling]. Regex-then-Number so "3.5"/"0x10"
 * can't slip through. Distinct message per rejection.
 */
export function parsePowerLevelInput(
    raw: string,
    ceiling: number,
): ParsePowerLevelResult {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { ok: false, value: null, error: "Enter a power level" };
    }
    if (!/^-?\d+$/.test(trimmed)) {
        return { ok: false, value: null, error: "Must be a whole number" };
    }
    const value = Number(trimmed);
    if (value < 0) {
        return { ok: false, value: null, error: "Must be 0 or higher" };
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
