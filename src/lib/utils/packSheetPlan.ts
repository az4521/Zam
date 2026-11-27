// Pure planning for the pack sprite sheets (matrix/packSheets.ts): how a pack
// is split into sheets, how a sheet is identified, where one cell sits, which
// cached sheets to drop, and how a stored manifest is validated. Nothing here
// touches the DOM, Cache Storage or the network.
//
// A sheet is identified by the ordered mxc list it holds. mxc media never
// changes, so a sheet built once stays valid for as long as it is kept.

export const SHEET_FORMAT_VERSION = 1;
/** Cells per row. Every sheet is this many columns wide. */
export const SHEET_COLS = 8;
/** Most cells in one sheet; a bigger pack is split into several sheets. */
export const SHEET_MAX_CELLS = 64;

/** Total bytes of stored sheets kept on the device. */
export const PACK_SHEET_CACHE_MAX_BYTES = 64 * 1024 * 1024;
export const PACK_SHEET_CACHE_MAX_ENTRIES = 400;

export type PackSheetKind = "emoji" | "sticker";

export interface PackSheetKindConfig {
    /** Edge of one square cell, in device pixels of the sheet. */
    cell: number;
    /** Thumbnail edge requested from the homeserver. */
    fetchSize: number;
}

export const PACK_SHEET_KINDS: Record<PackSheetKind, PackSheetKindConfig> = {
    emoji: { cell: 96, fetchSize: 96 },
    sticker: { cell: 128, fetchSize: 192 },
};

export function isPackSheetKind(value: unknown): value is PackSheetKind {
    return value === "emoji" || value === "sticker";
}

export interface SheetImage {
    mxc: string;
    mimetype?: string;
    /** Set when the pack says the image is animated, whatever the thumbnail
     *  shows (a server without animated thumbnails returns a still). */
    animatedHint?: boolean;
}

/** A pack split into sheet-sized chunks. Duplicate mxc URIs are dropped
 *  (first one wins), order is kept, and no chunk exceeds SHEET_MAX_CELLS. */
export function chunkPack(images: SheetImage[]): SheetImage[][] {
    const seen = new Set<string>();
    const unique: SheetImage[] = [];
    for (const img of images) {
        if (!img || typeof img.mxc !== "string" || img.mxc === "") continue;
        if (seen.has(img.mxc)) continue;
        seen.add(img.mxc);
        unique.push(img);
    }
    const chunks: SheetImage[][] = [];
    for (let i = 0; i < unique.length; i += SHEET_MAX_CELLS)
        chunks.push(unique.slice(i, i + SHEET_MAX_CELLS));
    return chunks;
}

/** cyrb53: a synchronous 53-bit string hash. `seed` selects an independent
 *  hash, so two seeds give 106 bits without BigInt (old WebViews). */
function cyrb53(text: string, seed: number): number {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Stable identity of a sheet: format version, kind, cell size and the
 *  ordered mxc list. The same images in another order are another sheet
 *  (the cells sit in another place). */
export function sheetKey(kind: PackSheetKind, mxcs: string[]): string {
    const cell = PACK_SHEET_KINDS[kind].cell;
    const text = [SHEET_FORMAT_VERSION, kind, cell, ...mxcs].join("\n");
    const hi = cyrb53(text, 0).toString(16).padStart(14, "0");
    const lo = cyrb53(text, 1).toString(16).padStart(14, "0");
    return `${kind}-${hi}${lo}`;
}

/** Rows a sheet of `count` cells needs. */
export function sheetRows(count: number, cols = SHEET_COLS): number {
    return Math.ceil(count / cols);
}

/** Whether a cell should play as an animation. `sniffed` is the result of
 *  looking at the bytes; the pack hint and the mimetype also count. */
export function likelyAnimated(img: SheetImage, sniffed: boolean): boolean {
    return (
        sniffed ||
        img.animatedHint === true ||
        img.mimetype === "image/gif" ||
        img.mimetype === "image/apng"
    );
}

/** CSS that paints cell `index` of a sheet as a background, or "" when the
 *  blob URL is not one of ours or the index is outside the sheet. Every
 *  number is computed here, so the percent math matches emojiSprites.ts: 0%
 *  puts the first column/row at the start, 100% the last. */
export function cellStyle(
    blobUrl: string,
    index: number,
    rows: number,
    cols = SHEET_COLS,
): string {
    if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) return "";
    // The URL goes inside url("..."): refuse anything that could end the
    // string or the declaration. Real blob URLs contain none of these.
    if (/["'()\\;<>\s]/.test(blobUrl)) return "";
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        !Number.isInteger(rows) ||
        rows < 1 ||
        !Number.isInteger(cols) ||
        cols < 1 ||
        index >= rows * cols
    )
        return "";
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return (
        `background-image:url("${blobUrl}");` +
        `background-size:${cols * 100}% ${rows * 100}%;` +
        `background-position:${x}% ${y}%;` +
        `background-repeat:no-repeat`
    );
}

/** One stored sheet, as the cache index remembers it. */
export interface PackSheetEntry {
    key: string;
    /** Bytes of the stored image. */
    bytes: number;
    /** Epoch ms of the last read or write. */
    lastUsed: number;
}

export type PackSheetIndex = PackSheetEntry[];

/** An index from whatever was stored: bad entries are dropped, never thrown. */
export function parsePackSheetIndex(json: unknown): PackSheetIndex {
    if (!Array.isArray(json)) return [];
    const seen = new Set<string>();
    const out: PackSheetIndex = [];
    for (const raw of json) {
        if (!raw || typeof raw !== "object") continue;
        const { key, bytes, lastUsed } = raw as Record<string, unknown>;
        if (typeof key !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(key))
            continue;
        if (seen.has(key)) continue;
        if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0)
            continue;
        if (typeof lastUsed !== "number" || !Number.isFinite(lastUsed))
            continue;
        seen.add(key);
        out.push({ key, bytes, lastUsed });
    }
    return out;
}

