/**
 * Collect every descendant room id of a space, walking sub-spaces recursively.
 *
 * Pure and graph-shaped: the caller injects the two edge lookups — the direct
 * (non-space) rooms in a space, and the sub-space ids of a space — so this can
 * be unit-tested without the SDK. Spaces can list each other as children, so
 * the walk is cycle-safe, and a room reachable through more than one sub-space
 * is returned once.
 *
 * Mirrors SpaceSidebar's `getSpaceNotifs` aggregation exactly, so marking a
 * space read clears precisely the rooms its unread badge counts.
 */
export function collectSpaceDescendantRoomIds(
    rootSpaceId: string,
    getRoomIdsInSpace: (spaceId: string) => string[],
    getSubspaceIds: (spaceId: string) => string[],
): string[] {
    const rooms = new Set<string>();
    const visited = new Set<string>();
    const walk = (spaceId: string) => {
        if (visited.has(spaceId)) return;
        visited.add(spaceId);
        for (const id of getRoomIdsInSpace(spaceId)) rooms.add(id);
        for (const sub of getSubspaceIds(spaceId)) walk(sub);
    };
    walk(rootSpaceId);
    return [...rooms];
}

/** One node in a nickname walk: its m.space.child ids and whether the user is joined. */
export interface NicknameWalkNode {
    childIds: string[];
    joined: boolean;
}

/**
 * Joined descendants of a space, for applying a per-space nickname: every
 * joined room and sub-space below `rootSpaceId`, depth-first, excluding the
 * root itself.
 *
 * Unjoined children are neither returned nor walked into, since the client has
 * no reliable child state for a space the user is not in. A child the lookup
 * cannot resolve (null) is skipped. Each id is visited once, so cycles and a
 * room reachable through two sub-spaces are handled.
 */
export function joinedSpaceDescendants(
    rootSpaceId: string,
    lookup: (roomId: string) => NicknameWalkNode | null,
): string[] {
    const out: string[] = [];
    const visited = new Set<string>([rootSpaceId]);
    const walk = (spaceId: string) => {
        const node = lookup(spaceId);
        if (!node) return;
        for (const childId of node.childIds) {
            if (visited.has(childId)) continue;
            visited.add(childId);
            const child = lookup(childId);
            if (!child?.joined) continue;
            out.push(childId);
            walk(childId);
        }
    };
    walk(rootSpaceId);
    return out;
}
