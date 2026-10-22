// KLIPY GIF/Meme discovery — pure URL builders + response normalizer.
// The picker rides the app's existing URL-as-text rail (see LinkPreview.svelte),
// so this module produces plain media URLs and never touches matrix-js-sdk.
//
// CONFIRMED against the live KLIPY API:
//   - search query param name (`q`)
//   - paging params (`page`, `per_page`)
//   - the item.file.<size>.<format>.url rendition shape (field is `file`, singular)
//
// The app key defaults to KLIPY's public `web` key, so GIF search works with
// zero config; override it with VITE_KLIPY_API_KEY to use your own registered
// key (needed for memes/clips, which the public `web` key returns empty).

export type GifKind = "gifs" | "memes";
export type GifTab = "gifs" | "favourites";

export interface GifResult {
    id: string;
    url: string; // full-size media rendition (fallback when there is no slug)
    /** klipy.com page for the item: what gets sent, so the message carries a
     *  readable link (klipy.com/gifs/<slug>) instead of a static CDN path. */
    pageUrl?: string;
    previewUrl: string; // small still-or-animated image for favourites / fallback tile
    /** Small mp4 for the picker grid. Animated webp only starts playing once
     *  fully downloaded; video streams, so tiles animate almost immediately. */
    previewVideoUrl?: string;
    width: number;
    height: number;
}

export interface GifPage {
    items: GifResult[];
    hasNext: boolean;
}

const KLIPY_BASE = "https://api.klipy.com/api/v1";
const PER_PAGE = 24;

/** Build-time key; defaults to KLIPY's public `web` key when unset. */
export const KLIPY_API_KEY: string =
    import.meta.env.VITE_KLIPY_API_KEY || "web";

export function trendingUrl(kind: GifKind, page: number): string {
    return `${KLIPY_BASE}/${KLIPY_API_KEY}/${kind}/trending?page=${page}&per_page=${PER_PAGE}`;
}

export function searchUrl(kind: GifKind, query: string, page: number): string {
    const q = encodeURIComponent(query);
    return `${KLIPY_BASE}/${KLIPY_API_KEY}/${kind}/search?q=${q}&page=${page}&per_page=${PER_PAGE}`;
}

type Rendition = { url?: string; width?: number; height?: number };
type Fmt = {
    gif?: Rendition;
    webp?: Rendition;
    mp4?: Rendition;
    webm?: Rendition;
};
interface KlipyItem {
    id?: string | number;
    slug?: string;
    file?: Record<string, Fmt | undefined>;
}

// Inserted URL: full-size, gif-first — broadest compatibility on the
// URL-as-text rail and in other Matrix clients.
const FULL_SIZES = ["hd", "md", "sm", "xs"];
const FULL_FORMATS: (keyof Fmt)[] = ["gif", "webp", "mp4"];
// Grid thumbnail: a mid rendition, webp-first — crisp at tile size yet far
// lighter than the gif (KLIPY webp is ~1/7th the bytes) and still animated.
// Avoids the blurry upscaled `xs` thumbnails.
const PREVIEW_SIZES = ["md", "sm", "hd", "xs"];
const PREVIEW_FORMATS: (keyof Fmt)[] = ["webp", "gif", "mp4"];
// Grid video tile: mp4 is consistently the lightest rendition and, unlike
// animated webp, plays while it is still downloading.
const PREVIEW_VIDEO_SIZES = ["sm", "md", "xs", "hd"];
const PREVIEW_VIDEO_FORMATS: (keyof Fmt)[] = ["mp4"];

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

/** The klipy.com page for an item, e.g. https://klipy.com/gifs/nukes-true. */
export function klipyPageUrl(kind: GifKind, slug: string): string | undefined {
    return SLUG_RE.test(slug) ? `https://klipy.com/${kind}/${slug}` : undefined;
}

/** What the picker sends (and favourites by): the page link when known. */
export function gifSendUrl(r: Pick<GifResult, "url" | "pageUrl">): string {
    return r.pageUrl ?? r.url;
}

function pickRendition(
    file: Record<string, Fmt | undefined> | undefined,
    sizes: string[],
    formats: (keyof Fmt)[],
): Rendition | null {
    if (!file) return null;
    for (const size of sizes) {
        const fmt = file[size];
        if (!fmt) continue;
        for (const f of formats) {
            const r = fmt[f];
            if (r?.url) return r;
        }
    }
    return null;
}

export function normalizeKlipyItems(
    json: unknown,
    kind: GifKind = "gifs",
): GifPage {
    const data = (json as { data?: { data?: unknown; has_next?: unknown } })
        ?.data;
    const rawItems: KlipyItem[] = Array.isArray(data?.data)
        ? (data?.data as KlipyItem[])
        : [];
    const items: GifResult[] = [];
    for (const it of rawItems) {
        const full = pickRendition(it.file, FULL_SIZES, FULL_FORMATS);
        const small =
            pickRendition(it.file, PREVIEW_SIZES, PREVIEW_FORMATS) ?? full;
        if (!full?.url || !small?.url) continue;
        const video = pickRendition(
            it.file,
            PREVIEW_VIDEO_SIZES,
            PREVIEW_VIDEO_FORMATS,
        );
        const pageUrl =
            typeof it.slug === "string"
                ? klipyPageUrl(kind, it.slug)
                : undefined;
        items.push({
            id: String(it.id ?? it.slug ?? full.url),
            url: full.url,
            ...(pageUrl ? { pageUrl } : {}),
            previewUrl: small.url,
            ...(video?.url ? { previewVideoUrl: video.url } : {}),
            width: full.width ?? 0,
            height: full.height ?? 0,
        });
    }
    return { items, hasNext: Boolean(data?.has_next) };
}

export async function fetchKlipy(
    url: string,
    kind: GifKind = "gifs",
): Promise<GifPage> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`KLIPY ${res.status}`);
    return normalizeKlipyItems(await res.json(), kind);
}

export function normalizeGifTab(v: string | null): GifTab {
    return v === "favourites" ? "favourites" : "gifs";
}
