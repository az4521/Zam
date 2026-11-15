// What a message-link pill says: the room's name after a "#", or for a DM the
// other person's avatar and name. Pure; the plugin hands in lookups backed by
// the `zam.matrix` API.

export type PillLabel =
    | { kind: "room"; name: string }
    | { kind: "dm"; name: string; avatarUrl: string | null }
    | { kind: "unknown" };

export interface PillLookups {
    /** A joined room's id for an alias, or null. */
    roomIdForAlias(alias: string): string | null;
    /** A joined room's display name and avatar, or null if not joined. */
    room(roomId: string): { name: string; avatarUrl: string | null } | null;
    /** The other user of a DM room (from m.direct), or null. */
    dmUserId(roomId: string): string | null;
    /** A member's avatar in the room, or null when unknown. */
    memberAvatar(roomId: string, userId: string): string | null;
}

/** m.direct content ({ userId: roomId[] }) inverted to roomId → userId. */
export function directRoomMap(
    content: Record<string, unknown> | null,
): Map<string, string> {
    const map = new Map<string, string>();
    if (!content) return map;
    for (const [userId, rooms] of Object.entries(content)) {
        if (!Array.isArray(rooms)) continue;
        for (const roomId of rooms) {
            if (typeof roomId === "string" && !map.has(roomId))
                map.set(roomId, userId);
        }
    }
    return map;
}

export function resolvePillLabel(
    roomOrAlias: string,
    lookups: PillLookups,
): PillLabel {
    const isAlias = roomOrAlias.startsWith("#");
    const roomId = isAlias ? lookups.roomIdForAlias(roomOrAlias) : roomOrAlias;
    const room = roomId ? lookups.room(roomId) : null;
    // The SDK falls back to the room id when it has no name yet.
    const name = room?.name?.trim();
    if (roomId && room && name && name !== roomId) {
        const dmUser = lookups.dmUserId(roomId);
        if (dmUser) {
            return {
                kind: "dm",
                name,
                avatarUrl:
                    lookups.memberAvatar(roomId, dmUser) ?? room.avatarUrl,
            };
        }
        return { kind: "room", name: name.replace(/^#+/, "") };
    }
    // Not joined (or unnamed): an alias still names the room.
    if (isAlias) return { kind: "room", name: roomOrAlias.slice(1) };
    return { kind: "unknown" };
}

/** Stable key so a pill is only rewritten when its label really changed. */
export function pillLabelKey(label: PillLabel): string {
    if (label.kind === "unknown") return "u";
    if (label.kind === "room") return `r|${label.name}`;
    return `d|${label.name}|${label.avatarUrl ?? ""}`;
}
