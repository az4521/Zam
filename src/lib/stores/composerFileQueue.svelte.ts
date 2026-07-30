// Per-room composer attachment queue, in-memory only.
//
// MessageInput stays mounted across room switches, so a component-local file
// queue survived a room change and Send posted the file to whichever room the
// user had landed on (audit UX-01). Keying the queue by room is the same shape
// composerDrafts already uses for text, for the same reason.
//
// Session-scoped by design: an account switch does a full page reload, so
// there's no cross-account keying, serialization, or stale-queue cleanup.
//
// The store owns object-URL revocation: every path that drops an item goes
// through here, so a preview URL can't be leaked by a caller that forgets.

export type QueuedFile = {
    /** Stable identity so a batch send can commit items one at a time. */
    id: string;
    file: File;
    name: string;
    /** Object URL for image previews, null otherwise. */
    previewUrl: string | null;
};

const queueState = $state<{ queues: Record<string, QueuedFile[]> }>({
    queues: {},
});

// Shared so "no queue" reads as a stable reference, and frozen so a caller
// can't mutate the store's notion of empty. Frozen in a separate statement
// because `Object.freeze([]) as QueuedFile[]` is a type error (readonly
// never[] doesn't overlap a mutable QueuedFile[]).
const EMPTY: QueuedFile[] = [];
Object.freeze(EMPTY);

let nextId = 0;

export function getFileQueue(roomId: string): QueuedFile[] {
    return queueState.queues[roomId] ?? EMPTY;
}

export function addQueuedFile(
    roomId: string,
    file: File,
    name: string,
    previewUrl: string | null,
): QueuedFile {
    const item: QueuedFile = { id: `q${++nextId}`, file, name, previewUrl };
    // Replace the record (not just the nested array) so a $derived that reads
    // getFileQueue re-runs even for a room that had no entry before.
    queueState.queues = {
        ...queueState.queues,
        [roomId]: [...(queueState.queues[roomId] ?? []), item],
    };
    return item;
}

export function removeQueuedFile(roomId: string, id: string): void {
    const queue = queueState.queues[roomId];
    if (!queue) return;
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    const next = queue.filter((q) => q.id !== id);
    const queues = { ...queueState.queues };
    if (next.length > 0) queues[roomId] = next;
    else delete queues[roomId];
    queueState.queues = queues;
}

export function clearFileQueue(roomId: string): void {
    const queue = queueState.queues[roomId];
    if (!queue) return;
    for (const item of queue) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    const queues = { ...queueState.queues };
    delete queues[roomId];
    queueState.queues = queues;
}
