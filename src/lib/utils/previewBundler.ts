/**
 * Building the MSC4095 previews bundled into a message being sent.
 *
 * A link is prepared for its room as soon as it is typed (the composer calls
 * `prepare`): the page is read from this device when it can (desktop,
 * Android: linkPageFetch.ts), else, or when that finds nothing, from the
 * homeserver's /preview_url, and its image is uploaded into the room
 * (encrypted in an encrypted room). Send then takes the finished entries
 * synchronously (`ready`). It never waits: an awaited send could be
 * overtaken by the next message, and send order is permanent. A link not
 * ready by then gets no bundled preview, and receivers ask their homeserver
 * as they always have.
 *
 * Dependencies are injected, so this is testable without a network or SDK.
 */
import {
    buildBundledEntry,
    metaFromHomeserver,
    parseOpenGraph,
    type PageMeta,
    type UploadedPreviewImage,
} from "./bundledPreview";
import type { LinkPageResult } from "$lib/linkPageFetch";

export interface PreparedImage {
    bytes: Uint8Array;
    type: string;
    width?: number;
    height?: number;
}

export type PreparedPreview =
    | { meta: PageMeta; image?: PreparedImage; imageMxc?: undefined }
    | {
          meta: PageMeta;
          imageMxc?: string;
          imageSize?: number;
          image?: undefined;
      };

export interface BundlerDeps {
    /** This device's page fetch, or null when it has none. */
    fetchPage:
        | ((
              url: string,
              mode: "page" | "image",
          ) => Promise<LinkPageResult | null>)
        | null;
    /** The homeserver's raw /preview_url answer, or null. */
    homeserverPreview: (url: string) => Promise<Record<string, unknown> | null>;
    /** Upload a preview image into `roomId` (encrypted when the room is). */
    upload: (
        roomId: string,
        bytes: Uint8Array,
        type: string,
    ) => Promise<UploadedPreviewImage>;
    /** Pixel size of an image, when it can be decoded. */
    measure?: (
        bytes: Uint8Array,
        type: string,
    ) => Promise<{ width: number; height: number } | null>;
    now?: () => number;
}

/** Most links a message bundles previews for. */
export const MAX_BUNDLED = 5;
const CACHE_MAX = 50;
const CACHE_TTL_MS = 15 * 60_000;
const FAILURE_TTL_MS = 60_000;
/** How long a scheduled send waits for a link still being prepared. */
export const SEND_WAIT_MS = 3000;
const UPLOAD_WAIT_MS = 8000;

function base64Bytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function hasMeta(m: PageMeta): boolean {
    return !!(m.title || m.description);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        p.then(
            (v) => {
                clearTimeout(timer);
                resolve(v);
            },
            () => {
                clearTimeout(timer);
                resolve(null);
            },
        );
    });
}

