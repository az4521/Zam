/**
 * The first message of a draft DM (see `roomsState.draftDm`). The room does not
 * exist while it is being typed, so this is built from the text alone: markdown
 * and a hand-typed mention of the one person the DM is with — the only member
 * the room will have besides the sender. Same content shape the composer sends
 * (utils/messageContent), so the first message looks like every later one.
 */
import {
    buildFormattedBody,
    mentionsFromFormatted,
} from "$lib/utils/messageBody";
import {
    buildFormattedContent,
    buildTextContent,
} from "$lib/utils/messageContent";

/** Content for the draft's first message, or null when there is nothing to send. */
export function buildDraftDmContent(
    text: string,
    peerUserId: string,
): Record<string, unknown> | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const formatted = buildFormattedBody(trimmed, {
        mentions: new Map(),
        customEmojis: [],
        memberIds: new Set([peerUserId]),
    });
    const mentions = mentionsFromFormatted(formatted);
    return formatted.html
        ? buildFormattedContent(trimmed, formatted.html, mentions)
        : buildTextContent(trimmed, mentions);
}
