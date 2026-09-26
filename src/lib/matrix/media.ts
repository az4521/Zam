import { Direction, Filter, MatrixEvent } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";
import { matrixClient, captureClient, ownedClientOrThrow } from "./runtime";
import type { ClientOwnership } from "$lib/utils/clientGeneration";
import { threadRelationParams } from "./client";
import { isRoomEncrypted, isRoomEncryptedForSend } from "$lib/matrix/crypto";
import { withThreadRelation } from "$lib/utils/threadContent";
import {
    decryptAttachment,
    type EncryptedFileInfo,
} from "$lib/utils/decryptAttachment";
import {
    encryptAttachment,
    shouldEncryptUpload,
    thumbnailFields,
    type UploadedAttachment,
} from "$lib/utils/encryptAttachment";
import { safeAttachmentMimeType } from "$lib/utils/attachmentMime";
import { exceedsUploadLimit, FileTooLargeError } from "$lib/utils/uploadLimits";
import { parseMxc, isSameOrigin } from "$lib/utils/mxcUri";
import {
    mediaItemFromEvent,
    mediaFilterDefinition,
    type RoomMediaItem,
} from "$lib/utils/roomMedia";

async function captureVideoThumbnail(file: File): Promise<{
    blob: Blob;
    w: number;
    h: number;
    thumbW: number;
    thumbH: number;
} | null> {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        video.onerror = () => {
            cleanup();
            resolve(null);
        };
        video.onloadedmetadata = () => {
            // Seek to 10% into the video (or 1s, whichever is smaller) to get past black frames
            video.currentTime = Math.min(1, video.duration * 0.1);
        };
        video.onseeked = () => {
            const w = video.videoWidth;
            const h = video.videoHeight;
            const MAX = 800;
            const scale = Math.min(1, MAX / Math.max(w, h));
            const thumbW = Math.round(w * scale);
            const thumbH = Math.round(h * scale);
            const canvas = document.createElement("canvas");
            canvas.width = thumbW;
            canvas.height = thumbH;
            canvas.getContext("2d")!.drawImage(video, 0, 0, thumbW, thumbH);
            canvas.toBlob(
                (blob) => {
                    cleanup();
                    if (blob) resolve({ blob, w, h, thumbW, thumbH });
                    else resolve(null);
                },
                "image/jpeg",
                0.85,
            );
        };
        video.src = objectUrl;
    });
}

export interface MediaCaption {
    /** Plain-text caption (becomes the event body, per MSC2530). */
    body: string;
    /** Optional HTML caption (org.matrix.custom.html formatted_body). */
    formattedBody?: string;
    mentions?: { user_ids?: string[]; room?: boolean };
}

// Cached `m.upload.size` from the server's media config, fetched once per
// session. `undefined` = not yet fetched; a stored promise dedupes concurrent
// callers; a null resolution means the server didn't advertise a limit (or the
// request failed) — in which case we skip the precheck rather than block uploads.
let mediaUploadSizePromise: Promise<number | null> | null = null;

export async function getMediaUploadSizeLimit(): Promise<number | null> {
    if (!matrixClient) return null;
    if (!mediaUploadSizePromise) {
        const client = matrixClient;
        mediaUploadSizePromise = (async () => {
            try {
                const config = await client.getMediaConfig(true);
                const size = config["m.upload.size"];
                return typeof size === "number" ? size : null;
            } catch {
                mediaUploadSizePromise = null; // allow a retry next upload
                return null;
            }
        })();
    }
    return mediaUploadSizePromise;
}

/**
 * Upload a blob to the media repo, encrypting it first if the room is encrypted.
 * Returns either `{ url }` (plaintext) or `{ file }` (encrypted) — never both.
 * The caller builds the event content from this plus mimetype/size/etc.
 */
