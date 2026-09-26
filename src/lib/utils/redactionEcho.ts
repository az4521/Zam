/**
 * Minimal structural interface for pending events passed to redactionEcho utils.
 * Avoids importing the SDK to keep this module pure.
 */
export interface PendingEventLike {
    isRedaction(): boolean;
    getAssociatedId(): string | undefined;
    status: string | null;
}

/**
 * Finds the LAST pending event that is a failed redaction echo for the given
 * target event. A match must satisfy all three criteria: `isRedaction() === true`,
 * `getAssociatedId() === targetEventId`, and `status === notSentValue`.
 *
 * Returns `undefined` if no matching echo is found. When multiple matches exist,
 * returns the last one (the most recent redaction attempt).
 *
 * @param pending - Array of pending events from `room.getPendingEvents()`
 * @param targetEventId - The event ID that was being redacted
 * @param notSentValue - The status value indicating failure (e.g., "not_sent")
 * @returns The failed redaction echo, or undefined if not found
 */
export function findFailedRedactionEcho<T extends PendingEventLike>(
    pending: T[],
    targetEventId: string,
    notSentValue: string,
): T | undefined {
    let result: T | undefined = undefined;
    for (const event of pending) {
        if (
            event.isRedaction() &&
            event.getAssociatedId() === targetEventId &&
            event.status === notSentValue
        ) {
            result = event;
        }
    }
    return result;
}
