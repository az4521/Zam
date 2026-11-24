/**
 * MSC4095 bundled URL previews: reading the preview a sender attached to a
 * message, building one to attach, and the OpenGraph parse that feeds it when
 * this device fetched the page itself. See utils/urlPreviews.ts for which URLs
 * a message previews at all.
 *
 * Everything in a received entry is the sender's claim. Text is length-capped
 * and rendered as text; the only image accepted is an `mxc://` on the media
 * repo (plain or MSC4095-encrypted), never a third-party URL.
 *
 * Pure: no SDK, no DOM.
 */

import { URL_PREVIEWS_KEY, URL_PREVIEWS_UNSTABLE_KEY } from "./urlPreviews";

/** The EncryptedFile of an encrypted preview image (spec "EncryptedFile"). */
export interface BundledEncryptedFile {
    url: string;
    key: {
        kty: string;
        key_ops: string[];
        alg: string;
        k: string;
        ext: boolean;
    };
    iv: string;
    hashes: { sha256: string; [alg: string]: string };
    v: string;
}

export interface BundledPreview {
    title?: string;
    description?: string;
    siteName?: string;
    canonicalUrl?: string;
    /** Plain image on the media repo. */
    imageMxc?: string;
    /** Encrypted image on the media repo. */
    imageFile?: BundledEncryptedFile;
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageSize?: number;
}

const MAX_TITLE = 300;
const MAX_DESCRIPTION = 1000;
const MAX_SITE = 100;

function text(v: unknown, max: number): string | undefined {
    if (typeof v !== "string") return undefined;
    const s = v.replace(/\s+/g, " ").trim();
    if (!s) return undefined;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function dim(v: unknown): number | undefined {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100000
        ? n
        : undefined;
}

function webUrl(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:"
            ? u.toString()
            : undefined;
    } catch {
        return undefined;
    }
}

const MXC_RE = /^mxc:\/\/[A-Za-z0-9.:[\]-]+\/[A-Za-z0-9_-]+$/;

function encryptedFile(v: unknown): BundledEncryptedFile | undefined {
    if (!v || typeof v !== "object") return undefined;
    const f = v as Record<string, unknown>;
    const key = f.key as Record<string, unknown> | undefined;
    const hashes = f.hashes as Record<string, unknown> | undefined;
    if (
        typeof f.url !== "string" ||
        !MXC_RE.test(f.url) ||
        typeof f.iv !== "string" ||
        typeof f.v !== "string" ||
        !key ||
        typeof key !== "object" ||
        typeof key.k !== "string" ||
        typeof key.alg !== "string" ||
        typeof key.kty !== "string" ||
        !Array.isArray(key.key_ops) ||
        !hashes ||
        typeof hashes !== "object" ||
        typeof hashes.sha256 !== "string"
    )
        return undefined;
    return {
        url: f.url,
        key: {
            kty: key.kty,
            key_ops: key.key_ops.filter(
                (o): o is string => typeof o === "string",
            ),
            alg: key.alg,
            k: key.k,
            ext: key.ext !== false,
        },
        iv: f.iv,
        hashes: { sha256: hashes.sha256 },
        v: f.v,
    };
}

function entryUrl(e: Record<string, unknown>): string | undefined {
    const u = e["matrix:matched_url"] ?? e.matched_url;
    return typeof u === "string" ? u : undefined;
}

/**
 * The preview the sender bundled for `url`, or null when they bundled none
 * for it (no list, no entry, or an entry with only the matched URL, which
 * means "ask the homeserver"). An entry with neither a title, a description
 * nor an image is not worth showing and counts as none.
 */
export function readBundledPreview(
    content: Record<string, unknown> | null | undefined,
    url: string,
): BundledPreview | null {
    const list =
        content?.[URL_PREVIEWS_KEY] ?? content?.[URL_PREVIEWS_UNSTABLE_KEY];
    if (!Array.isArray(list)) return null;
    for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        if (entryUrl(e) !== url) continue;
        const ogImage = e["og:image"];
        const imageFile = encryptedFile(
            e["matrix:image:encrypted"] ?? e["beeper:image:encryption"],
        );
        const imageMxc =
            !imageFile && typeof ogImage === "string" && MXC_RE.test(ogImage)
                ? ogImage
                : undefined;
        const out: BundledPreview = {
            title: text(e["og:title"], MAX_TITLE),
            description: text(e["og:description"], MAX_DESCRIPTION),
            siteName: text(e["og:site_name"], MAX_SITE),
            canonicalUrl: webUrl(e["og:url"]),
            imageMxc,
            imageFile,
            imageType:
                typeof e["og:image:type"] === "string" &&
                /^image\/[a-z0-9.+-]+$/i.test(e["og:image:type"])
                    ? e["og:image:type"]
                    : undefined,
            imageWidth: dim(e["og:image:width"]),
            imageHeight: dim(e["og:image:height"]),
            imageSize: dim(e["matrix:image:size"]),
        };
        if (!out.title && !out.description && !out.imageMxc && !out.imageFile)
            return null;
        return out;
    }
    return null;
}

/** Page metadata, from OpenGraph tags or this device's parse of the page. */
export interface PageMeta {
    title?: string;
    description?: string;
    siteName?: string;
    url?: string;
    /** Absolute http(s) URL of the page's preview image. */
    image?: string;
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
}

