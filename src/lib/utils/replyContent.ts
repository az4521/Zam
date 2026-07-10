import { escapeHtml } from "./markdown";

export interface ReplyContentParams {
    roomId: string;
    replyEventId: string;
    replySender: string;
    /** Plain-text body of the replied-to event. */
    replyBody: string;
    /** HTML body of the replied-to event, if it had one (already spec HTML). */
    replyFormattedBody?: string;
    /** Plain text of the new reply. */
    text: string;
    /** Markdown-rendered HTML of the new reply, if any. */
    formattedText?: string;
    mentions?: { user_ids?: string[]; room?: boolean };
}

export interface ReplyContent {
    msgtype: "m.text";
    body: string;
    format: "org.matrix.custom.html";
    formatted_body: string;
    "m.relates_to": { "m.in_reply_to": { event_id: string } };
    "m.mentions"?: { user_ids?: string[]; room?: boolean };
}

/**
 * Build the content object for a rich reply (Matrix rich-reply fallback).
 *
 * All attacker-influenced strings — the new plain text, the quoted body, and
 * the sender id — are HTML-escaped so we never emit raw HTML into another
 * client's `formatted_body`. A pre-rendered `formattedText`/`replyFormattedBody`
 * is trusted as-is (it is produced by our own markdown renderer or is spec HTML
 * that the recipient will itself sanitize).
 */
export function buildReplyContent(params: ReplyContentParams): ReplyContent {
    const {
        roomId,
        replyEventId,
        replySender,
        replyBody,
        replyFormattedBody,
        text,
        formattedText,
        mentions,
    } = params;

    // Plain-text fallback: prefix each line of the original with "> "
    const quotedLines = replyBody
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    const body = `> <${replySender}> ${quotedLines}\n\n${text}`;

    const safeSender = escapeHtml(replySender);
    const quoted = replyFormattedBody ?? escapeHtml(replyBody);
    const formattedQuote =
        `<mx-reply><blockquote>` +
        `<a href="https://matrix.to/#/${roomId}/${replyEventId}">In reply to</a> ` +
        `<a href="https://matrix.to/#/${safeSender}">${safeSender}</a><br>${quoted}` +
        `</blockquote></mx-reply>`;

    const content: ReplyContent = {
        msgtype: "m.text",
        body,
        format: "org.matrix.custom.html",
        formatted_body: formattedQuote + (formattedText ?? escapeHtml(text)),
        "m.relates_to": { "m.in_reply_to": { event_id: replyEventId } },
    };
    if (mentions) content["m.mentions"] = mentions;
    return content;
}
