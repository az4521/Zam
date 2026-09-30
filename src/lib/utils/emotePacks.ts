// Pure helpers for MSC2545 image packs: the `im.ponies.emote_rooms` account
// data (packs a user has enabled globally), pack metadata edits and shortcode
// de-duplication. Kept free of the Matrix client so it is unit-testable.

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
    [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
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
