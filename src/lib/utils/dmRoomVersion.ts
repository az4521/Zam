/**
 * Choose the room version to create a DM at, to keep a CROSS-SERVER invite
 * federatable.
 *
 * Room v12 changed the `m.room.create` event (the creator is the event's
 * sender; there is no `creator` content field) and its auth rules. Some
 * federated servers reject a v12 room's create event when they validate an
 * incoming invite ("The invite's m.room.create event ... does not validate"),
 * so the invite never lands — the DM has only its creator and the client
 * renders it as an "Empty room". Reproduced live 2026-08-15: continuwuity
 * (default v12) → matrix.crafty.moe rejected the invite; recreating the same DM
 * at v10/v11 federated and worked bidirectionally.
 *
 * Strategy: same-server DMs keep the homeserver default (no federation, nothing
 * to reject). Cross-server DMs cap at a federation-safe ceiling — the previous
 * widely-deployed default (v11) — unless the server default is already at or
 * below it. Capping DOWN is always safe: older versions federate more broadly.
 *
 * Pure so it can be unit-tested; the caller supplies the server's advertised
 * room-version capability (see getRoomVersionCapability in client.ts).
 */

/** DMs to another server are created at most at this room version. */
export const FEDERATION_SAFE_DM_VERSION_CEILING = 11;

/** The server part of a Matrix id (`@user:server` → `server`); the whole string when there is no colon. */
function serverOf(userId: string): string {
    const i = userId.indexOf(":");
    return i === -1 ? userId : userId.slice(i + 1);
}

/** Leading integer of a room-version id (`"11"`, `"12"`), or NaN for unstable/unknown ids. */
function versionNumber(version: string): number {
    const m = /^(\d+)/.exec(version.trim());
    return m ? parseInt(m[1], 10) : NaN;
}

export interface DmRoomVersionInput {
    /** The user being invited to the DM. */
    inviteeUserId: string;
    /** The current user (DM creator). */
    ownUserId: string;
    /** capabilities["m.room_versions"].available — the version ids the server offers. */
    available: readonly string[];
    /** capabilities["m.room_versions"].default — "" / undefined when unadvertised. */
    default?: string;
}

/**
 * The `room_version` to pass to `createRoom` for this DM, or `undefined` to let
 * the server pick its default (same-server DMs, or when the default is already
 * federation-safe, or when no safe version is available to fall back to).
 */
export function pickDmRoomVersion(
    input: DmRoomVersionInput,
): string | undefined {
    // Same-server DM: no federation, so the server default cannot be rejected.
    if (serverOf(input.inviteeUserId) === serverOf(input.ownUserId)) {
        return undefined;
    }
    // A default at or below the ceiling is already safe — don't override it.
    const def = input.default ? versionNumber(input.default) : NaN;
    if (!Number.isNaN(def) && def <= FEDERATION_SAFE_DM_VERSION_CEILING) {
        return undefined;
    }
    // Otherwise create at the highest AVAILABLE version <= the ceiling.
    const safest = input.available
        .map((raw) => ({ raw, n: versionNumber(raw) }))
        .filter(
            (v) =>
                !Number.isNaN(v.n) && v.n <= FEDERATION_SAFE_DM_VERSION_CEILING,
        )
        .sort((a, b) => b.n - a.n)[0];
    // No safe version advertised → fall back to the server default (undefined).
    return safest?.raw;
}
