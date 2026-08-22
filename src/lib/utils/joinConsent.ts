/**
 * Pure helpers for the click-a-Matrix-link join-consent gate (audit SEC-M3).
 *
 * Clicking a room/alias permalink used to call joinRoom() with no confirmation,
 * federating the reader's MXID/presence and polluting their room list on one
 * click. These helpers build the descriptor the consent dialog shows and decide
 * when a consent prompt is required at all. No SDK imports — the caller resolves
 * the alias and reads membership.
 */

/** The server-name part of a Matrix id/alias (after the first colon), or null. */
export function serverName(id: string): string | null {
    const i = id.indexOf(":");
    if (i === -1) return null;
    return id.slice(i + 1) || null;
}

export interface JoinConsentDescriptor {
    /** What the user clicked: the alias for an alias link, else the room id. */
    display: string;
    /** The room id the link actually resolves to (server-authoritative). */
    resolvedRoomId: string;
    /**
     * True when an alias link's server differs from the resolved room id's
     * server — a possible alias redirect (audit LINK-04). Never true for a
     * direct room link, or when the resolved id has no server part (v12).
     */
    serverMismatch: boolean;
}

/** Build the descriptor the consent dialog renders for a pending join. */
export function describeJoinTarget(params: {
    kind: "alias" | "room";
    alias?: string;
    linkRoomId?: string;
    resolvedRoomId: string;
}): JoinConsentDescriptor {
    if (params.kind === "alias" && params.alias) {
        const aliasServer = serverName(params.alias);
        const roomServer = serverName(params.resolvedRoomId);
        const serverMismatch =
            aliasServer !== null &&
            roomServer !== null &&
            aliasServer !== roomServer;
        return {
            display: params.alias,
            resolvedRoomId: params.resolvedRoomId,
            serverMismatch,
        };
    }
    return {
        display: params.linkRoomId ?? params.resolvedRoomId,
        resolvedRoomId: params.resolvedRoomId,
        serverMismatch: false,
    };
}

/** A join needs explicit consent unless the user is already a joined member. */
export function needsJoinConsent(
    membership: string | null | undefined,
): boolean {
    return membership !== "join";
}
