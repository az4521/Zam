import type { FavouriteGif } from "$lib/matrix/client";
import { safeDimension } from "$lib/utils/mediaDimensions";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";

/**
 * Discord favourites that were uploaded to Discord itself. Their links expire,
 * so the import refreshes them through the user's own refresh service
 * (services/discord-refresh-proxy), downloads the file in the desktop app's
 * main process and uploads it to the homeserver. Everything here is pure; the
 * settings row drives it.
 */

/** Same rule as electron/discordAttachments.cjs normaliseProxyBase: https, or
 *  http on this machine only, and no credentials. Null when unusable. */
export function normaliseRefreshServiceUrl(raw: string): string | null {
    const s = raw.trim();
    if (!s) return null;
    let u: URL;
    try {
        u = new URL(s);
    } catch {
        return null;
    }
    if (u.username || u.password) return null;
    const local =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "[::1]";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local))
        return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

const EXT_TYPES: Record<string, string> = {
    gif: "image/gif",
    webp: "image/webp",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    avif: "image/avif",
    apng: "image/apng",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
};

/**
 * The media type to upload a downloaded attachment as: the server's type when
 * it is an image or video, else one from the file extension. Null when the
 * file is neither (an HTML error page, say), so it is not uploaded.
 */
export function attachmentMediaType(
    name: string,
    contentType: string,
): string | null {
    const ct = contentType.split(";")[0].trim().toLowerCase();
    if (/^(image|video)\/[a-z0-9.+-]+$/.test(ct)) return ct;
    if (ct && ct !== "application/octet-stream" && ct !== "binary/octet-stream")
        return null;
    const ext = name.toLowerCase().split(".").pop() ?? "";
    return EXT_TYPES[ext] ?? null;
}

/** The favourite for an attachment uploaded to the homeserver. Same shape as
 *  starring an unencrypted GIF in the chat: `url` is the media download URL. */
export function attachmentFavourite(opts: {
    mxc: string;
    httpUrl: string;
    video: boolean;
    name?: string;
    width?: number;
    height?: number;
}): Omit<FavouriteGif, "addedAt"> {
    const w = safeDimension(opts.width);
    const h = safeDimension(opts.height);
    return {
        url: opts.httpUrl,
        previewUrl: opts.video ? "" : opts.httpUrl,
        mxc: opts.mxc,
        ...(opts.video ? { video: true } : {}),
        ...(opts.name ? { name: opts.name } : {}),
        ...(w !== null && h !== null ? { width: w, height: h } : {}),
    };
}

/** Discord attachment links (canonical, no query) already uploaded by an
 *  earlier import, mapped to their mxc, so a second import re-uses them. */
const UPLOADED_KEY = "zam_discord_attachment_mxc";
const MAX_UPLOADED = 5000;

export function parseUploadedAttachments(
    raw: string | null,
): Map<string, string> {
    const out = new Map<string, string>();
    if (!raw) return out;
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return out;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return out;
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v === "string" && v.startsWith("mxc://")) out.set(k, v);
    }
    return out;
}

/** Newest entries win when the record is over its cap. */
export function serialiseUploadedAttachments(map: Map<string, string>): string {
    const entries = [...map.entries()].slice(-MAX_UPLOADED);
    return JSON.stringify(Object.fromEntries(entries));
}

export function readUploadedAttachments(
    userId: string | null,
): Map<string, string> {
    return parseUploadedAttachments(readScoped(UPLOADED_KEY, userId));
}

export function writeUploadedAttachments(
    userId: string | null,
    map: Map<string, string>,
): void {
    writeScoped(UPLOADED_KEY, userId, serialiseUploadedAttachments(map));
}
