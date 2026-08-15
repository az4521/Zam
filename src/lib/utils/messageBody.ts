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
    /**
     * Room member userIds. A bare "@user:server" the sender TYPED (rather than
     * inserting via the autocomplete pill) is mentioned and linkified only when
     * it matches a member here. Without this a hand-typed mention never lands in
     * m.mentions.user_ids, so the target is never notified — the "can't ping the
     * bridged user from Zam, only from Cinny" report. Element/Cinny notify on
     * typed MXIDs too. Omitted → typed MXIDs are left alone (legacy behaviour).
     */
    memberIds?: Set<string>;
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

    // Combine the explicit (pill) mentions with any bare "@user:server" the
    // sender typed that resolves to a room member — otherwise a hand-typed
    // mention never reaches m.mentions.user_ids and the target isn't notified.
    const mentions = new Map(input.mentions);
    if (input.memberIds && input.memberIds.size) {
        const already = new Set(mentions.values());
        for (const match of plain.matchAll(/@\S+/g)) {
            let token = match[0];
            if (!token.includes(":")) continue;
            // A trailing ")", ".", ",", etc. is sentence punctuation, not part
            // of the MXID (server names contain dots), so peel it back until the
            // token matches a real member id.
            while (token.length > 1 && !input.memberIds.has(token)) {
                if (!/[.,!?;:)\]}"']$/.test(token)) break;
                token = token.slice(0, -1);
            }
            if (
                input.memberIds.has(token) &&
                !mentions.has(token) &&
                !already.has(token)
            ) {
                mentions.set(token, token);
                already.add(token);
            }
        }
    }

    // Replace @-mention tokens with Matrix mention links. Keys already
    // include the leading "@". The negative lookahead matches whole tokens
    // only, so "@alice" doesn't match inside "@alice:hs" or "@alicia".
    const mentionedUserIds: string[] = [];
    for (const [token, userId] of mentions) {
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
