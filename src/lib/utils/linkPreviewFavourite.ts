import type { FavouriteGif } from "$lib/matrix/client";

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
