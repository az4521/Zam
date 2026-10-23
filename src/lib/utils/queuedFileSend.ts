/**
 * Parallel-upload, ordered-post batch send for the composer's attachment
 * queue.
 *
 * The composer used to remove every queued file only after the *whole* batch
 * succeeded, so a batch that failed halfway left the already-sent files queued
 * and a retry duplicated them (audit MEDIA-03). This runner hands each item
 * back the instant its send resolves, so the caller can drop it from the queue.
 *
 * Uploads run up to `concurrency` at a time, but each item's event goes out
 * only once every earlier item has settled: `send` gets a `ready` gate to
 * await between its upload and its event send, so the timeline matches the
 * queue and the caption/reply riding on item 0 lands first. A failed item does
 * NOT stop the rest: halting there would strand later items whose uploads had
 * already finished as orphaned media on the server. Every item is attempted,
 * the successes are committed, and the first failure (in queue order) is
 * rethrown once the batch is done, so the caller restores only what failed.
 *
 * Pure: no Svelte, no SDK. `send` and `onSent` carry all the effects.
 */
export async function sendQueuedFiles<T>(
    items: readonly T[],
    send: (
        item: T,
        index: number,
        /** Resolves once every earlier item has settled. Never rejects. */
        ready: () => Promise<void>,
    ) => Promise<void>,
    onSent: (item: T, index: number) => void,
    concurrency = 3,
): Promise<void> {
    // settled[i] resolves once item i has posted and committed, or failed.
    const settled: Promise<void>[] = [];
    const errors: { index: number; error: unknown }[] = [];
    let next = 0;

    const run = (i: number): Promise<void> => {
        const ready = () => (i === 0 ? Promise.resolve() : settled[i - 1]);
        const p = (async () => {
            try {
                await send(items[i], i, ready);
                // Also gate the commit, in case `send` resolved without
                // awaiting `ready`: commits must still happen in order.
                await ready();
                onSent(items[i], i);
            } catch (error) {
                // Still wait our turn, so a later item can't settle (and post)
                // before an earlier one that is still uploading.
                await ready();
                errors.push({ index: i, error });
            }
        })();
        settled[i] = p;
        return p;
    };

    // Slots are handed out in index order, so the earliest unsettled item
    // always holds one: a later item waiting on `ready` can't starve it.
    const worker = async () => {
        while (next < items.length) await run(next++);
    };
    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, worker),
    );

    if (errors.length > 0) {
        errors.sort((a, b) => a.index - b.index);
        throw errors[0].error;
    }
}
