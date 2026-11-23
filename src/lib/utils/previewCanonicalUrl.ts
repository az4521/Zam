/**
 * The `og:url` of a link preview as a link target. Only http and https URLs
 * are accepted: the value comes from a remote page, and an anchor with a
 * `javascript:` or `data:` href would run or show attacker content when
 * clicked. Anything else (or an empty or unparseable value) yields undefined.
 */
export function safePreviewCanonicalUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    try {
        const u = new URL(value.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
        return u.href;
    } catch {
        return undefined;
    }
}
