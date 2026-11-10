// Favourites of uploaded GIFs. An encrypted upload has no plain URL, and its
// decryption key lives only in the message event, so the favourite stores a
// pointer to that event instead of the media. An unencrypted upload is keyed by
// an authenticated homeserver URL, which nothing can preview from the URL
// alone. The picker resolves either back to the bytes to show a tile and, when
// picked, to attach the GIF as a file.

import { fetchSingleEvent } from "$lib/matrix/client";
import {
    fetchAttachmentBlob,
    fetchDecryptedAttachmentBlob,
    mxcToHttp,
} from "$lib/matrix/media";
import type { EncryptedFileInfo } from "$lib/utils/decryptAttachment";
import { parseMxc } from "$lib/utils/mxcUri";
import { safeDimension } from "$lib/utils/mediaDimensions";
import { withExtension } from "$lib/utils/saveFile";

export interface EventFavouriteSource {
    roomId: string;
    eventId: string;
}

/** The `url` a favourite pointing at an event is keyed by. Not fetchable:
 *  everything that touches a favourite's url must check `source` first. */
export function eventFavouriteKey(source: EventFavouriteSource): string {
    return `matrix-event:${source.roomId}/${source.eventId}`;
}

/** Account data is untrusted on read: accept only a well-formed pointer. */
export function parseEventFavouriteSource(
    raw: unknown,
): EventFavouriteSource | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const { roomId, eventId } = raw as Record<string, unknown>;
    if (typeof roomId !== "string" || typeof eventId !== "string") {
        return undefined;
    }
    if (!roomId.startsWith("!") || !eventId.startsWith("$")) return undefined;
    return { roomId, eventId };
}

/** An EncryptedFile, as an event's `file` carries it. */
export type EncryptedFileLike = EncryptedFileInfo & { url: string };

/**
 * The media behind a favourite, in the shape a new event needs to point at it
 * again without uploading. Exactly one of `url` (plaintext media) or `file`
 * (encrypted media) is set. Built only from checked fields (see the sanitisers
 * below), never from raw event content.
 */
export interface ReusableMedia {
    url?: string;
    file?: EncryptedFileLike;
    /** mimetype, size, w, h and the thumbnail fields the source event had. */
    info: Record<string, unknown>;
}

/** Files built by the functions below, keyed by the File they came with. A
 *  WeakMap so a dropped File takes its entry with it. */
const reusableMedia = new WeakMap<File, ReusableMedia>();

/** The media a favourite File still points at, or undefined when it is only
 *  bytes (a file from anywhere else, or a favourite whose media is unknown). */