/** Keys to remove, least recently used first, so what is left fits the byte
 *  and entry caps. A `lastUsed` in the future (clock moved back) counts as
 *  `now`, so such an entry cannot stay forever. */
export function planPackSheetEviction(
    index: PackSheetIndex,
    now: number,
): string[] {
    let bytes = 0;
    for (const e of index) bytes += e.bytes;
    let count = index.length;
    const oldest = index
        .map((e) => ({
            key: e.key,
            bytes: e.bytes,
            used: Math.min(e.lastUsed, now),
        }))
        .sort((a, b) => a.used - b.used);
    const drop: string[] = [];
    for (const e of oldest) {
        if (
            bytes <= PACK_SHEET_CACHE_MAX_BYTES &&
            count <= PACK_SHEET_CACHE_MAX_ENTRIES
        )
            break;
        drop.push(e.key);
        bytes -= e.bytes;
        count--;
    }
    return drop;
}

/** The manifest stored beside each sheet image. */
export interface PackSheetMeta {
    v: number;
    kind: PackSheetKind;
    cell: number;
    cols: number;
    rows: number;
    mxcs: string[];
    animated: boolean[];
    missing: boolean[];
}

/** A manifest, validated, or null. Lengths must agree and match the sheet
 *  shape the current format version would make for those images. */
export function parseSheetMeta(json: unknown): PackSheetMeta | null {
    if (!json || typeof json !== "object") return null;
    const m = json as Record<string, unknown>;
    if (m.v !== SHEET_FORMAT_VERSION) return null;
    if (!isPackSheetKind(m.kind)) return null;
    const cfg = PACK_SHEET_KINDS[m.kind];
    if (m.cell !== cfg.cell || m.cols !== SHEET_COLS) return null;
    const { mxcs, animated, missing } = m;
    if (
        !Array.isArray(mxcs) ||
        !Array.isArray(animated) ||
        !Array.isArray(missing)
    )
        return null;
    const n = mxcs.length;
    if (n < 1 || n > SHEET_MAX_CELLS) return null;
    if (animated.length !== n || missing.length !== n) return null;
    if (m.rows !== sheetRows(n)) return null;
    if (!mxcs.every((s) => typeof s === "string" && s !== "")) return null;
    if (!animated.every((b) => typeof b === "boolean")) return null;
    if (!missing.every((b) => typeof b === "boolean")) return null;
    return {
        v: SHEET_FORMAT_VERSION,
        kind: m.kind,
        cell: cfg.cell,
        cols: SHEET_COLS,
        rows: sheetRows(n),
        mxcs: mxcs as string[],
        animated: animated as boolean[],
        missing: missing as boolean[],
    };
}

/** Pixel size of a sheet of `count` cells. */
export function sheetDimensions(
    kind: PackSheetKind,
    count: number,
): { width: number; height: number } {
    const cell = PACK_SHEET_KINDS[kind].cell;
    return {
        width: SHEET_COLS * cell,
        height: sheetRows(count) * cell,
    };
}
