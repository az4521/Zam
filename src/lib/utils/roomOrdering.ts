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
 *  favourites first, low priority last. Tagged rooms keep their manual tag
 *  order; untagged ones sort by `compareNormal` when given (stable, so ties
 *  keep the input order). */
export function sortRoomsByTag<T>(
    rooms: readonly T[],
    getTags: (room: T) => RoomTagMap,
    compareNormal?: (a: T, b: T) => number,
): T[] {
    const { favourites, normal, lowPriority } = groupRoomsByTag(rooms, getTags);
    if (compareNormal) normal.sort(compareNormal);
    return [...favourites, ...normal, ...lowPriority];
}

/** Newest first by a timestamp; rooms with no known time go last. */
export function byRecency<T>(
    tsOf: (room: T) => number | null,
): (a: T, b: T) => number {
    return (a, b) => (tsOf(b) ?? -Infinity) - (tsOf(a) ?? -Infinity) || 0;
}

/** How untagged DMs are ordered (the DM list's header menu). */
export type DmSortOrder = "recent" | "unread" | "online" | "name";

export const DM_SORT_ORDERS: readonly DmSortOrder[] = [
    "recent",
    "unread",
    "online",
    "name",
];

export function isDmSortOrder(value: unknown): value is DmSortOrder {
    return DM_SORT_ORDERS.includes(value as DmSortOrder);
}

/** What a DM sort needs to know about one room. */
export interface DmSortFacts {
    /** Time of the latest message, or null when none is known. */
    lastMessageTs: number | null;
    unread: boolean;
    /** The other person's presence: "online" | "busy" | "unavailable" |
     *  "offline" (anything else counts as offline). */
    presence: string;
    name: string;
}

// Online first means reachable first: active, then busy (there but not to
// be disturbed), then away, then offline.
const PRESENCE_RANK: Record<string, number> = {
    online: 0,
    busy: 1,
    unavailable: 2,
};

/**
 * Comparator for one DM sort order. Every order falls back to latest
 * message, newest first, so rows that tie still move with the conversation.
 */
export function dmComparator<T>(
    order: DmSortOrder,
    factsOf: (room: T) => DmSortFacts,
): (a: T, b: T) => number {
    const recent = byRecency<T>((r) => factsOf(r).lastMessageTs);
    const collator = new Intl.Collator(undefined, { sensitivity: "base" });
    const first = (a: T, b: T): number => {
        const fa = factsOf(a);
        const fb = factsOf(b);
        switch (order) {
            case "unread":
                return Number(fb.unread) - Number(fa.unread);
            case "online":
                return (
                    (PRESENCE_RANK[fa.presence] ?? 3) -
                    (PRESENCE_RANK[fb.presence] ?? 3)
                );
            case "name":
                return collator.compare(fa.name, fb.name);
            case "recent":
                return 0;
        }
    };
    return (a, b) => first(a, b) || recent(a, b);
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

export interface TagOrderRestore {
    roomId: string;
    order: number | string | undefined;
}

/**
 * Undo plan for a serial tag-order rebalance that failed partway through.
 * Given the room list the rebalance renumbered, the order each room had BEFORE
 * it ran, and how many rooms were successfully re-tagged, produce the restore
 * operations — the applied rooms only, in REVERSE order so the section returns
 * to its pre-rebalance state. Rooms past `appliedCount` were never touched.
 */
export function tagOrderRollback(
    roomIds: string[],
    originalOrders: (number | string | undefined)[],
    appliedCount: number,
): TagOrderRestore[] {
    const ops: TagOrderRestore[] = [];
    for (let i = Math.min(appliedCount, roomIds.length) - 1; i >= 0; i--) {
        ops.push({ roomId: roomIds[i], order: originalOrders[i] });
    }
    return ops;
}