export function reusableMediaOfFile(file: File): ReusableMedia | undefined {
    return reusableMedia.get(file);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

/** An mxc URI, or undefined. Strict-parsed like every other mxc we accept. */
function mxcField(value: unknown): string | undefined {
    return typeof value === "string" && parseMxc(value) ? value : undefined;
}

/** A positive finite number (a byte count), or undefined. */
function sizeField(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : undefined;
}

/**
 * An untrusted EncryptedFile, copied field by field. Anything the decryption
 * needs that is missing or the wrong type makes the whole file unusable, so
 * the caller falls back to uploading the bytes.
 */
function sanitiseEncryptedFile(raw: unknown): EncryptedFileLike | undefined {
    if (!isRecord(raw)) return undefined;
    const url = mxcField(raw.url);
    const iv = stringField(raw.iv);
    const key = raw.key;
    const hashes = raw.hashes;
    if (!url || !iv || !isRecord(key) || !isRecord(hashes)) return undefined;
    const k = stringField(key.k);
    const sha256 = stringField(hashes.sha256);
    if (k === undefined || sha256 === undefined) return undefined;

    const fileKey: EncryptedFileInfo["key"] = { k };
    const kty = stringField(key.kty);
    const alg = stringField(key.alg);
    if (kty !== undefined) fileKey.kty = kty;
    if (alg !== undefined) fileKey.alg = alg;
    if (typeof key.ext === "boolean") fileKey.ext = key.ext;

    const fileHashes: EncryptedFileInfo["hashes"] = { sha256 };
    for (const [alg, value] of Object.entries(hashes)) {
        const hash = stringField(value);
        if (hash !== undefined) fileHashes[alg] = hash;
    }

    const v = stringField(raw.v);
    return {
        url,
        key: fileKey,
        iv,
        hashes: fileHashes,
        ...(v !== undefined ? { v } : {}),
    };
}

/**
 * The `info` a reused encrypted image keeps: what sendFile would have written
 * for it. Null unless the source says it is an image, since the picker only
 * reuses images. Thumbnail fields follow the media: `thumbnail_file` goes with
 * an encrypted original, as in an encrypted room's own uploads.
 */
function sanitiseEncryptedImageInfo(
    raw: unknown,
): Record<string, unknown> | undefined {
    if (!isRecord(raw)) return undefined;
    const mimetype = stringField(raw.mimetype);
    if (mimetype === undefined || !mimetype.startsWith("image/")) {
        return undefined;
    }
    const info: Record<string, unknown> = { mimetype };
    const size = sizeField(raw.size);
    const w = safeDimension(raw.w);
    const h = safeDimension(raw.h);
    if (size !== undefined) info.size = size;
    if (w !== null) info.w = w;
    if (h !== null) info.h = h;

    const thumbFile = sanitiseEncryptedFile(raw.thumbnail_file);
    if (thumbFile) {
        info.thumbnail_file = thumbFile;
        if (isRecord(raw.thumbnail_info)) {
            info.thumbnail_info = sanitiseThumbnailInfo(raw.thumbnail_info);
        }
    }
    return info;
}

function sanitiseThumbnailInfo(raw: Record<string, unknown>) {
    const info: Record<string, unknown> = {};
    const mimetype = stringField(raw.mimetype);
    const w = safeDimension(raw.w);
    const h = safeDimension(raw.h);
    const size = sizeField(raw.size);
    if (mimetype !== undefined) info.mimetype = mimetype;
    if (w !== null) info.w = w;
    if (h !== null) info.h = h;
    if (size !== undefined) info.size = size;
    return info;
}

/** Reusable media for a favourite's source event, or undefined when the event
 *  has no encrypted image worth reusing. */
function encryptedReusableMedia(content: {
    file?: unknown;
    info?: unknown;
}): ReusableMedia | undefined {
    const file = sanitiseEncryptedFile(content.file);
    const info = sanitiseEncryptedImageInfo(content.info);
    return file && info ? { file, info } : undefined;
}

interface EventFavourite {
    /** Object URL of the decrypted GIF. */
    url: string;
    /** The media to reuse, when the event's file can be trusted. */
    reuse: ReusableMedia | undefined;
}

const eventFavourites = new Map<string, Promise<EventFavourite | null>>();

/** The event a favourite points at: its decrypted GIF and reusable media. Null
 *  when the event is gone or can't be decrypted. Shared across tiles and
 *  picks, so the event is fetched once; failures aren't cached. */
function loadEventFavourite(
    source: EventFavouriteSource,
): Promise<EventFavourite | null> {
    const key = eventFavouriteKey(source);
    let p = eventFavourites.get(key);
    if (!p) {
        p = (async () => {
            const ev = await fetchSingleEvent(source.roomId, source.eventId);
            const content = ev?.getContent() as
                | {
                      file?: Parameters<typeof fetchDecryptedAttachmentBlob>[0];
                      info?: { mimetype?: string };
                  }
                | undefined;
            if (!content?.file) return null;
            const url = await fetchDecryptedAttachmentBlob(
                content.file,
                content.info?.mimetype ?? "image/gif",
            );
            return { url, reuse: encryptedReusableMedia(content) };
        })().catch(() => {
            eventFavourites.delete(key);
            return null;
        });
        eventFavourites.set(key, p);
    }
    return p;
}

/** Object URL of the pointed-at GIF, or null when the event is gone or can't
 *  be decrypted. Shared across tiles; failures aren't cached. */
export function resolveEventFavouriteUrl(
    source: EventFavouriteSource,
): Promise<string | null> {
    return loadEventFavourite(source).then((found) => found?.url ?? null);
}

/** The pointed-at GIF as a File, ready to attach to the composer. Carries the
 *  source event's media for reuse when it has some. */
export async function eventFavouriteFile(
    source: EventFavouriteSource,
): Promise<File | null> {
    const found = await loadEventFavourite(source);
    if (!found) return null;
    const file = favouriteAsFile(await (await fetch(found.url)).blob());
    if (found.reuse) reusableMedia.set(file, found.reuse);
    return file;
}

/** A favourite's bytes as a File named for what they are: a starred PNG or
 *  WebP sent as "favourite.gif" was misnamed on every other client. */
function favouriteAsFile(blob: Blob): File {
    const type = blob.type || "image/gif";
    return new File([blob], withExtension("favourite", type), { type });
}

/** A Matrix media download path, with any homeserver base prefix in front. */
const MEDIA_DOWNLOAD_RE =
    /^(?:.*\/)?_matrix\/(?:client\/v1\/media|media\/v3)\/download\/([^/]+)\/([^/?#]+)\/?$/;

/**
 * The `mxc://` content URI a Matrix media download URL names, whichever
 * homeserver that URL points at. Both the authenticated (`client/v1`) and
 * legacy (`media/v3`) download paths are accepted.
 *
 * A favourite created on another account or homeserver still names the media
 * itself in its URL, so the picker must not be limited to its own origin.
 * Account data is untrusted on read: both segments are strict-parsed back into
 * an mxc, which rejects path traversal and anything outside the spec grammar.
 */
export function matrixMediaMxc(url: string): string | null {
    if (url.startsWith("mxc://")) return parseMxc(url) ? url : null;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return null;
    const match = MEDIA_DOWNLOAD_RE.exec(parsed.pathname);
    if (!match) return null;
    let serverName: string;
    let mediaId: string;
    try {
        serverName = decodeURIComponent(match[1]);
        mediaId = decodeURIComponent(match[2]);
    } catch {
        return null;
    }
    const mxc = `mxc://${serverName}/${mediaId}`;
    return parseMxc(mxc) ? mxc : null;
}

/** Our homeserver's download URL for the media `url` names, on whatever
 *  homeserver that URL happens to sit. Null when `url` is not Matrix media, so
 *  the caller leaves it alone. */
function homeserverMediaUrl(url: string): string | null {
    const mxc = matrixMediaMxc(url);
    return mxc ? mxcToHttp(mxc) : null;
}

/** Whether `url` names Matrix media the picker can fetch through this
 *  session's homeserver. */
export function isMatrixMediaUrl(url: string): boolean {
    return !!homeserverMediaUrl(url);
}

/** The file at a Matrix media URL, ready to attach to the composer. Used for
 *  a GIF starred from an unencrypted room: sending its URL only produced a
 *  dead link, so the picker attaches the bytes instead. A URL from another
 *  homeserver is rewritten to ours, which fetches the media over federation.
 *
 *  The file carries the media's mxc for reuse when its bytes are an image, so
 *  sending it re-points at the media rather than uploading the bytes again.
 *  `width`/`height` are the favourite's stored size, used only if usable. */
export async function mediaUrlFavouriteFile(
    url: string,
    width?: unknown,
    height?: unknown,
): Promise<File | null> {
    const httpUrl = homeserverMediaUrl(url);
    if (!httpUrl) return null;
    const mxc = matrixMediaMxc(url);
    const objectUrl = await fetchAttachmentBlob(httpUrl);
    try {
        const blob = await (await fetch(objectUrl)).blob();
        const file = favouriteAsFile(blob);
        // Judged on the bytes' own type: favouriteAsFile labels an untyped blob
        // as a GIF, which is not something the server vouches for.
        if (mxc && blob.type.startsWith("image/")) {
            const w = safeDimension(width);
            const h = safeDimension(height);
            reusableMedia.set(file, {
                url: mxc,
                info: {
                    mimetype: blob.type,
                    size: blob.size,
                    ...(w !== null && h !== null ? { w, h } : {}),
                },
            });
        }
        return file;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
