import type { FavouriteGif } from "$lib/matrix/client";
import {
    linkPreviewFavourite,
    type FavouritablePreview,
} from "$lib/utils/linkPreviewFavourite";
import { safeDimension } from "$lib/utils/mediaDimensions";

/** One GIF the Electron main process read from the Discord desktop app. The
 *  preview is not in here: the renderer builds it from the link (see
 *  linkPreviewFetch). Untrusted: the main process reads these from disk. */
export interface DiscordFavouriteItem {
    url: string;
    /** Discord's own media URL. Only a size fallback; never a preview. */
    src?: string;
    video: boolean;
    width?: number;
    height?: number;
}

export type DiscordFavouritesResult =
    | { found: false }
    | {
          found: true;
          total: number;
          skippedDiscord: number;
          invalid: number;
          /** Newest first, Discord's order. */
          items: DiscordFavouriteItem[];
      };

function isHttpUrl(v: unknown): v is string {
    if (typeof v !== "string") return false;
    try {
        const p = new URL(v).protocol;
        return p === "http:" || p === "https:";
    } catch {
        return false;
    }
}

/** The items whose link is an http(s) URL. Anything else is dropped. */
export function usableDiscordItems(
    items: readonly DiscordFavouriteItem[],
): DiscordFavouriteItem[] {
    return items.filter((i) => i && isHttpUrl(i.url));
}

/**
 * The favourite for one Discord link, from the preview the chat would show for
 * it. Null when that preview has no media. Discord's size is used only when
 * the preview gives none.
 */
export function discordItemToFavourite(
    item: DiscordFavouriteItem,
    preview: FavouritablePreview | null,
    gifSite: boolean,
): Omit<FavouriteGif, "addedAt"> | null {
    const entry = linkPreviewFavourite(item.url, preview, { gifSite });
    if (!entry) return null;
    if (entry.width === undefined || entry.height === undefined) {
        const w = safeDimension(item.width);
        const h = safeDimension(item.height);
        if (w !== null && h !== null) return { ...entry, width: w, height: h };
    }
    return entry;
}

/**
 * Stamp imported favourites with addedAt so they sort OLDER than anything the
 * user already has, keeping Discord's order among themselves: index 0 (the
 * newest in Discord) gets the newest timestamp of the batch.
 */
export function discordItemsToFavourites(
    entries: readonly Omit<FavouriteGif, "addedAt">[],
    now: number,
): FavouriteGif[] {
    return entries.map((e, index) => ({ ...e, addedAt: now - 1000 - index }));
}

/**
 * Append imported favourites whose URL is not already in `base`, after the
 * existing ones. Returns `base` itself when nothing is added, so applying it
 * twice is the same as applying it once.
 */
export function mergeImportedFavourites(
    base: FavouriteGif[],
    imported: readonly FavouriteGif[],
): FavouriteGif[] {
    const seen = new Set(base.map((g) => g.url));
    const added: FavouriteGif[] = [];
    for (const g of imported) {
        if (seen.has(g.url)) continue;
        seen.add(g.url);
        added.push(g);
    }
    return added.length === 0 ? base : [...base, ...added];
}

/** `fn` over `items` with at most `limit` running at once. Results keep the
 *  input order. `fn` must not throw: wrap it so a failure becomes a value. */
export async function mapWithLimit<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>,
    onDone?: () => void,
): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
            onDone?.();
        }
    };
    const workers = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workers }, worker));
    return out;
}
