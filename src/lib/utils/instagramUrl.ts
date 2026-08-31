/**
 * Detect whether a URL points to Instagram (instagram.com or instagr.am).
 *
 * Used to determine whether a preview-card thumbnail should open the link
 * (Instagram reels/posts) or zoom in a lightbox (everything else).
 *
 * Matches on the registrable domain's second-level label so e.g.
 * `www.instagram.com` and `m.instagram.com` match but
 * `instagram.com.evil.example` does not.
 */
export function isInstagramUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
            return false;
        }
        // new URL lowercases the hostname, so uppercase hosts match.
        const labels = u.hostname.split(".");
        const sld = labels[labels.length - 2];
        const tld = labels[labels.length - 1];
        return sld === "instagram" || (sld === "instagr" && tld === "am");
    } catch {
        return false;
    }
}
