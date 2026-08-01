/**
 * Ordered, commit-as-you-go batch send for the composer's attachment queue.
 *
 * The composer used to remove every queued file only after the *whole* batch
 * succeeded, so a batch that failed halfway left the already-sent files queued
 * and a retry duplicated them (audit MEDIA-03). This runner hands each item
 * back the instant its send resolves, so the caller can drop it from the queue
 * before the next upload even starts.
 *
 * Pure: no Svelte, no SDK. `send` and `onSent` carry all the effects.
 */
export async function sendQueuedFilesInOrder<T>(
    items: readonly T[],
    send: (item: T, index: number) => Promise<void>,
    onSent: (item: T, index: number) => void,
): Promise<void> {
    for (let i = 0; i < items.length; i++) {
        await send(items[i], i);
        onSent(items[i], i);
    }
}
