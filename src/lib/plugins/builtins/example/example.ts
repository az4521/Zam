/**
 * Pure helpers for the zam.example template plugin. Zero SDK/DOM/store imports
 * — safe to unit-test and to reason about in isolation. The plugin module
 * (index.ts) is thin glue over these.
 */

/** Escape the five HTML-significant characters. Applied to every value that is
 *  interpolated into the embed markup (defense-in-depth; the host's
 *  sanitizeMatrixHtml is the real backstop). */
export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** The /example command's pure core: prefix the arg with the configured
 *  greeting. Empty/whitespace arg → just the greeting. Never throws. */
export function formatExampleMessage(greeting: string, arg: string): string {
    const trimmed = arg.trim();
    return trimmed ? `${greeting} ${trimmed}` : greeting;
}

/** Build a sanitizer-safe HTML card for the custom embed. Uses only tags the
 *  Matrix allowlist keeps (blockquote/p/strong/em/code); NO class/style, no
 *  <script>/<img>/event handlers. Every interpolated value is escaped. A
 *  malformed URL degrades gracefully (host line omitted), never throws. */
export function buildExampleEmbedHtml(
    url: string,
    opts: { title: string; showHost: boolean },
): string {
    let host = "";
    if (opts.showHost) {
        try {
            host = new URL(url).hostname.replace(/^www\./, "");
        } catch {
            host = "";
        }
    }
    const hostLine = host
        ? `<p>Host: <code>${escapeHtml(host)}</code></p>`
        : "";
    return (
        `<blockquote>` +
        `<p><strong>${escapeHtml(opts.title)}</strong></p>` +
        hostLine +
        `<p><em>Rendered by the example plugin via the host-sanitized ctx.html path — the raw link still shows above.</em></p>` +
        `</blockquote>`
    );
}