export async function uploadAttachment(
    owner: ClientOwnership<MatrixClient>,
    roomId: string,
    blob: Blob,
    opts: { name: string; type?: string; msgtype: string },
): Promise<UploadedAttachment> {
    const encrypt = shouldEncryptUpload(await isRoomEncryptedForSend(roomId));
    ownedClientOrThrow(owner);

    if (encrypt) {
        // Encrypted path: encrypt the blob, upload as application/octet-stream
        // with no filename (filename must NOT leak to the media repo).
        const plainBytes = await blob.arrayBuffer();
        const { data, info } = await encryptAttachment(plainBytes);
        ownedClientOrThrow(owner);
        const encryptedBlob = new Blob([data], {
            type: "application/octet-stream",
        });
        const { content_uri } = await ownedClientOrThrow(owner).uploadContent(
            encryptedBlob,
            { type: "application/octet-stream", includeFilename: false },
        );
        return { file: { ...info, url: content_uri } };
    } else {
        // Plaintext path: upload as-is with the original name, byte-identical
        // to the pre-encryption code path for unencrypted rooms. `type` only
        // matters for a plugin Blob that carries none of its own.
        const { content_uri } = await ownedClientOrThrow(owner).uploadContent(
            blob,
            opts.type
                ? { name: opts.name, type: opts.type }
                : { name: opts.name },
        );
        return { url: content_uri };
    }
}

export async function sendFile(
    roomId: string,
    file: File,
    caption?: MediaCaption,
    thread?: { rootEventId: string },
): Promise<void> {
    const owner = captureClient();
    // Precheck the size against the server's advertised upload limit so an
    // over-limit file fails fast instead of a 413 mid-upload. This REJECTS
    // rather than resolving: resolving read to the composer as "sent" and made
    // the queued file disappear unsent (audit MEDIA-02). The caller owns the
    // toast — FileTooLargeError's message is already user-facing copy.
    const maxUploadSize = await getMediaUploadSizeLimit();
    // A successor account may own the slot now: its server's limit is not this
    // file's limit, and the rejection below would surface in its UI.
    ownedClientOrThrow(owner);
    if (exceedsUploadLimit(file.size, maxUploadSize)) {
        throw new FileTooLargeError(
            file.name,
            file.size,
            maxUploadSize as number,
        );
    }
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const msgtype = isImage
        ? "m.image"
        : isVideo
          ? "m.video"
          : isAudio
            ? "m.audio"
            : "m.file";

    // Upload the main file, encrypting it if the room is encrypted.
    const uploadResult = await uploadAttachment(owner, roomId, file, {
        name: file.name,
        msgtype,
    });

    const info: Record<string, unknown> = {
        mimetype: file.type,
        size: file.size,
    };

    if (isVideo) {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) {
            ownedClientOrThrow(owner);
            const thumbFile = new File([thumb.blob], "thumbnail.jpg", {
                type: "image/jpeg",
            });
            // The thumbnail follows the video's encryption decision, so in an
            // encrypted room it goes as `thumbnail_file`.
            const thumbUpload = await uploadAttachment(
                owner,
                roomId,
                thumbFile,
                { name: "thumbnail.jpg", msgtype },
            );
            info.w = thumb.w;
            info.h = thumb.h;
            Object.assign(info, thumbnailFields(thumbUpload));
            info.thumbnail_info = {
                mimetype: "image/jpeg",
                w: thumb.thumbW,
                h: thumb.thumbH,
                size: thumb.blob.size,
            };
        }
    }

    // MSC2530 media captions: when a caption is supplied, `filename` carries the
    // original file name and `body` (plus optional formatted_body) carries the
    // caption text — rendered as a message alongside the media. Without a
    // caption, `body` is just the file name and no `filename` is sent.
    const content: Record<string, unknown> = {
        msgtype,
        body: caption ? caption.body : file.name,
        ...uploadResult, // { url } or { file } — never both
        info,
        // Always present (spec recommendation): an m.mentions key — even empty —
        // disables the legacy body-scan push rules on the receiving server.
        "m.mentions": caption?.mentions ?? {},
    };
    if (caption) {
        content.filename = file.name;
        if (caption.formattedBody) {
            content.format = "org.matrix.custom.html";
            content.formatted_body = caption.formattedBody;
        }
    }

    const finalContent = thread
        ? withThreadRelation(
              content,
              threadRelationParams(roomId, thread.rootEventId),
          )
        : content;
    await ownedClientOrThrow(owner).sendMessage(roomId, finalContent as never);
}

