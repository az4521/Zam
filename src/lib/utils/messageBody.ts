import { parseMarkdown } from "./markdown";

/** Minimal shape the body-builder needs from a custom emoji (subset of client.ts CustomEmoji). */
export interface EmojiSubstitution {
    shortcode: string;
    mxcUrl: string; // mxc:// — embedded in formatted_body so other clients can proxy it
}

export interface FormattedBodyInput {
    /** Inserted mention tokens (INCLUDING the leading "@") → userId. */
    mentions: Map<string, string>;
    /** Custom emoji available for :shortcode: substitution (from getCustomEmojis). */
    customEmojis: EmojiSubstitution[];
}

export interface FormattedBodyResult {
    /** formatted_body HTML, or null when NOTHING was applied (no md, no mention, no emoji). */
    html: string | null;
    /** Distinct userIds whose mention token actually appears in `plain`. */
    mentionedUserIds: string[];
}

/**
 * Build a message's outgoing rich body: markdown → HTML, custom-emoji shortcode
 * substitution, and @mention tokens → matrix.to links, collecting mentioned userIds.
 * Pure — no SDK, no DOM. Callers supply the mention map and emoji list.
 */
export function buildFormattedBody(
    plain: string,
    input: FormattedBodyInput,
): FormattedBodyResult {
    // Apply markdown formatting
    const { formattedBody, hasFormatting } = parseMarkdown(plain);
    let html = formattedBody;
    let changed = hasFormatting;

    // Apply custom emoji shortcode substitution
    const shortcodes = [...plain.matchAll(/:(\w+):/g)].map((m) => m[1]);
    if (shortcodes.length > 0) {
        const available = input.customEmojis;
        const lookup = new Map(available.map((e) => [e.shortcode, e.mxcUrl]));
        for (const shortcode of shortcodes) {
            const mxcUrl = lookup.get(shortcode);
            if (mxcUrl) {
                const tag = `<img data-mx-emoticon src="${mxcUrl}" alt="${shortcode}" title="${shortcode}" height="32" />`;
                html = html.replaceAll(`:${shortcode}:`, tag);
                changed = true;
            }
        }
    }

    // Replace @-mention tokens with Matrix mention links. Keys already
    // include the leading "@". The negative lookahead matches whole tokens
    // only, so "@alice" doesn't match inside "@alice:hs" or "@alicia".
    const mentionedUserIds: string[] = [];
    for (const [token, userId] of input.mentions) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = `${escaped}(?![\\w:.-])`;
        if (new RegExp(pattern).test(plain)) {
            const link = `<a href="https://matrix.to/#/${userId}">${token}</a>`;
            html = html.replace(new RegExp(pattern, "g"), link);
            if (!mentionedUserIds.includes(userId))
                mentionedUserIds.push(userId);
            changed = true;
        }
    }

    return { html: changed ? html : null, mentionedUserIds };
}
