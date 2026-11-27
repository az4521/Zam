/**
 * Sprite sheets for custom emoji and sticker packs. A pack's images are drawn
 * from a few generated sheet images instead of one <img> each: one request,
 * one decode and one GPU texture per sheet rather than per image.
 *
 * A sheet is built once on the device from the homeserver thumbnails, stored
 * in Cache Storage (per user, on a reserved synthetic host, like
 * soundCache.ts) and kept in memory as a blob URL for the session. Its
 * identity is the ordered mxc list, which never changes.
 *
 * Callers use `ensurePackSheets` to ask for sheets, read `spriteFor` for the
 * cell of an image, and fall back to a plain <img> whenever `spriteFor`
 * returns null (not built yet, or the cell failed to draw).
 */
import { captureClient, ownedClient } from "$lib/matrix/runtime";
import { fetchMediaBytes, mxcToHttp } from "$lib/matrix/media";
import { isAnimatedImage } from "$lib/utils/tileImage";
import { onSessionTeardown } from "$lib/utils/sessionCleanup";
import { packSheetsState } from "$lib/stores/packSheets.svelte";
import {
    PACK_SHEET_KINDS,
    SHEET_COLS,
    SHEET_FORMAT_VERSION,
    cellStyle,
    chunkPack,
    likelyAnimated,
    parsePackSheetIndex,
    parseSheetMeta,
    planPackSheetEviction,
    sheetKey,
    sheetRows,
    type PackSheetEntry,
    type PackSheetIndex,
    type PackSheetKind,
    type PackSheetMeta,
    type SheetImage,
} from "$lib/utils/packSheetPlan";

export type { PackSheetKind, SheetImage };

export const PACK_SHEET_CACHE_NAME = "zam-pack-sheets-v1";
const HOST = "https://pack-sheets.invalid/";

/** Encoded bytes of sheets held as blob URLs at once. Decoded pixels are the
 *  browser's to discard, so the encoded size is what this caps. */
const MAX_LOADED_BYTES = 48 * 1024 * 1024;
/** Sheets held as blob URLs at once, whatever their size. */
const MAX_LOADED_SHEETS = 512;
const FETCH_CONCURRENCY = 4;
/** Largest thumbnail accepted. Thumbnails are far smaller; this is a ceiling. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const WEBP_QUALITY = 0.92;

type Owner = ReturnType<typeof captureClient>;
type SheetCanvas = OffscreenCanvas | HTMLCanvasElement;
type SheetContext =
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface LoadedSheet {
    key: string;
    kind: PackSheetKind;
    url: string;
    /** Encoded size of the sheet image. */
    bytes: number;
    meta: PackSheetMeta;
}

interface Job {
    key: string;
    kind: PackSheetKind;
    chunk: SheetImage[];
    owner: Owner;
    epoch: number;
}

/** Sheets in memory, in LRU order (oldest first). */
const loaded = new Map<string, LoadedSheet>();
/** `${kind}\n${mxc}` -> where the cell is, for loaded sheets only. */
const cells = new Map<string, { key: string; index: number }>();
/** Sum of `bytes` over `loaded`. */
let loadedBytes = 0;
/** Keys queued or running, so one sheet is never built twice at once. */
const pending = new Set<string>();
const queue: Job[] = [];
let pumping = false;
/** Bumped on session teardown; a job from an older epoch is abandoned. */
let epoch = 0;
let current: AbortController | null = null;
/** Set once the device cannot draw a sheet, so renders stop re-queuing. */
let noCanvas = false;

const cellKey = (kind: PackSheetKind, mxc: string) => `${kind}\n${mxc}`;

/** Gap between tick bumps. Each bump re-sanitizes every message with
 *  emoticons, so a burst of sheet installs becomes one re-render. */
const TICK_COALESCE_MS = 100;
let tickTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedules at most one `packSheetsState.tick` increment per window. */
function bumpTick(): void {
    if (tickTimer !== null) return;
    tickTimer = setTimeout(() => {
        tickTimer = null;
        packSheetsState.tick++;
    }, TICK_COALESCE_MS);
}

// Requests. The user id is in the path so accounts keep separate stores.
const sheetUrl = (userId: string, key: string, ext = "") =>
    `${HOST}${encodeURIComponent(userId)}/${key}${ext}`;
const indexUrl = (userId: string) =>
    `${HOST}${encodeURIComponent(userId)}/__index`;

