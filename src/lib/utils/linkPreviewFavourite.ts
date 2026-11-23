import type { FavouriteGif } from "$lib/matrix/client";

/** GIF-sharing sites (Tenor/Giphy/Klipy), matched on the registrable domain's
 *  second-level label so `media.tenor.com` counts but `tenor.com.evil.example`
 *  does not. */
export function isGifSiteUrl(url: string): boolean {
    try {
        const labels = new URL(url).hostname.split(".");
        const sld = labels[labels.length - 2];
        return sld === "tenor" || sld === "giphy" || sld === "klipy";
    } catch {
        return false;
    }
}

/** The parts of a link preview a favourite is built from. */
export interface FavouritablePreview {
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    videoUrl?: string;
    videoThumbnailUrl?: string;
    videoWidth?: number;
    videoHeight?: number;
}

/**
 * The favourite to store for a link preview's embedded media, keyed by the
 * link itself so the picker sends the link (and it previews again).
 *
 * A video embed often has no image at all: an embed-fixer link such as
 * kkinstagram answers the previewer with the raw mp4, so the homeserver
 * returns og:video and no og:image. The picker then has nothing but the video
 * to show, so it becomes the tile (`previewVideoUrl`). GIF-site videos get the
 * moving tile too, since a still poster is not what was starred.
 *
 * Null when the preview carries no media to show in the picker.
 */
export function linkPreviewFavourite(
    url: string,
    preview: FavouritablePreview | null | undefined,
    opts: { gifSite?: boolean } = {},
): Omit<FavouriteGif, "addedAt"> | null {
    if (!preview) return null;
    const video = preview.videoUrl;
    const still = video
        ? (preview.videoThumbnailUrl ?? preview.imageUrl)
        : preview.imageUrl;
    const previewUrl = still ?? video;
    if (!previewUrl) return null;
    const [width, height] = video
        ? [preview.videoWidth, preview.videoHeight]
        : [preview.imageWidth, preview.imageHeight];
    return {
        url,
        previewUrl,
        ...(video && (!still || opts.gifSite)
            ? { previewVideoUrl: video }
            : {}),
        ...(width && height && width > 0 && height > 0
            ? { width, height }
            : {}),
    };
}

/** The tile media a favourite's link preview gives it now. */
export interface FavouriteMediaRefresh {
    previewUrl: string;
    previewVideoUrl: string;
}

/**
 * Whether a favourite is a GIF-site link with no moving tile: one starred
 * before GIF-site links kept their video, whose tile is then a still server
 * thumbnail (the homeserver ignores `animated=true` and answers with a PNG).
 * Its link preview is fetched again to give it the video a new star gets.
 * Uploads, encrypted favourites and starred videos are never links.
 */
export function needsGifSiteRefresh(gif: FavouriteGif): boolean {
    return (
        !gif.previewVideoUrl &&
        !gif.source &&
        !gif.video &&
        isGifSiteUrl(gif.url)
    );
}

/** The refreshed tile for a GIF-site favourite from its link preview, or null
 *  when the preview still has no video to show. */
export function gifSiteRefresh(
    url: string,
    preview: FavouritablePreview | null | undefined,
): FavouriteMediaRefresh | null {
    const entry = linkPreviewFavourite(url, preview, { gifSite: true });
    if (!entry?.previewVideoUrl) return null;
    return {
        previewUrl: entry.previewUrl,
        previewVideoUrl: entry.previewVideoUrl,
    };
}

/**
 * The list with each refreshed favourite's tile media replaced, matched by
 * URL; the old still is kept as the poster when there is one. Only an entry
 * that still needs it is touched, so a refresh racing a
 * newer edit from another device cannot undo it. Returns `gifs` itself when
 * nothing changes.
 */
export function applyFavouriteMediaRefresh(
    gifs: FavouriteGif[],
    refreshes: ReadonlyMap<string, FavouriteMediaRefresh>,
): FavouriteGif[] {
    let changed = false;
    const out = gifs.map((g) => {
        const r = refreshes.get(g.url);
        if (!r || !needsGifSiteRefresh(g)) return g;
        changed = true;
        // The old still stays as the poster: it is a small server thumbnail,
        // where the preview's own still is the full-size GIF.
        return {
            ...g,
            previewUrl: g.previewUrl || r.previewUrl,
            previewVideoUrl: r.previewVideoUrl,
        };
    });
    return changed ? out : gifs;
}
