import { getUrlPreview, type UrlPreview } from "$lib/matrix/client";
import { pluginRegistry } from "$lib/stores/plugins.svelte";
import { applyPreviewUrlTransforms } from "$lib/plugins/outgoingTransforms";
import { fetchGifEmbed, isGifHostLink } from "$lib/utils/gifEmbed";
import { isGifSiteUrl } from "$lib/utils/linkPreviewFavourite";

export { isGifSiteUrl };

/** The URL the homeserver's preview endpoint is asked about. Plugins may point
 *  the request elsewhere (a mirror the homeserver can reach). */
export function homeserverPreviewUrl(url: string): string {
    return applyPreviewUrlTransforms(
        url,
        pluginRegistry.previewUrlTransforms.map((e) => e.value),
    );
}

export interface LinkPreviewFetch {
    preview: UrlPreview | null;
    /** A GIF-site link whose embed was withheld by the policy. */
    gifHostHeld: boolean;
}

function usablePreview(data: UrlPreview | null): UrlPreview | null {
    return data && (data.title || data.imageUrl || data.videoUrl) ? data : null;
}

/**
 * The preview the chat shows for a link. A GIF-site link (Tenor, GIPHY,
 * KLIPY) loads its media straight from the site when the policy allows
 * third-party embeds, so a slow or broken homeserver media repo cannot hold
 * it up; the homeserver's preview is the fallback when the site gives
 * nothing. Otherwise it is the homeserver's preview, and a GIF-site link it
 * comes back without media for is marked held. Shared by LinkPreview.svelte,
 * the GIF picker and the Discord favourites import, so all see the same media
 * for a link.
 */
export async function fetchLinkPreview(
    url: string,
    allowEmbeds: boolean,
): Promise<LinkPreviewFetch> {
    const gifHost = isGifHostLink(url);
    if (gifHost && allowEmbeds) {
        const embed = await fetchGifEmbed(url).catch(() => null);
        if (embed?.imageUrl || embed?.videoUrl)
            return { preview: embed, gifHostHeld: false };
    }
    const data = await getUrlPreview(homeserverPreviewUrl(url));
    const held = gifHost && !allowEmbeds && !data?.imageUrl && !data?.videoUrl;
    return { preview: usablePreview(data), gifHostHeld: held };
}
