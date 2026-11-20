import { getUrlPreview, type UrlPreview } from "$lib/matrix/client";
import { pluginRegistry } from "$lib/stores/plugins.svelte";
import { applyPreviewUrlTransforms } from "$lib/plugins/outgoingTransforms";
import { fetchGifEmbed, isGifHostLink } from "$lib/utils/gifEmbed";

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
 * The preview the chat shows for a link: the homeserver's preview, with a
 * GIF-site embed standing in when the homeserver came back without media (and
 * the policy allows third-party embeds). Shared by LinkPreview.svelte and the
 * Discord favourites import, so both see the same media for a link.
 */
export async function fetchLinkPreview(
    url: string,
    allowEmbeds: boolean,
): Promise<LinkPreviewFetch> {
    const data = await getUrlPreview(homeserverPreviewUrl(url));
    if (isGifHostLink(url) && !data?.imageUrl && !data?.videoUrl) {
        if (allowEmbeds) {
            const embed = await fetchGifEmbed(url).catch(() => null);
            if (embed) return { preview: embed, gifHostHeld: false };
        } else {
            return { preview: usablePreview(data), gifHostHeld: true };
        }
    }
    return { preview: usablePreview(data), gifHostHeld: false };
}
