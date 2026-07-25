/**
 * In-room (cross-user) key verification requests arrive as a normal
 * `m.room.message` carrying `msgtype: "m.key.verification.request"` plus a
 * plain-text `body` fallback aimed at clients that don't support the flow
 * ("… is requesting to verify your key, but your client does not support
 * in-chat key verification"). Rendering that body verbatim tells the user their
 * client can't do something it CAN do, so the timeline renders a card instead.
 *
 * Pure view-model so the wording/decisions are unit-testable; the component
 * only supplies whether a live request is still pending.
 */

/** msgtype of an in-room verification request (it is an `m.room.message`). */
export const VERIFICATION_REQUEST_MSGTYPE = "m.key.verification.request";

/** Whether a timeline event is an in-room verification request. */
export function isVerificationRequestMessage(
    eventType: string,
    msgtype: string,
): boolean {
    return (
        eventType === "m.room.message" &&
        msgtype === VERIFICATION_REQUEST_MSGTYPE
    );
}

export interface VerificationRequestMessageInput {
    /** Did we send this request? */
    isOwn: boolean;
    /** Display name of the sender. */
    senderName: string;
    /**
     * Whether a live verification request is still in flight for this event.
     * The SDK keys in-room requests by the request event's id, so the timeline
     * event and the live controller match on id.
     */
    pending: boolean;
}

export interface VerificationRequestMessageView {
    heading: string;
    subtitle: string;
    /** Show Verify / Decline — only for a pending request someone sent US. */
    showActions: boolean;
}

/**
 * Wording for a verification-request card. A request that is no longer pending
 * says exactly that rather than guessing at an outcome: the request event alone
 * doesn't carry whether the flow completed or was cancelled (that lives in the
 * related `m.key.verification.done` / `.cancel` events).
 */
export function verificationRequestMessageView(
    input: VerificationRequestMessageInput,
): VerificationRequestMessageView {
    const { isOwn, senderName, pending } = input;
    if (isOwn) {
        return {
            heading: "Verification request sent",
            subtitle: pending
                ? "Waiting for them to accept…"
                : "No longer pending",
            showActions: false,
        };
    }
    if (pending) {
        return {
            heading: `${senderName} wants to verify`,
            subtitle: "Compare emoji to confirm this is really them",
            showActions: true,
        };
    }
    return {
        heading: `${senderName} sent a verification request`,
        subtitle: "No longer pending",
        showActions: false,
    };
}
