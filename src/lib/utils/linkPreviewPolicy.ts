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

/** Default is homeserver-only for privacy: third-party hosts never learn the
 *  reader's IP by default. Existing users get the safer default on next load,
 *  and the per-message reveal button restores media on demand. */
export const DEFAULT_LINK_PREVIEW_MEDIA: LinkPreviewMedia = "proxied";

export function normalizeLinkPreviewMedia(
    value: string | null | undefined,
): LinkPreviewMedia {
    return value === "all" || value === "proxied" || value === "none"
        ? value
        : DEFAULT_LINK_PREVIEW_MEDIA;
}

/**
 * True only when a preview media URL is a homeserver-rehosted `mxc://` — the
 * homeserver already knows the message exists, so serving its own copy leaks
 * nothing new. A non-mxc (raw third-party) `og:image`/`og:video` is
 * attacker-controlled and must never reach the DOM: the generic `<img>` path
 * would hand the attacker's host the reader's IP zero-click (SEC-M1 sub-case b).
 * Fails closed on an absent value.
 */
export function isMxcPreviewMedia(
    url: string | null | undefined,
): url is string {
    return !!url && url.startsWith("mxc://");
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
