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

/**
 * Spec-tolerant PL read: finite numbers pass, numeric strings coerce (pre-v10
 * rooms legally carry them), anything else -> the spec default for that field.
 */
export function coercePl(v: unknown, def: number): number {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
        return Number(v);
    return def;
}

/** The materialized power-level view the SDK boundary hands to the app. */
export interface RoomPowerLevels {
    ban: number;
    kick: number;
    redact: number;
    invite: number;
    events_default: number;
    state_default: number;
    users_default: number;
    events: Record<string, number>;
    users: Record<string, number>;
}

function asNumberMap(v: unknown): Record<string, number> {
    return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, number>)
        : {};
}

/**
 * Normalize an `m.room.power_levels` content object into a fully-defaulted
 * `RoomPowerLevels`.
 *
 * Two distinct spec cases:
 * - **No PL event at all** (`content == null`): the create-event sender holds
 *   `CREATOR_POWER_LEVEL`, everyone else 0, and every action level defaults to
 *   0 (Matrix auth rules for a room without a power-levels event).
 * - **PL event present** (even if empty `{}`): each omitted field falls back to
 *   its spec per-field default (ban/kick/redact/state_default 50;
 *   events_default/users_default 0; invite 0 since spec v1.4). Scalar values are
 *   read through `coercePl` so pre-v10 numeric-string levels are tolerated.
 */
export function normalizePowerLevels(
    content: Record<string, unknown> | null | undefined,
    creatorId: string | null,
): RoomPowerLevels {
    if (content == null) {
        return {
            ban: 0,
            kick: 0,
            redact: 0,
            invite: 0,
            events_default: 0,
            state_default: 0,
            users_default: 0,
            events: {},
            users: creatorId ? { [creatorId]: CREATOR_POWER_LEVEL } : {},
        };
    }
    return {
        ban: coercePl(content.ban, 50),
        kick: coercePl(content.kick, 50),
        redact: coercePl(content.redact, 50),
        invite: coercePl(content.invite, 0),
        events_default: coercePl(content.events_default, 0),
        state_default: coercePl(content.state_default, 50),
        users_default: coercePl(content.users_default, 0),
        events: asNumberMap(content.events),
        users: asNumberMap(content.users),
    };
}

/**
 * The three MatrixRTC call-membership state-event types a client may send to
 * join a call. A user needs power >= the required level for at least one of
 * these; new rooms created by this client set all three to 0 at creation.
 */
export const CALL_MEMBER_EVENT_TYPES = [
    "org.matrix.msc3401.call.member",
    "m.call.member",
    "m.rtc.member",
] as const;

/**
 * The effective "power level required to join a call" from a normalized power
 * levels view. For each call-member type, the required level is its entry in
 * the `events` map, or `state_default` when the map omits it. The join
 * requirement is the MIN across the three: a user can join as soon as they can
 * send ANY one of the types. When the map sets none, the result is
 * `state_default`.
 */
export function effectiveCallJoinLevel(pl: {
    events: Record<string, number>;
    state_default: number;
}): number {
    const levels = CALL_MEMBER_EVENT_TYPES.map((t) =>
        t in pl.events ? pl.events[t] : pl.state_default,
    );
    return Math.min(...levels);
}

/**
 * Return a new `events` map with all three call-member types set to `level`,
 * preserving every other entry. Callers pass the result as the FULL `events`
 * object to `setRoomPowerLevels` (which replaces `events` wholesale).
 */
export function mergeCallJoinLevel(
    events: Record<string, number>,
    level: number,
): Record<string, number> {
    const next = { ...events };
    for (const t of CALL_MEMBER_EVENT_TYPES) next[t] = level;
    return next;
}

// `m.room.power_levels` scalar action levels — each must be a number.
const PL_SCALAR_KEYS = [
    "ban",
    "kick",
    "redact",
    "invite",
    "events_default",
    "state_default",
    "users_default",
] as const;
// `m.room.power_levels` maps of name -> number.
const PL_MAP_KEYS = ["users", "events", "notifications"] as const;

/**
 * Shape-check an `m.room.power_levels` content object before it is written back
 * to the room (audit SEC-L12). The server rejects malformed writes anyway, so
 * this is type-hygiene, not a security gate: it turns a cryptic server 400 into
 * a clear client-side error and stops an obviously-wrong value ever leaving.
 *
 * Only fields that ARE present are checked, and only for affirmatively-wrong
 * types (scalars must be finite numbers; the users/events/notifications maps
 * must be objects of finite numbers). Unknown keys and omitted fields pass, so
 * a normal edit is never blocked. Returns a human-readable reason string when
 * invalid, or `null` when the content is well-formed.
 */
export function validatePowerLevelsContent(content: unknown): string | null {
    if (
        typeof content !== "object" ||
        content === null ||
        Array.isArray(content)
    )
        return "power_levels content must be an object";
    const c = content as Record<string, unknown>;
    for (const key of PL_SCALAR_KEYS) {
        if (key in c) {
            const v = c[key];
            if (typeof v !== "number" || !Number.isFinite(v))
                return `power_levels.${key} must be a number`;
        }
    }
    for (const key of PL_MAP_KEYS) {
        if (!(key in c)) continue;
        const map = c[key];
        if (typeof map !== "object" || map === null || Array.isArray(map))
            return `power_levels.${key} must be an object`;
        for (const [name, level] of Object.entries(map as object)) {
            if (typeof level !== "number" || !Number.isFinite(level))
                return `power_levels.${key}.${name} must be a number`;
        }
    }
    return null;
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
