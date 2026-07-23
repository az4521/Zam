import { stripBodyFallback, stripFormattedFallback } from "./replyFallback";

const RELATION_KEYS = new Set(["m.relates_to", "m.new_content", "m.mentions"]);

/**
 * Clone message content for a new room without carrying conversation-local
 * reply, thread, edit, or mention metadata into the destination.
 *
 * When the source was a reply, its `body`/`formatted_body` may still contain a
 * legacy rich-reply fallback (a quoted `> …` prefix / `<mx-reply>` block from a
 * pre-v1.13 sender). We read the reply relation BEFORE stripping relations so
 * we can strip that fallback too — otherwise the forwarded copy would leak the
 * quoted text with no relation to explain it.
 */
export function buildForwardContent(
    content: Record<string, unknown>,
): Record<string, unknown> {
    const clone = structuredClone(content);

    const relatesTo = clone["m.relates_to"] as
        | { "m.in_reply_to"?: unknown }
        | undefined;
    const wasReply = !!relatesTo?.["m.in_reply_to"];

    for (const key of RELATION_KEYS) delete clone[key];

    if (wasReply) {
        if (typeof clone.body === "string")
            clone.body = stripBodyFallback(clone.body);
        if (typeof clone.formatted_body === "string")
            clone.formatted_body = stripFormattedFallback(clone.formatted_body);
    }

    return clone;
}
