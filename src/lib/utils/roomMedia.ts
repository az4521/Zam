/**
 * Pure helpers for the room media browser: deciding what counts as a piece of
 * media, what to ask the server for, and how to page through the results.
 *
 * Kept free of any matrix-js-sdk import so it stays unit-testable; events are
 * handed in as the plain shape `/messages` returns (see MediaSourceEvent).
 */

export type MediaKind = "image" | "video" | "file" | "audio";

/** One row/tile in the media browser. `url` is still an mxc: URI — the caller
 *  converts it with `mxcToHttp` at render time. */
export interface RoomMediaItem {
    eventId: string;
    sender: string;
    ts: number;
    kind: MediaKind;
    /** Display name: MSC2530 filename, else body, else a generic kind label. */
    name: string;
    /** mxc: URI of the full-resolution media. */
    url: string;
    /** mxc: URI of a server-supplied thumbnail (videos usually have one). */
    thumbnailUrl: string | null;
    mimetype: string | null;
    size: number | null;
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
 * media. Encrypted attachments (`content.file`, no `content.url`) return null
 * on purpose: this client has no attachment-decryption path, so showing them
 * would only produce broken tiles.
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

    const url = mxc(content.url);
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
