/**
 * Pure message-content builders shared by the online send wrappers (client.ts)
 * and the offline outbox. These produce byte-identical content objects so that
 * a queued message sent later looks exactly the same as a live send would have.
 */

/**
 * Build the content for a plain text message. Matches `sendTextMessage`.
 */
export function buildTextContent(body: string): Record<string, unknown> {
    return {
        msgtype: "m.text",
        body,
        "m.mentions": {},
    };
}

/**
 * Build the content for a formatted (HTML) message with optional mentions.
 * Matches `sendFormattedMessage`.
 */
export function buildFormattedContent(
    body: string,
    formattedBody: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Record<string, unknown> {
    return {
        msgtype: "m.text",
        body,
        format: "org.matrix.custom.html",
        formatted_body: formattedBody,
        "m.mentions": mentions ?? {},
    };
}
