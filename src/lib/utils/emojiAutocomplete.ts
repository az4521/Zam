// `:shortcode` autocomplete shared by the composer (MessageInput) and the
// inline message editor (MessageItem): finding the query at the caret,
// ranking candidates, and splicing the pick into the text.

import type { CustomEmoji } from "$lib/matrix/client";
import { ALL_EMOJIS } from "$lib/data/emojis";
import { shortcodesFor } from "$lib/data/emojiShortcodes";
import { textSymbolPresentation } from "$lib/utils/twemoji";

export type EmojiCandidate =
    | { kind: "unicode"; emoji: string; name: string }
    | {
          kind: "custom";
          shortcode: string;
          url: string;
          /** The room or space its pack lives in (CustomEmoji.source). */
          source?: string;
      };

export interface EmojiQuery {
    /** The text typed after the colon. */
    query: string;
    /** Offset of the colon. */
    start: number;
}

/** The open `:word` (no closing colon yet) ending at the caret, if any. */
export function findEmojiQuery(text: string, caret: number): EmojiQuery | null {
    const match = text.slice(0, caret).match(/:(\w+)$/);
    return match ? { query: match[1], start: caret - match[0].length } : null;
}

/**
 * Suggestions for `query` (at least 2 chars): up to 5 custom emotes, then
 * unicode emoji, 8 in all. Unicode ranks Discord-style: an exact shortcode
 * (":tm" → ™️) first, then shortcodes starting with the query, then any
 * shortcode or name containing it. The row shows the shortcode that matched.
 */
export function rankEmojiCandidates(
    query: string,
    customEmojis: CustomEmoji[],
): EmojiCandidate[] {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const custom = customEmojis
        .filter((e) => e.shortcode.toLowerCase().includes(q))
        .slice(0, 5)
        .map((e): EmojiCandidate => ({
            kind: "custom",
            shortcode: e.shortcode,
            url: e.url,
            source: e.source,
        }));
    const ranked: { rank: number; candidate: EmojiCandidate }[] = [];
    for (const e of ALL_EMOJIS) {
        const codes = shortcodesFor(e.emoji);
        const exact = codes.find((c) => c === q);
        const prefix = codes.find((c) => c.startsWith(q));
        const partial = codes.find((c) => c.includes(q));
        const rank = exact
            ? 0
            : prefix
              ? 1
              : partial || e.name.toLowerCase().includes(q)
                ? 2
                : -1;
        if (rank < 0) continue;
        ranked.push({
            rank,
            candidate: {
                kind: "unicode",
                emoji: e.emoji,
                name:
                    exact ??
                    prefix ??
                    partial ??
                    codes[0] ??
                    e.name.replace(/ /g, "_"),
            },
        });
    }
    // Array sort is stable, so equal ranks keep the emoji-picker order.
    const unicode = ranked
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8 - custom.length)
        .map((r) => r.candidate);
    return [...custom, ...unicode];
}

/**
 * `text` with the `:query` at `q` replaced by `candidate` plus a space (any
 * rest of the word after the caret goes too), and the caret after it. Unicode
 * picks insert the emoji; custom emotes stay `:shortcode:` tokens.
 */
export function applyEmojiCandidate(
    text: string,
    q: EmojiQuery,
    candidate: EmojiCandidate,
): { text: string; caret: number } {
    const before = text.slice(0, q.start);
    const after = text.slice(q.start + 1 + q.query.length).replace(/^\S*/, "");
    const insertion =
        candidate.kind === "unicode"
            ? textSymbolPresentation(candidate.emoji) + " "
            : `:${candidate.shortcode}: `;
    return {
        text: before + insertion + after,
        caret: before.length + insertion.length,
    };
}
