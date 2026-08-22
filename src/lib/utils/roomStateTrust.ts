/**
 * Tracks which rooms had their state healed out-of-band this session — fetched
 * wholesale from `/rooms/{id}/state` because the homeserver omitted them from
 * the normal `/sync` loop (a continuwuity federation quirk) — rather than
 * delivered through sync. Healed state is server-controlled and read straight
 * into UI trust indicators (power levels, membership, v12 creator status), so
 * the UI flags it as unverified. This is UI honesty only: a hostile server can
 * spoof what these indicators SHOW, never what an action DOES — every write is
 * still enforced server-side (see SEC-M5). SDK-free so it can be unit-tested.
 *
 * Session-scoped and in-memory on purpose: a fresh session or account switch
 * reloads and re-evaluates from a clean registry. Never persisted.
 */

export interface HealedRoomRegistry {
    /** Record that `roomId`'s state was healed out-of-band. Idempotent. */
    markHealed(roomId: string): void;
    /** Whether `roomId`'s current state was healed rather than synced. */
    isHealed(roomId: string): boolean;
    /** Drop one room's healed flag (e.g. on leave/forget). */
    forget(roomId: string): void;
    /** Drop every healed flag (e.g. on logout/session teardown). */
    clear(): void;
}

export function createHealedRoomRegistry(): HealedRoomRegistry {
    const healed = new Set<string>();
    return {
        markHealed: (roomId) => {
            if (roomId) healed.add(roomId);
        },
        isHealed: (roomId) => healed.has(roomId),
        forget: (roomId) => {
            healed.delete(roomId);
        },
        clear: () => healed.clear(),
    };
}

/** Advisory trust view for a room whose state may have been fetched
 *  out-of-band. `label` is a short chip; `tooltip` is the full explanation. */
export interface RoomStateTrustBadge {
    unverified: boolean;
    label: string;
    tooltip: string;
}

export function roomStateTrustBadge(healed: boolean): RoomStateTrustBadge {
    if (!healed) return { unverified: false, label: "", tooltip: "" };
    return {
        unverified: true,
        label: "Unverified room state",
        tooltip:
            "Some of this room's details (roles, membership, and permissions) " +
            "were fetched directly from the server and haven't been confirmed " +
            "through sync, so they may be inaccurate. Actions are still enforced " +
            "by the server regardless of what is shown here.",
    };
}