/**
 * Send a recorded voice message as `m.audio` with the MSC3245 voice marker and
 * MSC1767 audio (duration + waveform) so Element renders it as a voice note.
 * Mirrors sendFile's upload-then-send shape, encrypting in encrypted rooms.
 */
export async function sendVoiceMessage(
    roomId: string,
    blob: Blob,
    durationMs: number,
    waveform: number[],
): Promise<void> {
    const owner = captureClient();
    const ext = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "mp4"
          : "webm";
    const fileName = `voice-message.${ext}`;
    const fileType = blob.type || "audio/webm";
    const file = new File([blob], fileName, { type: fileType });
    const uploadResult = await uploadAttachment(owner, roomId, file, {
        name: fileName,
        msgtype: "m.audio",
    });
    const duration = Math.round(durationMs);
    await ownedClientOrThrow(owner).sendMessage(roomId, {
        msgtype: "m.audio",
        body: "Voice message",
        ...uploadResult, // { url } or { file } — never both
        info: { mimetype: fileType, size: blob.size, duration },
        "org.matrix.msc3245.voice": {},
        "org.matrix.msc1767.audio": { duration, waveform },
        "org.matrix.msc1767.text": "Voice message",
    } as never);
}
export function mxcToHttp(
    mxcUrl: string | null | undefined,
    width = 0,
    height: number | undefined = undefined,
    method = "crop",
): string | null {
    if (!matrixClient) return null;
    // Validate against the spec grammar, then URL-encode each segment so a
    // crafted server/media id can't smuggle path traversal or a query/fragment
    // into the media URL. parseMxc rejects non-mxc input (returns null).
    const parsed = parseMxc(mxcUrl ?? "");
    if (!parsed) return null;
    const serverName = encodeURIComponent(parsed.serverName);
    const mediaId = encodeURIComponent(parsed.mediaId);
    const baseUrl = matrixClient.getHomeserverUrl();
    if (width > 0) {
        height = height ?? width;
        return `${baseUrl}/_matrix/client/v1/media/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=${method}`;
    }
    return `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`;
}

