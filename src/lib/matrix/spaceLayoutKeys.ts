// Converters between our space layout (im.client.space_layout) and the other
// clients' account-data shapes, so a layout made elsewhere is picked up here and
// ours is visible to Commet.
//
// Commet (chat.commet.sidebar_ordering): one entry per top-level space, plus a
// `groups` map. A folder is only a shared uuid on its members' `group`; it has
// no name or colour. `order` is a sort string, relative to the folder for a
// grouped space and to the top level otherwise (folders sit in the top level
// under their `groups` order).
//
// Element (org.matrix.msc3230.space_order): room account data on each space,
// `{ order }`, a flat sort string. No folders.

import type { SpaceFolder, SpaceLayout } from "./client";

export const COMMET_ORDER_KEY = "chat.commet.sidebar_ordering";
export const ELEMENT_SPACE_ORDER_KEY = "org.matrix.msc3230.space_order";

export interface CommetOrdering {
    spaces?: Record<string, { group?: string; order?: string }>;
    groups?: Record<string, { order?: string }>;
}

/** Code-unit comparison, the way both clients compare order strings. */
function byOrder(a: [string, string], b: [string, string]): number {
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/** Ids sorted by their order string; an id with none goes last, by id. */
function sortIds(entries: [string, string | undefined][]): string[] {
    const ordered = entries.filter(
        (e): e is [string, string] => typeof e[1] === "string",
    );
    const unordered = entries
        .filter((e) => typeof e[1] !== "string")
        .map((e) => e[0])
        .sort();
    return [...ordered.sort(byOrder).map((e) => e[0]), ...unordered];
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function commetToLayout(content: unknown): SpaceLayout | null {
    if (!isRecord(content) || !isRecord(content.spaces)) return null;
    const groups = isRecord(content.groups) ? content.groups : {};

    const rootEntries: [string, string | undefined][] = [];
    const members = new Map<string, [string, string | undefined][]>();
    for (const [spaceId, raw] of Object.entries(content.spaces)) {
        if (!isRecord(raw)) continue;
        const order = typeof raw.order === "string" ? raw.order : undefined;
        if (typeof raw.group === "string") {
            const list = members.get(raw.group) ?? [];
            list.push([spaceId, order]);
            members.set(raw.group, list);
        } else {
            rootEntries.push([spaceId, order]);
        }
    }

    const folders: Record<string, SpaceFolder> = {};
    for (const [folderId, list] of members) {
        folders[folderId] = { name: "", spaceIds: sortIds(list) };
        const g = groups[folderId];
        const order =
            isRecord(g) && typeof g.order === "string" ? g.order : undefined;
        rootEntries.push([folderId, order]);
    }

    const order = sortIds(rootEntries);
    return order.length ? { order, folders } : null;
}

const pad = (i: number) => String(i).padStart(6, "0");

/** Our layout in Commet's shape. Name and colour have no home there. Entries
 *  for spaces we don't lay out are kept from `existing`, so writing doesn't
 *  drop what Commet knows about spaces we haven't placed. */
export function layoutToCommet(
    layout: SpaceLayout,
    existing?: unknown,
): CommetOrdering {
    const spaces: NonNullable<CommetOrdering["spaces"]> = {};
    const groups: NonNullable<CommetOrdering["groups"]> = {};

    layout.order.forEach((id, i) => {
        const folder = layout.folders[id];
        if (!folder) {
            spaces[id] = { order: pad(i) };
            return;
        }
        groups[id] = { order: pad(i) };
        folder.spaceIds.forEach((spaceId, j) => {
            spaces[spaceId] = { group: id, order: pad(j) };
        });
    });

    const prior =
        isRecord(existing) && isRecord(existing.spaces) ? existing.spaces : {};
    const kept: NonNullable<CommetOrdering["spaces"]> = {};
    for (const [id, v] of Object.entries(prior)) {
        if (!(id in spaces) && isRecord(v)) {
            kept[id] = v as { group?: string; order?: string };
        }
    }
    return {
        spaces: { ...kept, ...spaces },
        ...(Object.keys(groups).length ? { groups } : {}),
    };
}

/** Top-level order from Element's per-space `order`. Spaces without a valid
 *  one are left out (the sidebar appends those itself). */
export function elementToLayout(
    orders: Map<string, unknown>,
): SpaceLayout | null {
    const entries: [string, string][] = [];
    for (const [id, order] of orders) {
        if (typeof order === "string" && order.length > 0)
            entries.push([id, order]);
    }
    if (!entries.length) return null;
    return { order: entries.sort(byOrder).map((e) => e[0]), folders: {} };
}