async function openCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return null;
    try {
        return await caches.open(PACK_SHEET_CACHE_NAME);
    } catch {
        return null; // storage blocked (private mode, disabled site data)
    }
}

async function readIndex(
    cache: Cache,
    userId: string,
): Promise<PackSheetIndex> {
    try {
        const res = await cache.match(indexUrl(userId));
        return res ? parsePackSheetIndex(await res.json()) : [];
    } catch {
        return [];
    }
}

// Index updates are read-modify-write; run them one at a time.
let indexChain: Promise<unknown> = Promise.resolve();
function withIndex(
    cache: Cache,
    userId: string,
    edit: (index: PackSheetIndex) => Promise<PackSheetIndex> | PackSheetIndex,
): Promise<void> {
    const run = indexChain.then(async () => {
        const index = await readIndex(cache, userId);
        const next = await edit(index);
        await cache.put(
            indexUrl(userId),
            new Response(JSON.stringify(next), {
                headers: { "content-type": "application/json" },
            }),
        );
    });
    indexChain = run.catch(() => {});
    return run.catch(() => {});
}

function upsert(index: PackSheetIndex, entry: PackSheetEntry): PackSheetIndex {
    return [...index.filter((e) => e.key !== entry.key), entry];
}

/** Whether a job still owns the runtime and has not been torn down. */
function alive(job: Job): boolean {
    return job.epoch === epoch && ownedClient(job.owner) !== null;
}

function touch(key: string): void {
    const sheet = loaded.get(key);
    if (!sheet) return;
    loaded.delete(key); // re-insert at the most recent end
    loaded.set(key, sheet);
}

function dropLoaded(key: string): void {
    const sheet = loaded.get(key);
    if (!sheet) return;
    loaded.delete(key);
    loadedBytes -= sheet.bytes;
    sheet.meta.mxcs.forEach((mxc) => {
        const hit = cells.get(cellKey(sheet.kind, mxc));
        if (hit && hit.key === key) cells.delete(cellKey(sheet.kind, mxc));
    });
    URL.revokeObjectURL(sheet.url);
}

function install(sheet: LoadedSheet): void {
    if (loaded.has(sheet.key)) {
        URL.revokeObjectURL(sheet.url);
        return;
    }
    loaded.set(sheet.key, sheet);
    loadedBytes += sheet.bytes;
    sheet.meta.mxcs.forEach((mxc, index) => {
        if (!sheet.meta.missing[index])
            cells.set(cellKey(sheet.kind, mxc), { key: sheet.key, index });
    });
    // Oldest first. The sheet just installed is the newest, so it stays
    // unless it alone is over budget.
    while (
        loaded.size > 1 &&
        (loadedBytes > MAX_LOADED_BYTES || loaded.size > MAX_LOADED_SHEETS)
    ) {
        const oldest = loaded.keys().next().value;
        if (oldest === undefined) break;
        dropLoaded(oldest);
    }
    bumpTick();
}

/**
 * Ask for sheets covering `packs` (each pack is a list of images). Sheets
 * already loaded are touched; the rest are read from Cache Storage or built,
 * one at a time, in the background. Safe to call on every render: work is
 * deduped by sheet key. Never throws.
 */
export function ensurePackSheets(
    kind: PackSheetKind,
    packs: SheetImage[][],
): void {
    if (noCanvas) return;
    try {
        const owner = captureClient();
        let added = false;
        for (const pack of packs) {
            for (const chunk of chunkPack(pack)) {
                const key = sheetKey(
                    kind,
                    chunk.map((i) => i.mxc),
                );
                if (loaded.has(key)) {
                    touch(key);
                    continue;
                }
                if (pending.has(key)) continue;
                pending.add(key);
                queue.push({ key, kind, chunk, owner, epoch });
                added = true;
            }
        }
        if (added) void pump();
    } catch {
        // No session, or nothing to build from: the plain <img> path stays.
    }
}

/**
 * The sprite for one pack image: a CSS background style and whether the
 * cell is animated. Null when its sheet is not loaded or the cell failed to
 * draw. Synchronous, so it is safe inside a `$derived`.
 */
export function spriteFor(
    kind: PackSheetKind,
    mxc: string,
): { style: string; animated: boolean } | null {
    try {
        const hit = cells.get(cellKey(kind, mxc));
        if (!hit) return null;
        const sheet = loaded.get(hit.key);
        if (!sheet || sheet.meta.missing[hit.index]) return null;
        const style = cellStyle(sheet.url, hit.index, sheet.meta.rows);
        if (!style) return null;
        return { style, animated: sheet.meta.animated[hit.index] === true };
    } catch {
        return null;
    }
}