/** Fetch an attachment from the homeserver with auth and return an object URL for use in <video/audio src> and file downloads. */
export async function fetchAttachmentBlob(httpUrl: string): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const baseUrl = matrixClient.getHomeserverUrl();
    // The access token must NEVER leave the homeserver. Refuse to attach it (or
    // even fetch) any URL that isn't on our homeserver — mirrors getContentType's
    // guard. Compare parsed ORIGIN, not a string prefix: a prefix test would
    // pass `https://host@evil.com/…` (userinfo) or `https://host.evil.com/…`
    // (host-suffix) and leak the token to a foreign host. Callers that need
    // foreign media must fetch it themselves, unauthed.
    if (!isSameOrigin(httpUrl, baseUrl)) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch(httpUrl, { headers });
    if (!resp.ok) throw new Error(`Failed to fetch attachment: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}

/**
 * Fetch an ENCRYPTED attachment (`content.file`) from the homeserver with auth,
 * decrypt it (AES-CTR, integrity-checked in decryptAttachment) and return an
 * object URL. Mirrors fetchAttachmentBlob's same-origin token guard. The
 * plaintext mimetype comes from the event's `content.info.mimetype` — the
 * EncryptedFile itself carries none. The caller owns the object URL and must
 * revoke it. Throws (never returns a URL) if the integrity hash fails.
 */
export async function fetchDecryptedAttachmentBlob(
    file: EncryptedFileInfo & { url: string },
    mimetype?: string,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const httpUrl = mxcToHttp(file.url);
    if (!httpUrl) throw new Error("Encrypted attachment has an invalid URL");
    const baseUrl = matrixClient.getHomeserverUrl();
    if (!isSameOrigin(httpUrl, baseUrl)) {
        throw new Error("Refusing to fetch a non-homeserver URL with auth");
    }
    const token = matrixClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch(httpUrl, { headers });
    if (!resp.ok) {
        throw new Error(`Failed to fetch encrypted attachment: ${resp.status}`);
    }
    const ciphertext = await resp.arrayBuffer();
    const plaintext = await decryptAttachment(ciphertext, file);
    // The sender controls `mimetype`; pin it to an inert-media allowlist so a
    // future open-in-tab/iframe sink can't execute e.g. an image/svg+xml or
    // text/html blob in our origin (audit SEC-L9).
    const blob = new Blob([plaintext], {
        type: safeAttachmentMimeType(mimetype),
    });
    return URL.createObjectURL(blob);
}

/** HEAD-request a URL (with auth for homeserver URLs) and return its Content-Type. */
export async function getContentType(url: string): Promise<string | null> {
    if (!matrixClient) return null;
    const accessToken = matrixClient.getAccessToken();
    const baseUrl = matrixClient.getHomeserverUrl();
    const headers: Record<string, string> = {};
    // Attach auth only for same-ORIGIN homeserver URLs. A string prefix check
    // is bypassable (userinfo / host-suffix) and would leak the token; see
    // isSameOrigin. Foreign URLs are HEAD-requested without credentials.
    if (accessToken && isSameOrigin(url, baseUrl)) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    try {
        const res = await fetch(url, { method: "HEAD", headers });
        return res.ok ? res.headers.get("content-type") : null;
    } catch {
        return null;
    }
}
/** One page of a room's media, newest first. `nextToken` is null at the end. */
export interface RoomMediaPage {
    items: RoomMediaItem[];
    nextToken: string | null;
    /** Whether the source room is encrypted. Surfaced so the UI can say why a
     *  visibly media-full room lists nothing (E2EE attachments are
     *  `content.file`, which the mapper cannot turn into a listable item) and
     *  can stop paging instead of decrypting hundreds of events for nothing. */
    encrypted: boolean;
}

/**
 * Fetch one backwards page of a room's image/video/file/audio attachments.
 *
 * Paginated on purpose — a room's whole history is never loaded. In an
 * encrypted room the page arrives as m.room.encrypted and has to be decrypted
 * here before the pure mapper can see a msgtype, which is also why the server
 * filter differs (see mediaFilterDefinition).
 */
export async function fetchRoomMediaPage(
    roomId: string,
    fromToken: string | null,
    limit = 40,
): Promise<RoomMediaPage> {
    if (!matrixClient) throw new Error("Not logged in");
    const encrypted = isRoomEncrypted(matrixClient.getRoom(roomId));

    const filter = new Filter(matrixClient.getUserId());
    filter.setDefinition(mediaFilterDefinition(encrypted, limit));

    const res = await matrixClient.createMessagesRequest(
        roomId,
        fromToken,
        limit,
        Direction.Backward,
        filter,
    );

    const events = (res.chunk ?? []).map((raw) => new MatrixEvent(raw));

    // Decrypt the whole page at once rather than 40 serial awaits. A missing
    // key does NOT reject: the SDK's decryption loop swallows the error and
    // marks the event as a decryption failure, so it resolves and the event
    // surfaces as m.bad.encrypted, which the mapper rejects anyway. The catch
    // is belt-and-braces for an unexpected throw.
    await Promise.all(
        events
            .filter((e) => e.getType() === "m.room.encrypted")
            .map((e) => matrixClient!.decryptEventIfNeeded(e).catch(() => {})),
    );

    const items: RoomMediaItem[] = [];
    for (const event of events) {
        const item = mediaItemFromEvent({
            eventId: event.getId(),
            sender: event.getSender(),
            ts: event.getTs(),
            type: event.getType(),
            content: event.getContent() as Record<string, unknown>,
        });
        if (item) items.push(item);
    }

    // End of history is the token, not the chunk: conduit-derived servers
    // (continuwuity/tuwunel) filter a fixed PDU window after the fact, so an
    // empty chunk mid-history is normal. A token that does not advance means
    // the server has nothing further to give.
    const end = res.end ?? null;
    const nextToken = end !== null && end !== fromToken ? end : null;
    return { items, nextToken, encrypted };
}
export async function uploadContent(file: File): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const { content_uri } = await matrixClient.uploadContent(file, {
        name: file.name,
    });
    return content_uri;
}

/** Reset the cached media upload size limit (called on account switch). */
export function resetMediaUploadSizeLimit(): void {
    mediaUploadSizePromise = null;
}
