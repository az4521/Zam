/**
 * The single decision for what body text an OS notification is allowed to
 * carry. When the device-global "hide message text" privacy setting is on,
 * notifications say who messaged but never what they said.
 *
 * Pure: no SDK types, no DOM, no storage. The two notification producers that
 * cannot import this module — the web-push service worker (`static/sw.js`) and
 * the Android FCM service (`MatrixMessagingService.java`) — mirror these exact
 * comparisons by hand. Change one, change all three.
 */

/** Suffix used when the body is hidden or absent. */
export const HIDDEN_BODY_SUFFIX = "sent a message";

/** Last-resort text when there is neither a sender name nor a usable body. */
export const GENERIC_NOTIFICATION_BODY = "New message";

export interface NotificationBodyOptions {
    /** Display name (or MXID) of the sender; may be empty. */
    sender: string;
    /** Cleartext preview of the message; may be empty. */
    body: string;
    /** The device-global privacy setting. */
    hideBody: boolean;
}

export function notificationBody({
    sender,
    body,
    hideBody,
}: NotificationBodyOptions): string {
    const name = sender.trim();
    const text = hideBody ? "" : body.trim();
    if (text) return name ? `${name}: ${text}` : text;
    return name ? `${name} ${HIDDEN_BODY_SUFFIX}` : GENERIC_NOTIFICATION_BODY;
}
