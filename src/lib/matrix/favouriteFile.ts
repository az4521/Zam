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
import { parseMxc } from "$lib/utils/mxcUri";

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

const blobUrls = new Map<string, Promise<string | null>>();

/** Object URL of the pointed-at GIF, or null when the event is gone or can't
 *  be decrypted. Shared across tiles; failures aren't cached. */
export function resolveEventFavouriteUrl(
    source: EventFavouriteSource,
): Promise<string | null> {
    const key = eventFavouriteKey(source);
    let p = blobUrls.get(key);
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
            return fetchDecryptedAttachmentBlob(
                content.file,
                content.info?.mimetype ?? "image/gif",
            );
        })().catch(() => {
            blobUrls.delete(key);
            return null;
        });
        blobUrls.set(key, p);
    }
    return p;
}

/** The pointed-at GIF as a File, ready to attach to the composer. */
export async function eventFavouriteFile(
    source: EventFavouriteSource,
): Promise<File | null> {
    const url = await resolveEventFavouriteUrl(source);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    return new File([blob], "favourite.gif", { type: "image/gif" });
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
 *  homeserver is rewritten to ours, which fetches the media over federation. */
export async function mediaUrlFavouriteFile(url: string): Promise<File | null> {
    const httpUrl = homeserverMediaUrl(url);
    if (!httpUrl) return null;
    const objectUrl = await fetchAttachmentBlob(httpUrl);
    try {
        const blob = await (await fetch(objectUrl)).blob();
        return new File([blob], "favourite.gif", {
            type: blob.type || "image/gif",
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
