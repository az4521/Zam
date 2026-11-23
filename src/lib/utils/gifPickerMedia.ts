// Where the GIF picker loads a GIF-site favourite's tile from.
//
// A favourite starred from a link preview stores the homeserver's rehosted
// copy of the Tenor/GIPHY/KLIPY media. That copy is only as available as the
// homeserver is, and a slow or broken media repo leaves the picker blank. The
// sites themselves serve the same media, so by default the tile comes straight
// from the site and the stored copy is kept as the fallback.
import type { FavouriteGif } from "$lib/matrix/client";
import { isGifHostLink, isGifHostMediaUrl } from "$lib/utils/gifEmbed";
import type { KlipyEmbed } from "$lib/utils/klipy";

export type GifPickerMedia =
    /** Tiles of GIF-site links load from the site itself. */
    | "direct"
    /** Tiles load the copy stored with the favourite (usually the
     *  homeserver's). */
    | "homeserver";

export const DEFAULT_GIF_PICKER_MEDIA: GifPickerMedia = "direct";

export function normalizeGifPickerMedia(
    value: string | null | undefined,
): GifPickerMedia {
    return value === "direct" || value === "homeserver"
        ? value
        : DEFAULT_GIF_PICKER_MEDIA;
}

/**
 * Whether a favourite's tile should be resolved from its GIF site: a
 * Tenor/GIPHY/KLIPY link (not an upload or a starred video) whose stored
 * media is not already on that site's own hosts.
 */
export function wantsDirectTile(gif: FavouriteGif): boolean {
    if (gif.source || gif.video || !isGifHostLink(gif.url)) return false;
    const stored = [gif.previewUrl, gif.previewVideoUrl].filter(
        (u): u is string => !!u,
    );
    return !stored.length || !stored.every((u) => isGifHostMediaUrl(u));
}

/** The favourite with its tile media taken from the site's embed, or null
 *  when the embed has nothing to show. */
export function directTile(
    gif: FavouriteGif,
    embed: KlipyEmbed | null | undefined,
): FavouriteGif | null {
    if (!embed) return null;
    const video = embed.videoUrl;
    const still = embed.videoThumbnailUrl ?? embed.imageUrl;
    const previewUrl = still ?? video;
    if (!previewUrl) return null;
    const out: FavouriteGif = { ...gif, previewUrl };
    if (video) out.previewVideoUrl = video;
    else delete out.previewVideoUrl;
    return out;
}