/** SheetImages for a pack's emoji or stickers, from their mxc and MSC2545
 *  info. Callers pass the result to `ensurePackSheets`. */
export function sheetImagesOf(
    images: { mxcUrl: string; info?: Record<string, unknown> }[],
): SheetImage[] {
    return images.map((img) => {
        const info = img.info;
        const mimetype =
            typeof info?.mimetype === "string" ? info.mimetype : undefined;
        const animatedHint =
            info?.is_animated === true ||
            info?.["org.matrix.msc4230.is_animated"] === true;
        return { mxc: img.mxcUrl, mimetype, animatedHint };
    });
}

async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
        while (queue.length > 0) {
            const job = queue.shift();
            if (!job) break;
            try {
                await runJob(job);
            } catch {
                // One bad sheet must not stop the rest of the queue.
            } finally {
                if (job.epoch === epoch) pending.delete(job.key);
            }
        }
    } finally {
        pumping = false;
    }
}

async function runJob(job: Job): Promise<void> {
    if (!alive(job)) return;
    const userId = job.owner.client.getUserId();
    if (!userId) return;

    const cached = await readCached(userId, job);
    if (!alive(job)) {
        if (cached) URL.revokeObjectURL(cached.url);
        return;
    }
    if (cached) {
        install(cached);
        return;
    }

    const ac = new AbortController();
    current = ac;
    let built: BuiltSheet | null;
    try {
        built = await buildSheet(job, ac.signal);
    } finally {
        if (current === ac) current = null;
    }
    if (!built || !alive(job)) return;
    install({
        key: job.key,
        kind: job.kind,
        url: URL.createObjectURL(built.blob),
        bytes: built.blob.size,
        meta: built.meta,
    });
    // Only sheets that are mostly complete are kept on disk. A sheet built
    // while offline or against failing servers stays in memory and is tried
    // again next session.
    if (built.persist) await persistSheet(userId, job.key, built);
}

async function readCached(
    userId: string,
    job: Job,
): Promise<LoadedSheet | null> {
    const cache = await openCache();
    if (!cache) return null;
    try {
        const metaRes = await cache.match(sheetUrl(userId, job.key, ".json"));
        if (!metaRes) return null;
        const meta = parseSheetMeta(await metaRes.json());
        if (
            !meta ||
            meta.kind !== job.kind ||
            meta.mxcs.length !== job.chunk.length ||
            meta.mxcs.some((mxc, i) => mxc !== job.chunk[i].mxc)
        )
            return null;
        const imgRes = await cache.match(sheetUrl(userId, job.key));
        if (!imgRes) return null;
        const blob = await imgRes.blob();
        void withIndex(cache, userId, (index) =>
            upsert(index, {
                key: job.key,
                bytes: blob.size,
                lastUsed: Date.now(),
            }),
        );
        return {
            key: job.key,
            kind: job.kind,
            url: URL.createObjectURL(blob),
            bytes: blob.size,
            meta,
        };
    } catch {
        return null;
    }
}

interface BuiltSheet {
    blob: Blob;
    meta: PackSheetMeta;
    persist: boolean;
}

/** Draw a sheet from the homeserver thumbnails. Null when the session ended
 *  or the canvas is unavailable. */
async function buildSheet(
    job: Job,
    signal: AbortSignal,
): Promise<BuiltSheet | null> {
    const cfg = PACK_SHEET_KINDS[job.kind];
    const count = job.chunk.length;
    const rows = sheetRows(count);
    const canvas = makeCanvas(SHEET_COLS * cfg.cell, rows * cfg.cell);
    const ctx = canvas
        ? (canvas.getContext("2d") as SheetContext | null)
        : null;
    if (!canvas || !ctx) {
        noCanvas = true;
        return null;
    }

    const animated: boolean[] = new Array<boolean>(count).fill(false);
    const missing: boolean[] = new Array<boolean>(count).fill(true);

    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < count) {
            const index = next++;
            try {
                const res = await drawCell(
                    ctx,
                    cfg.cell,
                    cfg.fetchSize,
                    job.chunk[index],
                    index,
                    signal,
                );
                if (res) {
                    animated[index] = res.animated;
                    missing[index] = false;
                }
            } catch {
                // Cell stays missing; the caller falls back to an <img>.
            }
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, count) }, worker),
    );
    if (!alive(job)) return null;

    const blob = await encodeCanvas(canvas);
    if (!blob) return null;
    const missingCount = missing.filter(Boolean).length;
    return {
        blob,
        meta: {
            v: SHEET_FORMAT_VERSION,
            kind: job.kind,
            cell: cfg.cell,
            cols: SHEET_COLS,
            rows,
            mxcs: job.chunk.map((i) => i.mxc),
            animated,
            missing,
        },
        persist: missingCount * 2 <= count,
    };
}

