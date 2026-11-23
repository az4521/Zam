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

export const DEFAULT_DISCORD_REFRESH_URL =
    "https://zam.crafty.moe/discord-refresh";

type EnvLike = Record<string, string | undefined>;

/**
 * The built-in refresh service, from VITE_DISCORD_REFRESH_URL at build time.
 * Unset or empty uses the default (CI expands a missing secret to "", which
 * must not turn it off); "off" means no built-in service.
 */
export function builtInRefreshServiceUrl(
    env: EnvLike = import.meta.env as EnvLike,
): string | null {
    const raw = (env.VITE_DISCORD_REFRESH_URL ?? "").trim();
    if (raw.toLowerCase() === "off") return null;
    return normaliseRefreshServiceUrl(raw || DEFAULT_DISCORD_REFRESH_URL);
}

/**
 * The service the import uses: the user's own address when they entered one,
 * otherwise the built-in one. Null when neither is usable.
 */
export function effectiveRefreshServiceUrl(
    userValue: string,
    builtIn: string | null = builtInRefreshServiceUrl(),
): string | null {
    if (userValue.trim()) return normaliseRefreshServiceUrl(userValue);
    return builtIn;
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
    discordUrl: string;
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
        discordUrl: opts.discordUrl,
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

/** An existing favourite's media, for re-using it instead of uploading. */
export interface ExistingCopy {
    mxc: string;
    video: boolean;
}

function copyOf(g: FavouriteGif): ExistingCopy | null {
    if (typeof g.mxc !== "string" || !g.mxc.startsWith("mxc://")) return null;
    return { mxc: g.mxc, video: !!g.video };
}

/** Favourites that already hold a Discord upload, by its canonical link. */
export function copiesByDiscordUrl(
    gifs: readonly FavouriteGif[],
): Map<string, ExistingCopy> {
    const out = new Map<string, ExistingCopy>();
    for (const g of gifs) {
        if (typeof g.discordUrl !== "string" || !g.discordUrl) continue;
        const copy = copyOf(g);
        if (copy && !out.has(g.discordUrl)) out.set(g.discordUrl, copy);
    }
    return out;
}

/**
 * Favourites that may be an earlier import of a Discord upload but carry no
 * Discord link (imported before it was saved): plain homeserver media, not
 * encrypted (`source`), no Discord link yet. Matched by file hash.
 */
export function hashCandidates(gifs: readonly FavouriteGif[]): ExistingCopy[] {
    const seen = new Set<string>();
    const out: ExistingCopy[] = [];
    for (const g of gifs) {
        if (g.source || g.discordUrl) continue;
        const copy = copyOf(g);
        if (!copy || seen.has(copy.mxc)) continue;
        seen.add(copy.mxc);
        out.push(copy);
    }
    return out;
}

/** SHA-256 of `data` as lowercase hex. */
export async function sha256Hex(data: BufferSource): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    let hex = "";
    for (const b of digest) hex += b.toString(16).padStart(2, "0");
    return hex;
}

/** mxc -> SHA-256 of its bytes. Media behind an mxc never changes, so a hash
 *  once taken stays right. */
const HASHES_KEY = "zam_favourite_mxc_sha256";
const MAX_HASHES = 5000;

export function parseMediaHashes(raw: string | null): Map<string, string> {
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
        if (
            k.startsWith("mxc://") &&
            typeof v === "string" &&
            /^[0-9a-f]{64}$/.test(v)
        )
            out.set(k, v);
    }
    return out;
}

export function serialiseMediaHashes(map: Map<string, string>): string {
    return JSON.stringify(Object.fromEntries([...map].slice(-MAX_HASHES)));
}

export function readMediaHashes(userId: string | null): Map<string, string> {
    return parseMediaHashes(readScoped(HASHES_KEY, userId));
}

export function writeMediaHashes(
    userId: string | null,
    map: Map<string, string>,
): void {
    writeScoped(HASHES_KEY, userId, serialiseMediaHashes(map));
}

/**
 * Lazily hashes the candidates (each fetched once, `limit` at a time, hashes
 * cached in `known`) and answers which one holds the given bytes. A candidate
 * that fails to fetch is left out. The index is built on the first lookup
 * only, so an import that never needs it fetches nothing.
 */
export function createHashMatcher(opts: {
    candidates: readonly ExistingCopy[];
    known: Map<string, string>;
    fetchHash: (mxc: string) => Promise<string>;
    limit?: number;
    onHashed?: () => void;
}): (hash: string) => Promise<ExistingCopy | null> {
    let index: Promise<Map<string, ExistingCopy>> | null = null;
    const build = async () => {
        const byHash = new Map<string, ExistingCopy>();
        const todo: ExistingCopy[] = [];
        for (const c of opts.candidates) {
            const h = opts.known.get(c.mxc);
            if (h) {
                if (!byHash.has(h)) byHash.set(h, c);
            } else todo.push(c);
        }
        let next = 0;
        const worker = async () => {
            while (next < todo.length) {
                const c = todo[next++];
                try {
                    const h = await opts.fetchHash(c.mxc);
                    opts.known.set(c.mxc, h);
                    if (!byHash.has(h)) byHash.set(h, c);
                } catch {
                    // Unreachable media cannot be matched; upload instead.
                }
            }
        };
        await Promise.all(
            Array.from(
                { length: Math.min(opts.limit ?? 4, todo.length) },
                worker,
            ),
        );
        if (todo.length > 0) opts.onHashed?.();
        return byHash;
    };
    return async (hash) => {
        index ??= build();
        return (await index).get(hash) ?? null;
    };
}
