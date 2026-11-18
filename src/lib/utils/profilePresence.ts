// Presence carried in an extended (MSC4133) profile field, for homeservers
// that have presence turned off (matrix.org). No MSC covers this, so the key
// is our own: `{ presence, ts }`, where `ts` is when the client last wrote it.
//
// A profile field never times out by itself, so readers ignore one that has
// not been refreshed lately, and invisible is "no field at all".
import { normalizePresence, type SeenPresence } from "$lib/utils/presence";

export const PROFILE_PRESENCE_KEY = "moe.crafty.zam.presence";

/** How often a client that stays online rewrites the field. */
export const PROFILE_PRESENCE_HEARTBEAT_MS = 2 * 60_000;

/** A field older than this is a client that went away without clearing it. */
export const PROFILE_PRESENCE_STALE_MS = 6 * 60_000;

/** Clock disagreement we forgive between two devices. */
const MAX_FUTURE_SKEW_MS = 2 * 60_000;

export interface ProfilePresence {
    state: SeenPresence;
    ts: number;
}

/** The field value to write for `state`, or null to delete the field
 *  (offline is invisible: nothing is published). */
export function buildProfilePresence(
    state: SeenPresence,
    nowMs: number,
): { presence: SeenPresence; ts: number } | null {
    return state === "offline" ? null : { presence: state, ts: nowMs };
}

/** A live, well-formed presence from a profile, or null. Stale, future-dated
 *  and offline values all read as "no presence published". */
export function parseProfilePresence(
    profile: Record<string, unknown> | null | undefined,
    nowMs: number,
): ProfilePresence | null {
    const value = profile?.[PROFILE_PRESENCE_KEY];
    if (!value || typeof value !== "object") return null;
    const { presence, ts } = value as Record<string, unknown>;
    if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
    if (nowMs - ts > PROFILE_PRESENCE_STALE_MS) return null;
    if (ts - nowMs > MAX_FUTURE_SKEW_MS) return null;
    const state = normalizePresence(presence);
    return state === "offline" ? null : { state, ts };
}

/** Whether the presence picker applies: the server has presence, or we publish
 *  it through the profile instead. */
export function presenceControlsShown(
    presenceUnsupported: boolean,
    shareProfilePresence: boolean,
): boolean {
    return !presenceUnsupported || shareProfilePresence;
}
