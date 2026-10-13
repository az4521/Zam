// Pure helpers for MSC2545 image packs: the `im.ponies.emote_rooms` account
// data (packs a user has enabled globally), pack metadata edits and shortcode
// de-duplication. Kept free of the Matrix client so it is unit-testable.

// MSC2545 moved off the `im.ponies` prefix. Current clients (Sable) write the
// stable names and only keep the old ones up to date where they already
// exist, so a pack made there may only be in `m.room.image_pack`; older
// clients only know `im.ponies`. Read both, stable winning; writes never add
// an old-name copy (packWriteTypes).
export const ROOM_PACK_TYPE = "m.room.image_pack";
export const LEGACY_ROOM_PACK_TYPE = "im.ponies.room_emotes";
export const EMOTE_ROOMS_TYPE = "m.image_pack.rooms";
export const LEGACY_EMOTE_ROOMS_TYPE = "im.ponies.emote_rooms";

export interface EmoteRoomsContent {
    rooms?: Record<string, Record<string, Record<string, unknown>>>;
}

export interface EmoteRoomRef {
    roomId: string;
    stateKey: string;
}

export interface PackMetaUpdate {
    displayName?: string;
    /** mxc:// avatar; null removes it. */
    avatarMxc?: string | null;
    /** Free-text credit; null/blank removes it. */
    attribution?: string | null;
    /** Pack-level usage default; null removes it (both kinds). */
    usage?: Array<"emoticon" | "sticker"> | null;
}

interface PackContentLike {
    pack?: {
        display_name?: string;
        avatar_url?: string;
        attribution?: string;
        usage?: string[];
        [key: string]: unknown;
    };
    images?: Record<string, unknown>;
    [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Whether pack content describes a pack; MSC2545 deletes one with `{}`. */
export function hasPackContent(content: unknown): boolean {
    return (
        isRecord(content) &&
        (content.pack !== undefined || content.images !== undefined)
    );
}

/** One pack's content from its stable and legacy state events (undefined when
 *  there is no event), merged the way Sable does so both clients show the
 *  same pack: the stable event's metadata and images win per key, and an
 *  empty stable event deletes the pack whatever the legacy one holds. */
export function mergePackContent<T extends PackContentLike>(
    stable: T | undefined | null,
    legacy: T | undefined | null,
): T {
    if (stable == null) return legacy ?? ({} as T);
    if (!hasPackContent(stable) || !legacy || !hasPackContent(legacy)) {
        return stable;
    }
    return {
        ...legacy,
        ...stable,
        pack: { ...legacy.pack, ...stable.pack },
        images: { ...legacy.images, ...stable.images },
    };
}

/** The events a write to a pack has to touch, in order, given its current
 *  stable and legacy contents (undefined when there is no event). Nothing is
 *  ever copied into an event the pack doesn't already use.
 *
 *  The stable event decides the merge whenever it exists, so it is written.
 *  The legacy one is written while it holds content, or an image removed from
 *  the stable event would come back through the merge (Sable keeps it updated
 *  for the same reason). An existing legacy-only pack stays legacy-only.
 *
 *  A new pack is created under the stable name like Sable does, unless
 *  `maySend` says our power level only covers `im.ponies` (rooms that lowered
 *  just that level so members can add emotes keep working). */
export function packWriteTypes(
    stable: unknown,
    legacy: unknown,
    maySend: (type: string) => boolean = () => true,
): string[] {
    if (stable != null) {
        return hasPackContent(legacy)
            ? [ROOM_PACK_TYPE, LEGACY_ROOM_PACK_TYPE]
            : [ROOM_PACK_TYPE];
    }
    if (hasPackContent(legacy) || !maySend(ROOM_PACK_TYPE)) {
        return [LEGACY_ROOM_PACK_TYPE];
    }
    return [ROOM_PACK_TYPE];
}

/** Every (room, state key) pair the user has enabled globally. */
export function parseEmoteRooms(
    content: EmoteRoomsContent | undefined | null,
): EmoteRoomRef[] {
    const rooms = content?.rooms;
    if (!isRecord(rooms)) return [];
    const out: EmoteRoomRef[] = [];
    for (const [roomId, packs] of Object.entries(rooms)) {
        if (!roomId.startsWith("!") || !isRecord(packs)) continue;
        for (const stateKey of Object.keys(packs)) {
            out.push({ roomId, stateKey });
        }
    }
    return out;
}

export function hasEmoteRoom(
    content: EmoteRoomsContent | undefined | null,
    roomId: string,
    stateKey: string,
): boolean {
    const packs = content?.rooms?.[roomId];
    return isRecord(packs) && Object.hasOwn(packs, stateKey);
}

/** New emote_rooms content with the pair enabled or disabled. Other keys on
 *  the content, and other rooms' entries, are preserved untouched. */
export function withEmoteRoom(
    content: EmoteRoomsContent | undefined | null,
    roomId: string,
    stateKey: string,
    enabled: boolean,
): EmoteRoomsContent {
    const rooms: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [id, packs] of Object.entries(content?.rooms ?? {})) {
        if (isRecord(packs)) rooms[id] = { ...packs };
    }
    if (enabled) {
        rooms[roomId] = {
            ...(rooms[roomId] ?? {}),
            [stateKey]: rooms[roomId]?.[stateKey] ?? {},
        };
    } else if (rooms[roomId]) {
        delete rooms[roomId][stateKey];
        if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
    }
    return { ...(content ?? {}), rooms };
}

/** Apply metadata edits to pack content, keeping unknown pack fields. Empty
 *  values are dropped rather than stored as "". */
export function applyPackMeta<T extends PackContentLike>(
    content: T,
    update: PackMetaUpdate,
): T {
    const pack = { ...(content.pack ?? {}) };
    if (update.displayName !== undefined) {
        const name = update.displayName.trim();
        if (name) pack.display_name = name;
        else delete pack.display_name;
    }
    if (update.avatarMxc !== undefined) {
        if (update.avatarMxc) pack.avatar_url = update.avatarMxc;
        else delete pack.avatar_url;
    }
    if (update.attribution !== undefined) {
        const text = update.attribution?.trim();
        if (text) pack.attribution = text;
        else delete pack.attribution;
    }
    if (update.usage !== undefined) {
        if (update.usage && update.usage.length > 0) {
            pack.usage = [...new Set(update.usage)];
        } else delete pack.usage;
    }
    return { ...content, pack };
}

/** `wanted`, or `wanted_2`, `wanted_3`... whichever is free in `taken`. */
export function uniqueShortcode(taken: Set<string>, wanted: string): string {
    if (!taken.has(wanted)) return wanted;
    let n = 2;
    while (taken.has(`${wanted}_${n}`)) n++;
    return `${wanted}_${n}`;
}

/** MSC2545 image `info` for an uploaded file: dimensions when the browser can
 *  decode it, plus mimetype and size. Never throws. */
export async function readImageInfo(
    file: File,
): Promise<Record<string, unknown>> {
    const info: Record<string, unknown> = { size: file.size };
    if (file.type) info.mimetype = file.type;
    try {
        if (typeof createImageBitmap === "function") {
            const bitmap = await createImageBitmap(file);
            info.w = bitmap.width;
            info.h = bitmap.height;
            bitmap.close?.();
        }
    } catch {
        /* undecodable (e.g. SVG in some engines): size and type still help */
    }
    return info;
}
