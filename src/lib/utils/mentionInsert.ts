export interface MentionInsertResult {
    /** The composer model text after the pill is spliced in. */
    text: string;
    /** Where the caret should land — just past the pill's separating space. */
    caret: number;
}

/**
 * Splice a committed mention into the composer model, replacing the "@query"
 * the user was typing with "@label " and returning the text plus the caret
 * position.
 *
 * `mentionStart` is the index of the "@" and `queryLength` is the run of
 * non-whitespace the user had typed after it (up to the caret). Everything from
 * the caret onward is kept, minus the remainder of the same partly-typed word
 * (the leading `\S*`) — e.g. the caret sitting after "bo" in "@bobby" drops the
 * dangling "bby".
 *
 * Exactly ONE space separates the pill from any following text. If that
 * following text already begins with whitespace (the user was editing an
 * existing sentence, or the mention sits at the end of a line), the pill reuses
 * it instead of adding a second — otherwise committing a mention mid-sentence
 * left a stray double space ("@alice  are you there"). The user's own spacing
 * is left untouched; only the space the insert would itself introduce is
 * suppressed.
 */
export function insertMention(params: {
    text: string;
    mentionStart: number;
    queryLength: number;
    label: string;
}): MentionInsertResult {
    const { text, mentionStart, queryLength, label } = params;
    const before = text.slice(0, mentionStart);
    // The text after the caret, minus the tail of the word being completed.
    const rest = text.slice(mentionStart + 1 + queryLength).replace(/^\S*/, "");
    const token = "@" + label;
    // Add our own separating space only when the remainder doesn't already
    // start with whitespace — never manufacture a double space.
    const gap = /^\s/.test(rest) ? "" : " ";
    return {
        text: before + token + gap + rest,
        // Just past the single space that now separates the pill from `rest`.
        caret: mentionStart + token.length + 1,
    };
}

/**
 * Append a mention at the end of the composer text. Adds one leading space only
 * when the text is non-empty and does not already end in whitespace. Always adds
 * a trailing space so the user can type after the pill.
 */
export function appendMention(
    text: string,
    label: string,
): MentionInsertResult {
    const needsGap = text.length > 0 && !/\s$/.test(text);
    const next = text + (needsGap ? " " : "") + "@" + label + " ";
    return { text: next, caret: next.length };
}
