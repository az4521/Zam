// Whether link-preview media may be fetched automatically.
//
// A preview's image/video URLs come from the page being previewed, so they
// usually point at a third-party host. Loading one hands that host the
// reader's IP, the time they scrolled the message into view, and their client
// metadata — a read receipt the sender never had to ask for (audit PRIV-03).
// The homeserver's own copy (an `mxc://` the preview API cached, rendered
// through our media endpoint) carries none of that: the homeserver already
// knows the message exists.
import { isSameOrigin } from "$lib/utils/mxcUri";

export type LinkPreviewMedia =
    /** Load preview media from any host (the historical behaviour). */
    | "all"
    /** Load only media served by our own homeserver. */
    | "proxied"
    /** Never load preview media automatically. */
    | "none";

/** Default is the historical behaviour: flipping it would change what every
 *  existing user sees without them asking. */
export const DEFAULT_LINK_PREVIEW_MEDIA: LinkPreviewMedia = "all";

export function normalizeLinkPreviewMedia(
    value: string | null | undefined,
): LinkPreviewMedia {
    return value === "all" || value === "proxied" || value === "none"
        ? value
        : DEFAULT_LINK_PREVIEW_MEDIA;
}

/**
 * True when `mediaUrl` may be put into flight without the user asking.
 *
 * Fails CLOSED: no URL, a malformed URL, or an unknown/absent homeserver base
 * means "do not load" under any policy stricter than "all".
 */
export function allowsMediaAutoLoad(
    policy: LinkPreviewMedia,
    mediaUrl: string | null | undefined,
    homeserverBaseUrl: string | null | undefined,
): boolean {
    if (!mediaUrl) return false;
    if (policy === "none") return false;
    if (policy === "all") return true;
    if (!homeserverBaseUrl) return false;
    return isSameOrigin(mediaUrl, homeserverBaseUrl);
}

/**
 * True when we may contact a third-party service DIRECTLY — the YouTube embed
 * iframe and the fxtwitter JSON API. These bypass the homeserver entirely, so
 * unlike preview media there is no proxied variant to fall back to: they are
 * either allowed or they are not.
 */
export function allowsThirdPartyEmbed(policy: LinkPreviewMedia): boolean {
    return policy === "all";
}
