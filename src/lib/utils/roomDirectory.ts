// Pure helpers for the public room directory ("Explore rooms") browser.
// Input mirrors the /publicRooms chunk shape; every optional field must be
// tolerated (continuwuity and federated servers omit several).

export interface PublicRoomChunk {
    room_id: string;
    name?: string;
    canonical_alias?: string;
    aliases?: string[];
    topic?: string;
    avatar_url?: string;
    num_joined_members?: number;
    room_type?: string;
    join_rule?: string;
    world_readable?: boolean;
    guest_can_join?: boolean;
}

export interface DirectoryRoom {
    roomId: string;
    name: string;
    alias: string | null;
    topic: string | null;
    avatarMxc: string | null;
    memberCount: number;
    joinRule: string;
    isSpace: boolean;
}

export function mapPublicRooms(chunk: PublicRoomChunk[]): DirectoryRoom[] {
    return chunk
        .filter((room) => !!room.room_id)
        .map((room) => ({
            roomId: room.room_id,
            name: room.name || room.canonical_alias || room.room_id,
            alias: room.canonical_alias ?? null,
            topic: room.topic ?? null,
            avatarMxc: room.avatar_url ?? null,
            memberCount: room.num_joined_members ?? 0,
            joinRule: room.join_rule ?? "public",
            isSpace: room.room_type === "m.space",
        }));
}

export function mergeRoomPages(
    existing: DirectoryRoom[],
    incoming: DirectoryRoom[],
): DirectoryRoom[] {
    const seen = new Set(existing.map((room) => room.roomId));
    const merged = [...existing];
    for (const room of incoming) {
        if (seen.has(room.roomId)) continue;
        seen.add(room.roomId);
        merged.push(room);
    }
    return merged;
}

export function normalizeServerInput(input: string): string | undefined {
    const trimmed = input
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "");
    return trimmed || undefined;
}
