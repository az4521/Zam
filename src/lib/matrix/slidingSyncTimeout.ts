import type { MatrixClient } from "matrix-js-sdk";

/**
 * Let sliding-sync requests outlast a slow connection.
 *
 * SlidingSync gives every request a hard local timeout of its long-poll
 * timeout + 10s (40s here), covering the whole download, and retries the
 * identical request with the same limit after a failure. A catch-up response
 * that takes longer than that to arrive (a resumed app on a weak mobile link,
 * a big room list) is cut off every time, so sync sits on "Reconnecting"
 * forever. This wraps client.slidingSync so each timed-out request doubles the
 * next one's allowance (up to `maxMs`), and a success puts it back.
 *
 * Returns the allowance the next request gets, so the stuck-sync watchdog can
 * stay out of the way of a request that is still within it.
 */
export function adaptSlidingSyncTimeout(
    client: MatrixClient,
    {
        maxMs = 5 * 60_000,
        onTimeout,
    }: { maxMs?: number; onTimeout?: (nextTimeoutMs: number) => void } = {},
): () => number {
    const existing = adapted.get(client);
    if (existing) return existing;
    type Request = { clientTimeout?: number };
    const send = client.slidingSync.bind(client) as (
        req: Request,
        proxyBaseUrl?: string,
        abortSignal?: AbortSignal,
    ) => Promise<unknown>;
    // 0 = use the SDK's own value; raised only after a request times out.
    let raisedMs = 0;
    let lastUsedMs = 0;

    (client as unknown as { slidingSync: typeof send }).slidingSync = async (
        req,
        proxyBaseUrl,
        abortSignal,
    ) => {
        const timeoutMs = Math.max(req.clientTimeout ?? 0, raisedMs);
        if (timeoutMs > 0) req.clientTimeout = timeoutMs;
        lastUsedMs = timeoutMs;
        const startedAt = Date.now();
        try {
            const res = await send(req, proxyBaseUrl, abortSignal);
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
                raisedMs = Math.min(timeoutMs * 2, maxMs);
                onTimeout?.(raisedMs);
            }
            throw err;
        }
    };
    const allowance = () => Math.max(raisedMs, lastUsedMs);
    adapted.set(client, allowance);
    return allowance;
}

// Sync setup can run again for the same client; wrap its slidingSync once.
const adapted = new WeakMap<MatrixClient, () => number>();
