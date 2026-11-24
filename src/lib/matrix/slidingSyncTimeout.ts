import type { MatrixClient } from "matrix-js-sdk";

/**
 * Guard client.slidingSync against lost and stalled responses.
 *
 * SlidingSync gives every request a local timeout of its long-poll timeout +
 * 10s (40s here). In the SDK's fetch that timeout, and the abort signal
 * resend() uses, only cover the wait for the response HEADERS: both are
 * detached once headers arrive (FetchHttpApi.requestOtherUrl), so the body
 * download is never cut off by either.
 *
 * So a timeout on a request that carries a `pos` (an ordinary long-poll) means
 * the server's answer never arrived: a mobile network dropping a connection
 * that sat idle through the long-poll, or a Wi-Fi/cellular handover. The SDK
 * retries at once, and the retry, carrying the same pos, is answered straight
 * away with whatever arrived meanwhile. Waiting longer only delays messages:
 * this wrapper used to double the next allowance on every timeout (up to 5
 * minutes), and the watchdog deferred to it, so a lost response or two left
 * new messages minutes late until the user switched rooms (whose resend()
 * makes a fresh request) or restarted the app (issue #61).
 *
 * A request WITHOUT a pos (a new connection, or one the server reset) asks the
 * server to build the whole initial response, which on a big account can take
 * longer than 40s before the first byte. Retrying it with the same limit would
 * be cut off every time, so only those raise the next allowance (doubling, up
 * to `maxMs`), and a success puts it back.
 *
 * Also makes the SDK's abort signal end the call at any point, including
 * during the body download, which the SDK's own fetch no longer listens to by
 * then. Without that a body stalled on a dead connection held the sync loop
 * until the socket timed out, minutes later, and neither resend() nor the
 * watchdog could free it.
 *
 * Returns the allowance the next request gets, so the stuck-sync watchdog can
 * stay out of the way of a request that is still within it. Call
 * resetSlidingSyncTimeout after the network changed (app resumed, back
 * online) so a raised allowance from the old connection doesn't stick.
 */
export function adaptSlidingSyncTimeout(
    client: MatrixClient,
    {
        maxMs = 5 * 60_000,
        onTimeout,
        onLostResponse,
    }: {
        maxMs?: number;
        /** An initial request timed out; the next one is allowed `nextTimeoutMs`. */
        onTimeout?: (nextTimeoutMs: number) => void;
        /** A long-poll's answer never arrived; the SDK retries it at once. */
        onLostResponse?: (waitedMs: number) => void;
    } = {},
): () => number {
    const existing = adapted.get(client);
    if (existing) return existing.allowance;
    type Request = { clientTimeout?: number; pos?: string };
    const send = client.slidingSync.bind(client) as (
        req: Request,
        proxyBaseUrl?: string,
        abortSignal?: AbortSignal,
    ) => Promise<unknown>;
    // 0 = use the SDK's own value; raised only after an initial request
    // timed out.
    let raisedMs = 0;
    let lastUsedMs = 0;

    (client as unknown as { slidingSync: typeof send }).slidingSync = async (
        req,
        proxyBaseUrl,
        abortSignal,
    ) => {
        // Read before sending: the SDK moves pos into the query string and
        // deletes it from the request.
        const isLongPoll = !!req.pos;
        const timeoutMs = isLongPoll
            ? (req.clientTimeout ?? 0)
            : Math.max(req.clientTimeout ?? 0, raisedMs);
        if (timeoutMs > 0) req.clientTimeout = timeoutMs;
        lastUsedMs = timeoutMs;
        const startedAt = Date.now();
        try {
            const res = await abortable(
                send(req, proxyBaseUrl, abortSignal),
                abortSignal,
            );
            raisedMs = 0;
            return res;
        } catch (err) {
            const httpStatus = (err as { httpStatus?: number } | null)
                ?.httpStatus;
            const timedOut =
                httpStatus === undefined &&
                !abortSignal?.aborted &&
                timeoutMs > 0 &&
                Date.now() - startedAt >= timeoutMs - 1000;
            if (timedOut) {
                if (isLongPoll) {
                    onLostResponse?.(Date.now() - startedAt);
                } else {
                    raisedMs = Math.min(timeoutMs * 2, maxMs);
                    onTimeout?.(raisedMs);
                }
            }
            throw err;
        }
    };
    const allowance = () => Math.max(raisedMs, lastUsedMs);
    const reset = () => {
        raisedMs = 0;
        lastUsedMs = 0;
    };
    adapted.set(client, { allowance, reset });
    return allowance;
}

/**
 * `request`, rejected with an AbortError as soon as `signal` aborts, whatever
 * stage the request is at. A request abandoned this way is left to settle on
 * its own; its result is ignored.
 */
function abortable<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return request;
    request.catch(() => {}); // abandoned on abort: never an unhandled rejection
    return new Promise<T>((resolve, reject) => {
        const onAbort = () =>
            reject(
                new DOMException("The operation was aborted.", "AbortError"),
            );
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
        request.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (err) => {
                signal.removeEventListener("abort", onAbort);
                reject(err);
            },
        );
    });
}

/**
 * Drop any raised allowance so the next request gets the SDK's own timeout
 * again. For when the network just changed (the app resumed, the browser is
 * back online) and the old timeouts say nothing about the new connection.
 * A request already in flight keeps the limit it was given. No-op for a
 * client that was never wrapped.
 */
export function resetSlidingSyncTimeout(client: MatrixClient): void {
    adapted.get(client)?.reset();
}

// Sync setup can run again for the same client; wrap its slidingSync once.
const adapted = new WeakMap<
    MatrixClient,
    { allowance: () => number; reset: () => void }
>();
