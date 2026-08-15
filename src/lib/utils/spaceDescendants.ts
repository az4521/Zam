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
