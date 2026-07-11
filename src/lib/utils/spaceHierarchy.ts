/**
 * Pure helpers for reading /hierarchy responses (MSC2946).
 *
 * Continuwuity answers /hierarchy with 403 "This room does not exist" for
 * spaces the server hasn't joined — including sub-spaces it happily lists as
 * children of a joined parent. The client works around it by re-fetching the
 * parent's hierarchy one level deeper and slicing the sub-space's children
 * out of that response; this module holds the slicing logic.
 */

export interface SubspaceSlice {
    childIds: Set<string>;
    viaMap: Map<string, string[]>;
}

/**
 * From a /hierarchy response's `rooms`, pull the `m.space.child` edges of
 * `spaceId`: which rooms are its direct children and which via servers each
 * child advertises. Returns null when `spaceId` has no entry in the response
 * (the deeper fetch didn't reach it — caller should give up, not render an
 * empty space).
 */
export function extractSubspaceChildren(
    rooms: Array<Record<string, unknown>>,
    spaceId: string,
): SubspaceSlice | null {
    const entry = rooms.find((r) => r["room_id"] === spaceId);
    if (!entry) return null;

    const childIds = new Set<string>();
    const viaMap = new Map<string, string[]>();
    const edges = Array.isArray(entry["children_state"])
        ? (entry["children_state"] as Array<Record<string, unknown>>)
        : [];
    for (const ev of edges) {
        if (ev["type"] !== "m.space.child") continue;
        const childId = ev["state_key"];
        if (typeof childId !== "string" || !childId) continue;
        childIds.add(childId);
        const via = (ev["content"] as Record<string, unknown> | undefined)?.[
            "via"
        ];
        if (Array.isArray(via) && via.length) {
            viaMap.set(
                childId,
                via.filter((s): s is string => typeof s === "string"),
            );
        }
    }
    return { childIds, viaMap };
}
