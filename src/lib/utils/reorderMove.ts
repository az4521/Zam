/**
 * Pure neighbour computation for a settings-style "move up / move down"
 * reorder. Moving an item one slot is always an adjacent swap; this returns
 * the ids that bracket the moved item AFTER the move, ready to hand to
 * `reorderRoomTag` / `reorderSpaceChild` as `(beforeId, afterId)`.
 *
 * SDK-free, UI-free. `null` means the move is a no-op (item already at the
 * boundary, or an out-of-range index) — the caller should skip the write.
 */

export type MoveDirection = "up" | "down";

export interface MoveResult {
    beforeId: string | null;
    afterId: string | null;
}

export function moveNeighbours(
    ids: readonly string[],
    index: number,
    direction: MoveDirection,
): MoveResult | null {
    if (!Number.isInteger(index) || index < 0 || index >= ids.length) {
        return null;
    }
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= ids.length) return null;

    const arr = [...ids];
    [arr[index], arr[to]] = [arr[to], arr[index]];

    return {
        beforeId: to > 0 ? arr[to - 1] : null,
        afterId: to < arr.length - 1 ? arr[to + 1] : null,
    };
}
