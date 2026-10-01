// Pure helpers for the joined-space graph: which joined spaces sit under another
// joined space (shown as categories in the room list, not on the space rail),
// and which top-level space a nested one belongs to. No SDK imports.

/**
 * Joined spaces reachable as a descendant of a top-level joined space. A
 * top-level space is one no other joined space lists as a child. Spaces that
 * only parent each other in a cycle have no top-level ancestor and are NOT
 * reported as nested, so they stay reachable from the rail.
 */
export function nestedSpaceIds(
    joinedSpaceIds: readonly string[],
    childIdsOf: (id: string) => readonly string[],
): Set<string> {
    const joined = new Set(joinedSpaceIds);
    const hasParent = new Set<string>();
    for (const id of joined) {
        for (const c of childIdsOf(id)) {
            if (c !== id && joined.has(c)) hasParent.add(c);
        }
    }
    const nested = new Set<string>();
    const queue = [...joined].filter((id) => !hasParent.has(id));
    const visited = new Set(queue);
    while (queue.length) {
        const id = queue.shift()!;
        for (const c of childIdsOf(id)) {
            if (!joined.has(c) || visited.has(c)) continue;
            visited.add(c);
            nested.add(c);
            queue.push(c);
        }
    }
    return nested;
}

/**
 * The top-level ancestor of `spaceId` (itself when it is not nested), walking
 * up through joined parents. Null when no top-level ancestor is reachable.
 */
export function topLevelSpaceOf(
    spaceId: string,
    parentsOf: (id: string) => readonly string[],
    nested: ReadonlySet<string>,
): string | null {
    const queue = [spaceId];
    const seen = new Set(queue);
    while (queue.length) {
        const id = queue.shift()!;
        if (!nested.has(id)) return id;
        for (const p of parentsOf(id)) {
            if (seen.has(p)) continue;
            seen.add(p);
            queue.push(p);
        }
    }
    return null;
}
