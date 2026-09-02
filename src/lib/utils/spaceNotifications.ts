//
// Pure traversal used to apply a notification level to a whole space: the space
// room itself plus every descendant room, recursing through sub-spaces. The
// caller supplies the graph accessors, so this has no SDK imports and is
// unit-testable. Extracted from SpaceSidebar.handleSetSpaceNotification so the
// Room Settings space variant shares one implementation (no copy drift).

export interface SpaceGraphAccessors {
    /** Room ids directly contained in space `id`. */
    roomsInSpace: (id: string) => string[];
    /** Child ids of space `id` that are THEMSELVES spaces (recurse into these). */
    childSpaceIds: (id: string) => string[];
}

/**
 * Collect `spaceId` plus every descendant room id, deduped and cycle-safe.
 *
 * Only the top `spaceId` container is included; nested sub-space container ids
 * are traversed but not themselves added — their rooms come in via
 * `roomsInSpace`. This matches the original SpaceSidebar behaviour exactly.
 */
export function collectSpaceAndDescendantRoomIds(
    spaceId: string,
    accessors: SpaceGraphAccessors,
): string[] {
    const all = new Set<string>([spaceId]);
    const visited = new Set<string>();
    const walk = (id: string): void => {
        if (visited.has(id)) return;
        visited.add(id);
        for (const roomId of accessors.roomsInSpace(id)) all.add(roomId);
        for (const childId of accessors.childSpaceIds(id)) walk(childId);
    };
    walk(spaceId);
    return [...all];
}