async function drawCell(
    ctx: SheetContext,
    cell: number,
    fetchSize: number,
    img: SheetImage,
    index: number,
    signal: AbortSignal,
): Promise<{ animated: boolean } | null> {
    const url = mxcToHttp(img.mxc, fetchSize, fetchSize, "scale");
    if (!url) return null;
    const bytes = await fetchMediaBytes(url, MAX_IMAGE_BYTES, signal);
    const sniffed = isAnimatedImage(new Uint8Array(bytes));
    // createImageBitmap decodes the first frame of an animation.
    const bitmap = await createImageBitmap(new Blob([bytes]));
    try {
        if (!bitmap.width || !bitmap.height) return null;
        // object-fit: contain, centred in the cell.
        const scale = Math.min(cell / bitmap.width, cell / bitmap.height);
        const w = bitmap.width * scale;
        const h = bitmap.height * scale;
        const x = (index % SHEET_COLS) * cell + (cell - w) / 2;
        const y = Math.floor(index / SHEET_COLS) * cell + (cell - h) / 2;
        ctx.drawImage(bitmap, x, y, w, h);
    } finally {
        bitmap.close();
    }
    return { animated: likelyAnimated(img, sniffed) };
}

function makeCanvas(width: number, height: number): SheetCanvas | null {
    try {
        if (typeof OffscreenCanvas !== "undefined")
            return new OffscreenCanvas(width, height);
        if (typeof document !== "undefined") {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }
    } catch {
        // Canvas size refused (too large for this device).
    }
    return null;
}

function canvasToBlob(
    canvas: SheetCanvas,
    type: string,
    quality?: number,
): Promise<Blob | null> {
    try {
        if ("convertToBlob" in canvas)
            return canvas.convertToBlob({ type, quality }).catch(() => null);
        return new Promise((resolve) =>
            canvas.toBlob((b) => resolve(b), type, quality),
        );
    } catch {
        return Promise.resolve(null);
    }
}

/** WebP when the browser can encode it, otherwise PNG (old Safari). */
async function encodeCanvas(canvas: SheetCanvas): Promise<Blob | null> {
    const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (webp && webp.type === "image/webp") return webp;
    return canvasToBlob(canvas, "image/png");
}

async function persistSheet(
    userId: string,
    key: string,
    built: BuiltSheet,
): Promise<void> {
    const cache = await openCache();
    if (!cache) return;
    try {
        await cache.put(
            sheetUrl(userId, key),
            new Response(built.blob, {
                headers: { "content-type": built.blob.type || "image/png" },
            }),
        );
        await cache.put(
            sheetUrl(userId, key, ".json"),
            new Response(JSON.stringify(built.meta), {
                headers: { "content-type": "application/json" },
            }),
        );
    } catch {
        return; // quota or blocked: the sheet lives in memory only
    }
    await withIndex(cache, userId, async (index) => {
        let next = upsert(index, {
            key,
            bytes: built.blob.size,
            lastUsed: Date.now(),
        });
        const drop = planPackSheetEviction(next, Date.now());
        for (const old of drop) {
            next = next.filter((e) => e.key !== old);
            await cache.delete(sheetUrl(userId, old)).catch(() => false);
            await cache
                .delete(sheetUrl(userId, old, ".json"))
                .catch(() => false);
        }
        return next;
    });
}

onSessionTeardown(() => {
    epoch++;
    current?.abort();
    current = null;
    for (const key of [...loaded.keys()]) dropLoaded(key);
    loadedBytes = 0;
    cells.clear();
    queue.length = 0;
    pending.clear();
    if (tickTimer !== null) {
        clearTimeout(tickTimer);
        tickTimer = null;
    }
    packSheetsState.tick++;
});
