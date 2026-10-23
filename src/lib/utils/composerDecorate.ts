// The rich editors' DOM for their plain-text model: markdown markers stay
// visible but styled, custom emote tokens get their image, mentions and links
// get highlighted. The text content always equals the model (see composerDom).

export function escapeHtml(plain: string): string {
    return plain
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export interface DecorateOptions {
    /** Image URL for a custom emote's shortcode (without colons), if any. */
    emojiSrc: (shortcode: string) => string | null;
    /** Whether an `@token` names someone, to highlight it. */
    isMention?: (token: string) => boolean;
}

// `__u__` and `_em_` must not follow a word character. That used to be a
// lookbehind, which Safari < 16.4 can't parse (here, at module level, it
// stopped the whole app loading); `inlineTokens` checks it instead.
const TOKEN_RE =
    /(https?:\/\/[^\s<>)"']+|@[^\s<]+|`[^`\n]+`|\*\*\*[^*\n][\s\S]*?\*\*\*|\*\*[^*\n][\s\S]*?\*\*|__[^_\n][\s\S]*?__(?![\w])|\*[^*\n]+\*|_[^_\n]+_(?![\w])|~~[^~\n]+~~|\|\|[^|\n]+\|\||:[a-zA-Z0-9_+-]+:)/g;

/** TOKEN_RE's matches, minus `_`/`__` tokens glued to a word. A rejected one
 *  rescans from the next character, as the lookbehind's failed match did. */
function* inlineTokens(plain: string): Generator<RegExpExecArray> {
    const re = new RegExp(TOKEN_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(plain))) {
        if (
            match[0].startsWith("_") &&
            /\w/.test(plain[match.index - 1] ?? "")
        ) {
            re.lastIndex = match.index + 1;
            continue;
        }
        yield match;
    }
}

function customEmojiHtml(
    token: string,
    emojiSrc: DecorateOptions["emojiSrc"],
): string | null {
    // Every inline token comes through here, so `*emoji*` or `_emoji_`
    // would otherwise lose its markers and match an emote named "emoji".
    if (!/^:[a-zA-Z0-9_+-]+:$/.test(token)) return null;
    const src = emojiSrc(token.slice(1, -1));
    if (!src) return null;
    return `<span class="composer-custom-emoji"><img src="${escapeHtml(src)}" alt="" draggable="false" contenteditable="false" />${escapeHtml(token)}</span>`;
}

export function decorateComposerText(
    plain: string,
    { emojiSrc, isMention = () => false }: DecorateOptions,
): string {
    let html = "";
    let pos = 0;
    for (const match of inlineTokens(plain)) {
        const token = match[0];
        const index = match.index ?? 0;
        html += escapeHtml(plain.slice(pos, index));

        const customEmoji = customEmojiHtml(token, emojiSrc);
        if (customEmoji) {
            html += customEmoji;
        } else if (token.startsWith("@") && isMention(token)) {
            html += `<span class="composer-mention">${escapeHtml(token)}</span>`;
        } else if (
            token.startsWith("http://") ||
            token.startsWith("https://")
        ) {
            html += `<span class="composer-link">${escapeHtml(token)}</span>`;
        } else if (token.startsWith("`")) {
            html += `<code>${escapeHtml(token)}</code>`;
        } else if (token.startsWith("||")) {
            html += `<span class="composer-spoiler">${escapeHtml(token)}</span>`;
        } else if (token.startsWith("~~")) {
            html += `<del>${escapeHtml(token)}</del>`;
        } else if (token.startsWith("***")) {
            html += `<strong><em>${escapeHtml(token)}</em></strong>`;
        } else if (token.startsWith("**")) {
            html += `<strong>${escapeHtml(token)}</strong>`;
        } else if (token.startsWith("__")) {
            html += `<u>${escapeHtml(token)}</u>`;
        } else if (token.startsWith("*") || token.startsWith("_")) {
            html += `<em>${escapeHtml(token)}</em>`;
        } else {
            html += escapeHtml(token);
        }
        pos = index + token.length;
    }
    html += escapeHtml(plain.slice(pos));
    let out = html.replace(/\n/g, "<br>");
    // A trailing <br> renders as nothing in a contenteditable (and drops out
    // of innerText), so a message ending in a newline needs a placeholder
    // <br> to keep the empty line visible and round-trippable.
    if (plain.endsWith("\n")) out += "<br>";
    return out;
}
