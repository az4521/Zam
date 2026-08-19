/**
 * Pure send-gating helpers for the offline message queue.
 *
 * `shouldQueueSend` decides when a message should be held in the outbox rather
 * than sent immediately — when we're offline (browser or SDK clearly down).
 *
 * `classifySendError` determines whether a failed send is worth retrying.
 * Default is "retriable" so network errors (no httpStatus) go back to the queue;
 * the store caps retry attempts, so a truly-stuck item still becomes `failed`.
 */

/**
 * Are we offline enough to queue a send rather than attempting it?
 * `true` when the browser is offline OR the sync state is clearly down
 * (STOPPED/ERROR); `false` on healthy or actively-recovering states
 * (SYNCING/PREPARED/CATCHUP/RECONNECTING/null/undefined).
 */
export function shouldQueueSend(input: {
    syncState: string | null | undefined;
    online: boolean;
}): boolean {
    // Browser offline → always queue
    if (!input.online) return true;
    // Clearly-down sync states → queue
    if (input.syncState === "STOPPED" || input.syncState === "ERROR")
        return true;
    // Healthy or recovering states → send normally
    return false;
}

/** Classification of a send error: retriable or terminal. */
export type SendErrorClass = "retriable" | "terminal";

/**
 * Classify a send error to decide whether it's worth retrying.
 * - 429 rate-limit → retriable
 * - 5xx server errors → retriable
 * - 4xx client errors (not 429) → terminal
 * - No httpStatus (network/timeout) → retriable
 * - Unknown → retriable (safe default)
 */
export function classifySendError(err: unknown): SendErrorClass {
    // Null or non-object → retriable (safe default)
    if (typeof err !== "object" || err === null) return "retriable";

    // Read httpStatus defensively
    const e = err as { httpStatus?: unknown };
    if (typeof e.httpStatus !== "number") return "retriable";

    const status = e.httpStatus;

    // 429 rate-limit is retriable even though it's 4xx
    if (status === 429) return "retriable";

    // 5xx server errors are retriable
    if (status >= 500) return "retriable";

    // Other 4xx are terminal (bad request, forbidden, too large, etc.)
    if (status >= 400 && status < 500) return "terminal";

    // Anything else → retriable
    return "retriable";
}
