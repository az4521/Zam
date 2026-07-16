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
    url: string; // full-size rendition: inserted into the message + rendered inline
    previewUrl: string; // small rendition for the picker grid thumbnail
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
type Fmt = { gif?: Rendition; webp?: Rendition; mp4?: Rendition };
interface KlipyItem {
    id?: string | number;
    slug?: string;
    file?: Record<string, Fmt | undefined>;
}

// Largest-first for the inserted url; smallest-first for the grid thumbnail.
const SIZES_LARGE = ["hd", "md", "sm", "xs"];
const SIZES_SMALL = ["xs", "sm", "md", "hd"];

function pickRendition(
    files: Record<string, Fmt | undefined> | undefined,
    order: string[],
): Rendition | null {
    if (!files) return null;
    for (const size of order) {
        const fmt = files[size];
        const r = fmt?.gif ?? fmt?.webp ?? fmt?.mp4;
        if (r?.url) return r;
    }
    return null;
}

export function normalizeKlipyItems(json: unknown): GifPage {
    const data = (json as { data?: { data?: unknown; has_next?: unknown } })
        ?.data;
    const rawItems: KlipyItem[] = Array.isArray(data?.data)
        ? (data?.data as KlipyItem[])
        : [];
    const items: GifResult[] = [];
    for (const it of rawItems) {
        const full = pickRendition(it.file, SIZES_LARGE);
        const small = pickRendition(it.file, SIZES_SMALL) ?? full;
        if (!full?.url || !small?.url) continue;
        items.push({
            id: String(it.id ?? it.slug ?? full.url),
            url: full.url,
            previewUrl: small.url,
            width: full.width ?? 0,
            height: full.height ?? 0,
        });
    }
    return { items, hasNext: Boolean(data?.has_next) };
}

export async function fetchKlipy(url: string): Promise<GifPage> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`KLIPY ${res.status}`);
    return normalizeKlipyItems(await res.json());
}

export function normalizeGifTab(v: string | null): GifTab {
    return v === "favourites" ? "favourites" : "gifs";
}
