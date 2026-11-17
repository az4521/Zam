export interface ReplyContentParams {
    replyEventId: string;
    /** Plain text of the new reply. */
    text: string;
    /** Markdown-rendered HTML of the new reply, if any. */
    formattedText?: string;
    mentions?: { user_ids?: string[]; room?: boolean };
}

export interface ReplyContent {
    msgtype: "m.text";
    body: string;
    format?: "org.matrix.custom.html";
    formatted_body?: string;
    "m.relates_to": { "m.in_reply_to": { event_id: string } };
    "m.mentions"?: { user_ids?: string[]; room?: boolean };
}

/**
 * Build the content object for a reply.
 *
 * Matrix spec v1.13 REMOVED the rich-reply fallback (the quoted `> <@user> …`
 * body prefix and the `<mx-reply>…</mx-reply>` block in `formatted_body`): a
 * reply is now just the new text plus the `m.in_reply_to` relation. Emitting no
 * fallback also means we never re-serialize another client's (untrusted) body
 * or HTML into our outgoing event. Clients render the quote from the referenced
 * event; ours does so via `inReplyToId` in MessageItem.
 */
export function buildReplyContent(params: ReplyContentParams): ReplyContent {
    const { replyEventId, text, formattedText, mentions } = params;
    const content: ReplyContent = {
        msgtype: "m.text",
        body: text,
        "m.relates_to": { "m.in_reply_to": { event_id: replyEventId } },
    } as ReplyContent;
    if (formattedText) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedText;
    }
    // Always present (spec recommendation): an m.mentions key — even empty —
    // disables the legacy body-scan push rules on the receiving server.
    content["m.mentions"] = mentions ?? {};
    return content;
}

/**
 * Add the replied-to author to an outgoing reply's `m.mentions` (the "ping"
 * toggle on the reply bar). Matrix does not do this on its own: without the
 * author in `user_ids` the reply never notifies them. Replying to yourself
 * never pings.
 */
export function withReplyMention(
    mentions: { user_ids?: string[]; room?: boolean } | undefined,
    senderId: string | null | undefined,
    ping: boolean,
    ownUserId?: string | null,
): { user_ids?: string[]; room?: boolean } | undefined {
    if (!ping || !senderId || senderId === ownUserId) return mentions;
    const ids = mentions?.user_ids ?? [];
    if (ids.includes(senderId)) return mentions;
    return { ...mentions, user_ids: [...ids, senderId] };
}
