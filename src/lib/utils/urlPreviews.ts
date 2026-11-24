/**
 * Which URLs in a message get a link preview, and how a sender says so.
 *
 * Interop follows MSC4095 (bundled URL previews): a message may carry
 * `m.url_previews` (unstable `com.beeper.linkpreviews`, used by gomuks, Beeper
 * and the mautrix bridges). When the key is present, only the URLs listed in it
 * are previewed and an empty list means none. When it is absent, receivers fall
 * back to scanning the body.
 *
 * The body scan skips URLs inside code (fenced blocks and inline spans, in the
 * markdown body and in formatted_body's <pre>/<code>) and URLs written as a
 * markdown autolink `<https://...>`, the same "no embed" syntax Discord uses.
 *
 * Senders: when the composer text suppresses a URL with `<...>`, the outgoing
 * content lists the URLs that should still be previewed (entries carrying only
 * a matched URL, which MSC4095 defines as "fetch this one from the homeserver").
 * Nothing is added when no URL is suppressed, so ordinary messages are unchanged.
 *
 * Pure: no SDK, no DOM.
 */

export const URL_PREVIEWS_KEY = "m.url_previews";
export const URL_PREVIEWS_UNSTABLE_KEY = "com.beeper.linkpreviews";

const URL_RE = /https?:\/\/[^\s<>"')\]`]+/g;
const AUTOLINK_RE = /<https?:\/\/[^\s<>]+>/g;
const HAS_AUTOLINK_RE = /<https?:\/\/[^\s<>]+>/;

/** Body with fenced code blocks and inline code spans blanked out. An unclosed
 *  fence runs to the end, as in the composer's markdown. */
function stripCode(text: string): string {
    return text
        .replace(/```[\s\S]*?(?:```|$)/g, " ")
        .replace(/``[^\n]*?``|`[^`\n]+`/g, " ");
}

/** URLs that appear inside <pre> or <code> in formatted_body. */
function urlsInHtmlCode(html: string): Set<string> {
    const out = new Set<string>();
    for (const m of html.matchAll(/<(pre|code)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
        const text = m[2]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        for (const url of text.match(URL_RE) ?? []) out.add(url);
    }
    return out;
}

/**
 * The http(s) URLs in a message body that a preview may be shown for, in order,
 * de-duplicated. Skips code and `<url>` autolinks.
 */
export function previewableBodyUrls(
    body: string,
    formattedBody?: string | null,
): string[] {
    // An autolinked occurrence is dropped; the same URL written bare
    // elsewhere in the message is still previewed.
    const candidates = stripCode(body).replace(AUTOLINK_RE, " ").match(URL_RE);
    const inCode = formattedBody ? urlsInHtmlCode(formattedBody) : null;
    return [...new Set(candidates ?? [])].filter((url) => !inCode?.has(url));
}

/** The MSC4095 list on received content, or null when the sender sent none. */
function bundledList(content: Record<string, unknown>): unknown[] | null {
    const list =
        content[URL_PREVIEWS_KEY] ?? content[URL_PREVIEWS_UNSTABLE_KEY];
    return Array.isArray(list) ? list : null;
}

/**
 * The URLs a received message should show previews for. Honours an MSC4095
 * list when present (entries whose matched URL is not in the body are ignored,
 * per the MSC); otherwise scans the body.
 */
export function urlsToPreview(
    content: Record<string, unknown> | null | undefined,
    body: string,
    formattedBody?: string | null,
): string[] {
    const list = content ? bundledList(content) : null;
    if (!list) return previewableBodyUrls(body, formattedBody);
    const out: string[] = [];
    for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const url = e["matrix:matched_url"] ?? e.matched_url;
        if (
            typeof url === "string" &&
            /^https?:\/\//i.test(url) &&
            body.includes(url) &&
            !out.includes(url)
        )
            out.push(url);
    }
    return out;
}

/** The text a content object's previews are decided from: body for text, or a
 *  media caption. A media body that is only its file name has no URLs to hint. */
function hintBody(content: Record<string, unknown>): string | null {
    const body = content.body;
    if (typeof body !== "string") return null;
    const msgtype = content.msgtype;
    if (msgtype === "m.text" || msgtype === "m.emote" || msgtype === "m.notice")
        return body;
    // MSC2530 caption: `filename` present and different from body.
    if (typeof content.filename === "string" && content.filename !== body)
        return body;
    return null;
}

/** Generated preview entries for outgoing URLs, keyed by URL (see
 *  utils/previewBundler.ts). Each value is a full MSC4095 entry. */
export type BundledEntries = ReadonlyMap<string, Record<string, unknown>>;

function withHintOn(
    content: Record<string, unknown>,
    bundled: BundledEntries | undefined,
): Record<string, unknown> {
    if (bundledList(content)) return content;
    const body = hintBody(content);
    if (body === null) return content;
    const formatted =
        typeof content.formatted_body === "string"
            ? content.formatted_body
            : null;
    const urls = previewableBodyUrls(body, formatted);
    const suppressed = HAS_AUTOLINK_RE.test(stripCode(body));
    const anyBundled = urls.some((url) => bundled?.has(url));
    // Nothing suppressed and nothing generated: no list, so receivers scan
    // the body as they always have.
    if (!suppressed && !anyBundled) return content;
    return {
        ...content,
        [URL_PREVIEWS_UNSTABLE_KEY]: urls.map(
            (url) => bundled?.get(url) ?? { matched_url: url },
        ),
    };
}

/**
 * Outgoing content with an MSC4095 preview list added when the sender
 * suppressed a URL with `<...>` or a preview was generated for one. A URL
 * with no generated preview gets an entry with only its matched URL, which
 * tells receivers to ask their homeserver. Applied to `m.new_content` too, so
 * an edit carries it. Content that already has a list is left as it is.
 */
export function withUrlPreviewHints(
    content: Record<string, unknown>,
    bundled?: BundledEntries,
): Record<string, unknown> {
    let out = withHintOn(content, bundled);
    const nc = out["m.new_content"];
    if (nc && typeof nc === "object" && !Array.isArray(nc)) {
        const next = withHintOn(nc as Record<string, unknown>, bundled);
        if (next !== nc) out = { ...out, "m.new_content": next };
    }
    return out;
}
