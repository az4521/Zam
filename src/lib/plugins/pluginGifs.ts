/**
 * GIF providers (zam.gifs.registerProvider). Pure: validates a registration
 * and turns a provider's untrusted results into what the picker renders, so
 * this module imports no SDK/DOM — it stays inside the plugin boundary.
 */
import type { GifProvider } from "./types";
import type { GifPage, GifResult } from "$lib/utils/klipy";

export function gifProviderProblem(p: GifProvider): string | null {
    if (!p || typeof p !== "object") return "a provider object is required";
    if (typeof p.id !== "string" || !p.id)
        return "id must be a non-empty string";
    if (typeof p.label !== "string" || !p.label.trim())
        return "label must be a non-empty string";
    if (typeof p.search !== "function") return "search must be a function";
    return null;
}

function httpUrl(v: unknown): string | null {
    if (typeof v !== "string") return null;
    try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:" ? v : null;
    } catch {
        return null;
    }
}

function dimension(v: unknown): number {
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Keep only well-formed items: the media URLs feed <img>/<video> and the
 *  send path, so anything but http(s) is dropped, as is a repeated id. */
export function normalizeProviderPage(raw: unknown): GifPage {
    const r = (raw ?? {}) as { items?: unknown; hasNext?: unknown };
    const items: GifResult[] = [];
    const seen = new Set<string>();
    for (const it of Array.isArray(r.items) ? r.items : []) {
        const url = httpUrl(it?.url);
        const previewUrl = httpUrl(it?.previewUrl) ?? url;
        if (!url || !previewUrl) continue;
        const id = String(it.id ?? url);
        if (seen.has(id)) continue;
        seen.add(id);
        const pageUrl = httpUrl(it.pageUrl);
        const previewVideoUrl = httpUrl(it.previewVideoUrl);
        items.push({
            id,
            url,
            ...(pageUrl ? { pageUrl } : {}),
            previewUrl,
            ...(previewVideoUrl ? { previewVideoUrl } : {}),
            width: dimension(it.width),
            height: dimension(it.height),
        });
    }
    return { items, hasNext: Boolean(r.hasNext) };
}
