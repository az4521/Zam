// Discord categories bridged by ZDMB (Zam Discord-Matrix Bridge).
//
// Each bridged channel's m.space.child event in the guild space carries
// `moe.crafty.zdmb.category: { id, name }` for its Discord category. Threads
// and uncategorised channels have no key. The room list groups a space's
// channels under these headings instead of one flat "Channels" list.

export const CATEGORY_KEY = "moe.crafty.zdmb.category";

export interface BridgedCategory {
    id: string;
    name: string;
}

/** The category on an m.space.child event's content, or null for a child
 *  without one or that was removed from the space (no via). */
export function parseSpaceChildCategory(
    childContent: unknown,
): BridgedCategory | null {
    if (typeof childContent !== "object" || childContent === null) return null;
    const c = childContent as Record<string, unknown>;
    if (!Array.isArray(c["via"]) || c["via"].length === 0) return null;
    const cat = c[CATEGORY_KEY];
    if (typeof cat !== "object" || cat === null || Array.isArray(cat))
        return null;
    const id = (cat as Record<string, unknown>)["id"];
    const name = (cat as Record<string, unknown>)["name"];
    if (typeof id !== "string" || !id) return null;
    return { id, name: typeof name === "string" && name ? name : id };
}

export interface CategoryGroup<T> {
    /** null for channels outside any category. */
    category: BridgedCategory | null;
    items: T[];
}

/**
 * Group items by category like Discord's channel list: uncategorised items
 * first, then each category in the order its first item appears (the bridge's
 * space `order` already sorts by category). Items keep their relative order.
 */
export function groupByCategory<T>(
    items: readonly T[],
    idOf: (item: T) => string,
    categoryOf: (id: string) => BridgedCategory | null | undefined,
): CategoryGroup<T>[] {
    const loose: T[] = [];
    const groups = new Map<string, CategoryGroup<T>>();
    for (const item of items) {
        const cat = categoryOf(idOf(item));
        if (!cat) {
            loose.push(item);
            continue;
        }
        const group = groups.get(cat.id);
        if (group) group.items.push(item);
        else groups.set(cat.id, { category: cat, items: [item] });
    }
    const out: CategoryGroup<T>[] = [];
    if (loose.length) out.push({ category: null, items: loose });
    out.push(...groups.values());
    return out;
}
