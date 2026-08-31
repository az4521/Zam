/**
 * Detect whether a URL points to Instagram (instagram.com or instagr.am).
 *
 * Used to determine whether a preview-card thumbnail should open the link
 * (Instagram reels/posts) or zoom in a lightbox (everything else).
 *
 * Matches the two real Instagram hosts exactly, on the registrable
 * second-level + top-level label, so `www.instagram.com` and
 * `m.instagram.com` match but `instagram.com.evil.example`,
 * `notinstagram.com`, and look-alike TLDs (`instagram.net`) do not.
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
        // Pin the TLD too: only instagram.com and instagr.am are real, so
        // instagram.net / instagram.co (non-Instagram) stay unaffected.
        return (
            (sld === "instagram" && tld === "com") ||
            (sld === "instagr" && tld === "am")
        );
    } catch {
        return false;
    }
}
