/**
 * Pure helpers for the room media browser: deciding what counts as a piece of
 * media, what to ask the server for, and how to page through the results.
 *
 * Kept free of any matrix-js-sdk import so it stays unit-testable; events are
 * handed in as the plain shape `/messages` returns (see MediaSourceEvent).
 */

import { formatCallDuration } from "./callDuration";

export type MediaKind = "image" | "video" | "file" | "audio";

/** The kinds the lightbox can actually display. */
export type MediaViewerKind = "image" | "video";

/** One row/tile in the media browser. `url` is still an mxc: URI — the caller
 *  converts it with `mxcToHttp` at render time. */
export interface RoomMediaItem {
    eventId: string;
    sender: string;
    ts: number;
    kind: MediaKind;
    /** Display name: MSC2530 filename, else body, else a generic kind label. */
    name: string;
    /** mxc: URI of the full-resolution media (or ciphertext URL for encrypted). */
    url: string;
    /** mxc: URI of a server-supplied thumbnail (videos usually have one). */
    thumbnailUrl: string | null;
    mimetype: string | null;
    size: number | null;
    /** `info.duration` in milliseconds — video/audio only, and optional, so it
     *  is null far more often than not. */
    durationMs: number | null;
    /** True when this attachment is encrypted (content.file instead of content.url). */
    encrypted?: boolean;
    /** The EncryptedFile metadata when encrypted is true. */
    encryptedFile?: {
        url: string;
        key: {
            k: string;
            alg?: string;
            kty?: string;
            ext?: boolean;
            key_ops?: string[];
        };
        iv: string;
        hashes: { sha256: string };
        v?: string;
    };
}

/** The minimum an event has to expose to be considered. Deliberately loose so
 *  both raw `/messages` JSON and an unwrapped MatrixEvent can be passed. */
export interface MediaSourceEvent {
    eventId: string | null | undefined;
    sender: string | null | undefined;
    ts: number | null | undefined;
    type: string | null | undefined;
    content: Record<string, unknown> | null | undefined;
}

const KIND_BY_MSGTYPE: Record<string, MediaKind> = {
    "m.image": "image",
    "m.video": "video",
    "m.file": "file",
    "m.audio": "audio",
};

const FALLBACK_NAME: Record<MediaKind, string> = {
    image: "Image",
    video: "Video",
    file: "File",
    audio: "Audio",
};