export function createPreviewBundler(deps: BundlerDeps) {
    const now = deps.now ?? (() => Date.now());
    const cache = new Map<
        string,
        {
            at: number;
            promise: Promise<PreparedPreview | null>;
            failed?: boolean;
        }
    >();

    async function imageFrom(
        r: LinkPageResult | null,
    ): Promise<PreparedImage | undefined> {
        if (!r || r.kind !== "image") return undefined;
        const bytes = base64Bytes(r.base64);
        const size = (await deps.measure?.(bytes, r.contentType)) ?? null;
        return {
            bytes,
            type: r.contentType,
            width: size?.width,
            height: size?.height,
        };
    }

    async function fromDevice(url: string): Promise<PreparedPreview | null> {
        if (!deps.fetchPage) return null;
        const page = await deps.fetchPage(url, "page");
        if (!page) return null;
        if (page.kind === "image") {
            const image = await imageFrom(page);
            return image ? { meta: { url: page.finalUrl }, image } : null;
        }
        const meta = parseOpenGraph(page.html, page.finalUrl);
        const image = meta.image
            ? await imageFrom(await deps.fetchPage(meta.image, "image"))
            : undefined;
        if (!hasMeta(meta) && !image) return null;
        return { meta, image };
    }

    async function fromHomeserver(
        url: string,
    ): Promise<PreparedPreview | null> {
        const r = metaFromHomeserver(await deps.homeserverPreview(url), url);
        return r
            ? { meta: r.meta, imageMxc: r.imageMxc, imageSize: r.imageSize }
            : null;
    }

    async function build(url: string): Promise<PreparedPreview | null> {
        const device = await fromDevice(url).catch(() => null);
        if (device) return device;
        return fromHomeserver(url).catch(() => null);
    }

    /** Start preparing `url` (no-op when it is already prepared or underway). */
    function prefetch(url: string): Promise<PreparedPreview | null> {
        const hit = cache.get(url);
        const t = now();
        if (hit && t - hit.at < (hit.failed ? FAILURE_TTL_MS : CACHE_TTL_MS)) {
            cache.delete(url);
            cache.set(url, hit);
            return hit.promise;
        }
        const entry: {
            at: number;
            promise: Promise<PreparedPreview | null>;
            failed?: boolean;
        } = { at: t, promise: build(url) };
        entry.promise.then((r) => {
            if (!r) entry.failed = true;
        });
        cache.delete(url);
        cache.set(url, entry);
        while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
        return entry.promise;
    }

    async function entryFor(
        url: string,
        prepared: PreparedPreview,
        roomId: string,
    ): Promise<Record<string, unknown>> {
        if (prepared.image) {
            const img = prepared.image;
            const uploaded = await withTimeout(
                deps.upload(roomId, img.bytes, img.type),
                UPLOAD_WAIT_MS,
            );
            if (uploaded)
                return buildBundledEntry(url, prepared.meta, {
                    uploaded,
                    size: img.bytes.byteLength,
                    type: img.type,
                    width: img.width ?? prepared.meta.imageWidth,
                    height: img.height ?? prepared.meta.imageHeight,
                });
            return buildBundledEntry(url, prepared.meta);
        }
        if (prepared.imageMxc) {
            return buildBundledEntry(url, prepared.meta, {
                uploaded: { url: prepared.imageMxc },
                size: prepared.imageSize ?? 0,
                type: prepared.meta.imageType,
                width: prepared.meta.imageWidth,
                height: prepared.meta.imageHeight,
            });
        }
        return buildBundledEntry(url, prepared.meta);
    }

    // Finished entries per room and link; `pending` holds the ones underway
    // so a link typed again is not uploaded twice.
    const entries = new Map<string, Record<string, unknown>>();
    const pending = new Set<string>();
    const roomKey = (roomId: string, url: string) => `${roomId}
${url}`;

    /** Prepare `url` for a message to `roomId`, image upload included. */
    function prepare(url: string, roomId: string): Promise<void> {
        const key = roomKey(roomId, url);
        if (entries.has(key) || pending.has(key)) return Promise.resolve();
        pending.add(key);
        return prefetch(url)
            .then((prepared) =>
                prepared ? entryFor(url, prepared, roomId) : null,
            )
            .catch(() => null)
            .then((entry) => {
                pending.delete(key);
                if (!entry) return;
                entries.delete(key);
                entries.set(key, entry);
                while (entries.size > CACHE_MAX)
                    entries.delete(entries.keys().next().value!);
            });
    }

    /** The finished entries for `urls` in `roomId`, keyed by URL. */
    function ready(
        urls: string[],
        roomId: string,
    ): Map<string, Record<string, unknown>> {
        const out = new Map<string, Record<string, unknown>>();
        for (const url of urls.slice(0, MAX_BUNDLED)) {
            const entry = entries.get(roomKey(roomId, url));
            if (entry) out.set(url, entry);
        }
        return out;
    }

    /** As `ready`, but waits up to `waitMs` for links still being prepared.
     *  Only for sends whose order does not matter (scheduled messages). */
    async function collect(
        urls: string[],
        roomId: string,
        waitMs = SEND_WAIT_MS,
    ): Promise<Map<string, Record<string, unknown>>> {
        await withTimeout(
            Promise.all(
                urls.slice(0, MAX_BUNDLED).map((u) => prepare(u, roomId)),
            ),
            waitMs,
        );
        return ready(urls, roomId);
    }

    return { prefetch, prepare, ready, collect };
}

export type PreviewBundler = ReturnType<typeof createPreviewBundler>;
