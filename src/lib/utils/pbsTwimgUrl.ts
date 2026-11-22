// Direct embeds for X/Twitter's image CDN. A link to a photo or a card image on
// pbs.twimg.com is shown inline, the way GIF-site links are, because a
// homeserver's URL preview often gets nothing back for it. Only the exact host,
// https, and the two image paths count; userinfo, a port or a lookalike host is
// refused.

const IMAGE_PATH_RE = /^\/(?:media|card_img)\/[^/]/;

/** True when `raw` is an https link to a photo or card image on pbs.twimg.com. */
export function isDirectPbsImageUrl(raw: string | null | undefined): boolean {
    if (!raw) return false;
    let u: URL;
    try {
        u = new URL(raw);
    } catch {
        return false;
    }
    return (
        u.protocol === "https:" &&
        u.hostname === "pbs.twimg.com" &&
        u.port === "" &&
        u.username === "" &&
        u.password === "" &&
        IMAGE_PATH_RE.test(u.pathname)
    );
}