function str(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function mxc(value: unknown): string | null {
    const s = str(value);
    return s !== null && s.startsWith("mxc://") ? s : null;
}

/**
 * Map one timeline event to a media item, or null when it is not renderable
 * media. Encrypted attachments (`content.file`) are now enumerated and the
 * caller is expected to decrypt them.
 *
 * Pass the POST-DECRYPTION type and content: this hard-rejects anything whose
 * type is not `m.room.message`, so in an encrypted room the caller must have
 * already unwrapped the `m.room.encrypted` envelope before calling here.
 */
export function mediaItemFromEvent(ev: MediaSourceEvent): RoomMediaItem | null {
    if (ev.type !== "m.room.message") return null;
    const eventId = str(ev.eventId);
    if (eventId === null) return null;
    const content = ev.content;
    if (!content) return null;

    // Own-property check only: `msgtype` is remote-controlled, and a plain
    // object literal would happily resolve "toString"/"constructor" off
    // Object.prototype and hand back a truthy non-MediaKind.
    const msgtype = str(content.msgtype) ?? "";
    const kind: MediaKind | undefined = Object.prototype.hasOwnProperty.call(
        KIND_BY_MSGTYPE,
        msgtype,
    )
        ? KIND_BY_MSGTYPE[msgtype]
        : undefined;
    if (!kind) return null;

    // Check for encrypted file first (content.file), then unencrypted (content.url)
    const file =
        typeof content.file === "object" && content.file !== null
            ? (content.file as Record<string, unknown>)
            : null;
    const url = file ? mxc(file.url) : mxc(content.url);
    if (url === null) return null;

    const info: Record<string, unknown> =
        typeof content.info === "object" && content.info !== null
            ? (content.info as Record<string, unknown>)
            : {};
    const size = typeof info.size === "number" ? info.size : null;

    return {
        eventId,
        sender: str(ev.sender) ?? "",
        ts: typeof ev.ts === "number" ? ev.ts : 0,
        kind,
        name: str(content.filename) ?? str(content.body) ?? FALLBACK_NAME[kind],
        url,
        thumbnailUrl: mxc(info.thumbnail_url),
        mimetype: str(info.mimetype),
        size,
        durationMs: typeof info.duration === "number" ? info.duration : null,
        encrypted: file !== null,
        encryptedFile: file
            ? ({
                  url: url,
                  key: file.key as any,
                  iv: str(file.iv) ?? "",
                  hashes: (file.hashes as any) ?? { sha256: "" },
                  v: str(file.v),
              } as any)
            : undefined,
    };
}

/**
 * Which mxc to hand the server's thumbnail endpoint for this item's tile, or
 * null when there is nothing to ask for and the caller must draw a placeholder.
 *
 * An image is thumbnailed from itself. A video is ONLY ever thumbnailed from a
 * sender-uploaded `info.thumbnail_url` — never from its own mxc. Servers do not
 * thumbnail video, and they do not all fail politely: continuwuity answers
 * `/media/thumbnail` for a video with the ORIGINAL file (200 video/mp4), so
 * pointing an <img> at it downloads the entire video before the decode fails.
 * Most senders omit thumbnail_url, which makes that the common path, not an
 * edge case.
 */
export function mediaThumbnailMxc(item: RoomMediaItem): string | null {
    if (item.kind === "image") return item.url;
    if (item.kind === "video") return item.thumbnailUrl;
    return null;
}

/**
 * The same rule as `mediaThumbnailMxc`'s video branch, expressed over the raw
 * `m.video` content the timeline has to hand rather than a gallery item: the
 * mxc to use as a poster, or null when there is nothing safe to request and the
 * caller must render a placeholder WITHOUT issuing any request at all.
 *
 * Only ever a sender-uploaded `info.thumbnail_url`, never `content.url`. Asking
 * the thumbnail endpoint for a video is not a harmless miss: continuwuity
 * answers it with the original file (200 video/mp4), so an <img> pointed there
 * downloads the whole video before the decode fails — `onerror` fires far too
 * late to save the bandwidth.
 */
export function videoPosterMxc(
    content: Record<string, unknown> | null | undefined,
): string | null {
    if (!content) return null;
    const info =
        typeof content.info === "object" && content.info !== null
            ? (content.info as Record<string, unknown>)
            : {};
    return mxc(info.thumbnail_url);
}

/**
 * The mxc a `<video>` should be pointed at for this `m.video` content, or null
 * when the event carries nothing this client can play.
 *
 * Null covers the encrypted case (`content.file`, no `content.url`) — there is
 * no attachment-decryption path here — and any malformed url. The caller MUST
 * render a NON-interactive "unavailable" state for null instead of the play
 * card: an affordance that can never resolve a source is indistinguishable from
 * a dead click, which is precisely how a missing source gets reported as
 * "videos cannot be played at all".
 *
 * Note what this deliberately does NOT require: a thumbnail, a duration, or any
 * `info` at all. Bridged video (OOYE/Discord) arrives as `{w, h, mimetype,
 * size}` and nothing else, and is perfectly playable.
 */
export function videoSourceMxc(
    content: Record<string, unknown> | null | undefined,
): string | null {
    if (!content) return null;
    return mxc(content.url);
}

/** What the lightbox should render this as, or null when it cannot show it. */
export function mediaViewerKind(item: RoomMediaItem): MediaViewerKind | null {
    return item.kind === "image" || item.kind === "video" ? item.kind : null;
}

/** Everything the lightbox needs, with the mxc URIs already resolved. */
export interface MediaViewerItem {
    kind: MediaViewerKind;
    /** http URL of the full-resolution media. */
    src: string;
    /** http URL of a still to show behind the video before it starts; null for
     *  images (which are their own poster) and when nothing resolved. */
    poster: string | null;
    filename: string;
}

/**
 * Map a grid entry to the viewer's props. The mxc→http conversion is injected
 * so this stays free of the SDK boundary: `full` resolves the download URL,
 * `poster` a scaled thumbnail. Null when the item is not viewable at all, or
 * when its full URL cannot be resolved (no client yet / malformed mxc) — in
 * both cases the caller must not mount a viewer.
 */
export function mediaViewerItem(
    item: RoomMediaItem,
    resolve: {
        full: (mxc: string) => string | null;
        poster: (mxc: string) => string | null;
    },
): MediaViewerItem | null {
    const kind = mediaViewerKind(item);
    if (kind === null) return null;
    const src = resolve.full(item.url);
    if (src === null) return null;
    const posterMxc = kind === "video" ? mediaThumbnailMxc(item) : null;
    return {
        kind,
        src,
        poster: posterMxc === null ? null : resolve.poster(posterMxc),
        filename: item.name,
    };
}

/**
 * The `room.timeline` filter to send with `/messages`.
 *
 * In an encrypted room every message arrives as `m.room.encrypted` with an
 * opaque body, so `contains_url` would match nothing — ask for both event
 * types instead and filter after decryption. In a clear room `contains_url`
 * lets the server do the work and keeps the page small.
 */
export function mediaFilterDefinition(
    isEncrypted: boolean,
    limit: number,
): { room: { timeline: Record<string, unknown> } } {
    return isEncrypted
        ? {
              room: {
                  timeline: {
                      types: ["m.room.message", "m.room.encrypted"],
                      limit,
                  },
              },
          }
        : {
              room: {
                  timeline: {
                      types: ["m.room.message"],
                      contains_url: true,
                      limit,
                  },
              },
          };
}

/** Append a newly fetched page, dropping any event id already held. Pages come
 *  back newest-first from backward pagination, so appending keeps that order. */
export function mergeMediaPages(
    existing: RoomMediaItem[],
    incoming: RoomMediaItem[],
): RoomMediaItem[] {
    const seen = new Set(existing.map((i) => i.eventId));
    const out = [...existing];
    for (const candidate of incoming) {
        if (seen.has(candidate.eventId)) continue;
        seen.add(candidate.eventId);
        out.push(candidate);
    }
    return out;
}

/** Split into the two tabs: a thumbnail grid and a file list. */
export function splitMediaItems(items: RoomMediaItem[]): {
    visual: RoomMediaItem[];
    files: RoomMediaItem[];
} {
    const visual: RoomMediaItem[] = [];
    const files: RoomMediaItem[] = [];
    for (const i of items) {
        if (i.kind === "image" || i.kind === "video") visual.push(i);
        else files.push(i);
    }
    return { visual, files };
}

/** Human size, matching the message renderer's KB/MB rounding. Empty when the
 *  server did not tell us (`info.size` is optional). */
export function formatMediaSize(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return "";
    return bytes / 1024 < 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Duration badge for a video tile, sharing the call timer's mm:ss / h:mm:ss
 *  shape. Empty when `info.duration` was absent or nonsense, so the caller can
 *  simply fall back to a "Video" label. */
export function formatMediaDuration(ms: number | null | undefined): string {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
    return formatCallDuration(ms);
}
