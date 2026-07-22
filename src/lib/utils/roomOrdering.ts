import { compareOrder } from "./orderKey";

export const TAG_FAVOURITE = "m.favourite";
export const TAG_LOWPRIORITY = "m.lowpriority";

/** Shape of a room's tag map (`room.tags` in matrix-js-sdk / `m.tag` content).
 *  `order` is a number 0..1 per spec, but legacy clients sent strings — treat
 *  anything non-numeric as missing. */
export type RoomTagMap = Record<string, { order?: unknown }>;

export type RoomTagKind = "favourite" | "normal" | "lowPriority";

export function roomTagKind(tags: RoomTagMap): RoomTagKind {
    if (TAG_FAVOURITE in tags) return "favourite";
    if (TAG_LOWPRIORITY in tags) return "lowPriority";
    return "normal";
}

export interface RoomTagGroups<T> {
    favourites: T[];
    normal: T[];
    lowPriority: T[];
}

/**
 * Split rooms into favourites / normal / low-priority groups by their tags.
 * Favourites and low-priority rooms sort by their tag's `order` (lowest
 * first, missing/invalid orders last); ties keep the input order.
 */
export function groupRoomsByTag<T>(
    rooms: readonly T[],
    getTags: (room: T) => RoomTagMap,
): RoomTagGroups<T> {
    const favourites: T[] = [];
    const normal: T[] = [];
    const lowPriority: T[] = [];
    for (const room of rooms) {
        switch (roomTagKind(getTags(room))) {
            case "favourite":
                favourites.push(room);
                break;
            case "lowPriority":
                lowPriority.push(room);
                break;
            default:
                normal.push(room);
        }
    }
    const byOrder = (tag: string) => (a: T, b: T) =>
        compareOrder(getTags(a)[tag]?.order, getTags(b)[tag]?.order);
    favourites.sort(byOrder(TAG_FAVOURITE));
    lowPriority.sort(byOrder(TAG_LOWPRIORITY));
    return { favourites, normal, lowPriority };
}

/** Flat ordering for lists without section headers (e.g. DMs):
 *  favourites first, low priority last. */
export function sortRoomsByTag<T>(
    rooms: readonly T[],
    getTags: (room: T) => RoomTagMap,
): T[] {
    const { favourites, normal, lowPriority } = groupRoomsByTag(rooms, getTags);
    return [...favourites, ...normal, ...lowPriority];
}

/**
 * Compute the tag changes for toggling favourite / low priority on a room.
 * The two tags are mutually exclusive: turning one on removes the other
 * (matches Element). Turning a tag off only removes that tag.
 */
export function tagUpdatesForToggle(
    tags: RoomTagMap,
    toggle: "favourite" | "lowPriority",
): { add: string | null; remove: string[] } {
    const tag = toggle === "favourite" ? TAG_FAVOURITE : TAG_LOWPRIORITY;
    const opposite = toggle === "favourite" ? TAG_LOWPRIORITY : TAG_FAVOURITE;
    if (tag in tags) return { add: null, remove: [tag] };
    return { add: tag, remove: opposite in tags ? [opposite] : [] };
}