/** The uploaded preview image, as the room needs it. */
export type UploadedPreviewImage =
    | { url: string; file?: undefined }
    | { file: BundledEncryptedFile; url?: undefined };

/**
 * An MSC4095 entry (unstable field names, the ones senders and receivers use
 * today) for `matchedUrl`.
 */
export function buildBundledEntry(
    matchedUrl: string,
    meta: PageMeta,
    image?: {
        uploaded: UploadedPreviewImage;
        size: number;
        type?: string;
        width?: number;
        height?: number;
    },
): Record<string, unknown> {
    const entry: Record<string, unknown> = { matched_url: matchedUrl };
    const title = text(meta.title, MAX_TITLE);
    const description = text(meta.description, MAX_DESCRIPTION);
    const siteName = text(meta.siteName, MAX_SITE);
    const canonical = webUrl(meta.url);
    if (title) entry["og:title"] = title;
    if (description) entry["og:description"] = description;
    if (siteName) entry["og:site_name"] = siteName;
    if (canonical) entry["og:url"] = canonical;
    if (image) {
        if (image.uploaded.file)
            entry["beeper:image:encryption"] = image.uploaded.file;
        else entry["og:image"] = image.uploaded.url;
        entry["matrix:image:size"] = image.size;
        if (image.type) entry["og:image:type"] = image.type;
        const w = dim(image.width);
        const h = dim(image.height);
        if (w && h) {
            entry["og:image:width"] = w;
            entry["og:image:height"] = h;
        }
    }
    return entry;
}

/** An entry is worth sending when it carries more than the matched URL. */
export function hasPreviewData(entry: Record<string, unknown>): boolean {
    return Object.keys(entry).some((k) => k !== "matched_url");
}

const ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
};

function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
        if (code[0] === "#") {
            const n =
                code[1] === "x" || code[1] === "X"
                    ? parseInt(code.slice(2), 16)
                    : parseInt(code.slice(1), 10);
            return Number.isFinite(n) && n > 0 && n <= 0x10ffff
                ? String.fromCodePoint(n)
                : m;
        }
        return ENTITIES[code.toLowerCase()] ?? m;
    });
}

function attr(tag: string, name: string): string | undefined {
    const m = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
        "i",
    ).exec(tag);
    const v = m ? (m[1] ?? m[2] ?? m[3]) : undefined;
    return v === undefined ? undefined : decodeEntities(v);
}

/**
 * Page metadata from a fetched HTML page: OpenGraph first, then Twitter card
 * tags, then <title> / meta description. Relative URLs resolve against
 * `pageUrl` (the page's final URL after redirects). Only the document head
 * is read.
 */
export function parseOpenGraph(html: string, pageUrl: string): PageMeta {
    const headEnd = html.search(/<\/head\s*>|<body[\s>]/i);
    const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200000);
    const props = new Map<string, string>();
    for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
        const tag = m[0];
        const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
        const value = attr(tag, "content");
        if (!key || value === undefined || props.has(key)) continue;
        props.set(key, value);
    }
    const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
    const resolve = (v: string | undefined): string | undefined => {
        if (!v) return undefined;
        try {
            return webUrl(new URL(v.trim(), pageUrl).toString());
        } catch {
            return undefined;
        }
    };
    const get = (...keys: string[]) =>
        keys.map((k) => props.get(k)).find((v) => v && v.trim());
    return {
        title: text(
            get("og:title", "twitter:title") ??
                (titleTag ? decodeEntities(titleTag) : undefined),
            MAX_TITLE,
        ),
        description: text(
            get("og:description", "twitter:description", "description"),
            MAX_DESCRIPTION,
        ),
        siteName: text(get("og:site_name"), MAX_SITE),
        url: resolve(get("og:url")) ?? webUrl(pageUrl),
        image: resolve(
            get(
                "og:image:secure_url",
                "og:image",
                "og:image:url",
                "twitter:image",
                "twitter:image:src",
            ),
        ),
        imageType: get("og:image:type"),
        imageWidth: dim(get("og:image:width")),
        imageHeight: dim(get("og:image:height")),
    };
}

/** Page metadata from a homeserver /preview_url response. Its og:image is
 *  already on the media repo, so it is kept as the mxc it is. */
export function metaFromHomeserver(
    data: Record<string, unknown> | null | undefined,
    url: string,
): { meta: PageMeta; imageMxc?: string; imageSize?: number } | null {
    if (!data || typeof data !== "object" || "error" in data) return null;
    const meta: PageMeta = {
        title: text(data["og:title"], MAX_TITLE),
        description: text(data["og:description"], MAX_DESCRIPTION),
        siteName: text(data["og:site_name"], MAX_SITE),
        url: webUrl(data["og:url"]) ?? url,
        imageType:
            typeof data["og:image:type"] === "string"
                ? data["og:image:type"]
                : undefined,
        imageWidth: dim(data["og:image:width"]),
        imageHeight: dim(data["og:image:height"]),
    };
    const ogImage = data["og:image"];
    const imageMxc =
        typeof ogImage === "string" && MXC_RE.test(ogImage)
            ? ogImage
            : undefined;
    if (!meta.title && !meta.description && !imageMxc) return null;
    return { meta, imageMxc, imageSize: dim(data["matrix:image:size"]) };
}
