// Favourites of encrypted GIFs. An encrypted upload has no plain URL, and its
// decryption key lives only in the message event, so the favourite stores a
// pointer to that event instead of the media. The picker resolves the pointer
// back to the decrypted bytes (browser-cached) to show a tile and, when picked,
// to attach the GIF as a file.

import { fetchSingleEvent } from "$lib/matrix/client";
import { fetchDecryptedAttachmentBlob } from "$lib/matrix/media";

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
