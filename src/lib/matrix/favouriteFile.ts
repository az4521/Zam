// Favourites of uploaded GIFs. An encrypted upload has no plain URL, and its
// decryption key lives only in the message event, so the favourite stores a
// pointer to that event instead of the media. An unencrypted upload is keyed by
// an authenticated homeserver URL, which nothing can preview from the URL
// alone. The picker resolves either back to the bytes to show a tile and, when
// picked, to attach the GIF as a file.

import { fetchSingleEvent, getHomeserverBaseUrl } from "$lib/matrix/client";
import {
    fetchAttachmentBlob,
    fetchDecryptedAttachmentBlob,
} from "$lib/matrix/media";
import { isAuthorisedMediaTarget } from "$lib/utils/mediaAuthOrigin";

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

/** Whether `url` is a file on this session's own homeserver. Such a URL needs
 *  the access token to download, so neither a receiving client nor the
 *  homeserver's URL preview can fetch it from the URL alone. */
export function isHomeserverMediaUrl(url: string): boolean {
    const homeserver = getHomeserverBaseUrl();
    return !!homeserver && isAuthorisedMediaTarget(url, homeserver);
}

/** The file at a homeserver media URL, ready to attach to the composer. Used
 *  for a GIF starred from an unencrypted room: sending its URL only produced a
 *  dead link, so the picker attaches the bytes instead. */
export async function mediaUrlFavouriteFile(url: string): Promise<File | null> {
    if (!isHomeserverMediaUrl(url)) return null;
    const objectUrl = await fetchAttachmentBlob(url);
    try {
        const blob = await (await fetch(objectUrl)).blob();
        return new File([blob], "favourite.gif", {
            type: blob.type || "image/gif",
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
