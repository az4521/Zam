// Per-room FIFO send queue for offline messages. Holds messages in the app layer
// (queued/sending/failed states) so they never reach the SDK while disconnected,
// which is what keeps a failed send from blocking the room's SDK send queue. Pure
// state machine — no SDK, no Svelte, no stores — so the correctness of FIFO order,
// single-flight per room, and deduplication can be unit-tested in isolation.

export type OutboxStatus = "queued" | "sending" | "failed";

export interface OutboxItem {
    readonly id: string;
    readonly roomId: string;
    readonly content: Readonly<Record<string, unknown>>;
    readonly status: OutboxStatus;
    readonly attempts: number;
    readonly error?: string;
    readonly seq: number;
}

export interface OutboxState {
    readonly items: readonly OutboxItem[];
}

// Frozen shared empty state so "no items" reads as a stable reference and a
// caller can't mutate it. Frozen in separate statements because freezing inline
// in the type assertion is a type error.
const frozenItems = Object.freeze([]) as OutboxItem[];
export const emptyOutbox: OutboxState = Object.freeze({
    items: frozenItems,
});

/**
 * Enqueue a new message. If an item with the same `id` already exists, return
 * state unchanged (dedupe — retry must never create a duplicate).
 */
export function enqueue(
    state: OutboxState,
    item: {
        id: string;
        roomId: string;
        content: Record<string, unknown>;
        seq: number;
    },
): OutboxState {
    // Dedupe: if id already exists, no-op
    if (state.items.some((i) => i.id === item.id)) {
        return state;
    }

    const newItem: OutboxItem = {
        id: item.id,
        roomId: item.roomId,
        content: item.content,
        status: "queued",
        attempts: 0,
        seq: item.seq,
    };

    return {
        items: [...state.items, newItem],
    };
}

/**
 * Mark an item as sending and increment its attempts counter. No-op if the id
 * is absent or already sending.
 */
export function markSending(state: OutboxState, id: string): OutboxState {
    const index = state.items.findIndex((i) => i.id === id);
    if (index === -1) return state;

    const item = state.items[index];
    // No-op if already sending
    if (item.status === "sending") return state;

    const newItem: OutboxItem = {
        ...item,
        status: "sending",
        attempts: item.attempts + 1,
    };

    return {
        items: [
            ...state.items.slice(0, index),
            newItem,
            ...state.items.slice(index + 1),
        ],
    };
}

/**
 * Mark an item as sent (delivered) by removing it from the outbox.
 */
export function markSent(state: OutboxState, id: string): OutboxState {
    return {
        items: state.items.filter((i) => i.id !== id),
    };
}

/**
 * Mark an item as failed, recording the error. Leaves attempts as-is.
 */
export function markFailed(
    state: OutboxState,
    id: string,
    error: string,
): OutboxState {
    const index = state.items.findIndex((i) => i.id === id);
    if (index === -1) return state;

    const item = state.items[index];
    const newItem: OutboxItem = {
        ...item,
        status: "failed",
        error,
    };

    return {
        items: [
            ...state.items.slice(0, index),
            newItem,
            ...state.items.slice(index + 1),
        ],
    };
}

/**
 * Move a failed or sending item back to queued state and clear its error.
 * No-op if the id is absent.
 */
export function requeue(state: OutboxState, id: string): OutboxState {
    const index = state.items.findIndex((i) => i.id === id);
    if (index === -1) return state;

    const item = state.items[index];
    const newItem: OutboxItem = {
        ...item,
        status: "queued",
        error: undefined,
    };

    return {
        items: [
            ...state.items.slice(0, index),
            newItem,
            ...state.items.slice(index + 1),
        ],
    };
}

/**
 * Remove an item from the outbox.
 */
export function removeItem(state: OutboxState, id: string): OutboxState {
    return {
        items: state.items.filter((i) => i.id !== id),
    };
}

/**
 * Get all items for a given room, in insertion (FIFO) order.
 */
export function itemsForRoom(state: OutboxState, roomId: string): OutboxItem[] {
    return state.items.filter((i) => i.roomId === roomId);
}

/**
 * Check if a room has any item in "sending" status.
 */
export function hasSending(state: OutboxState, roomId: string): boolean {
    return state.items.some(
        (i) => i.roomId === roomId && i.status === "sending",
    );
}

/**
 * Get the next sendable item for a room. Returns null if:
 * - The room has a "sending" item (single-flight ordering guarantee)
 * - No "queued" items exist for the room
 *
 * A "failed" item earlier in FIFO order does NOT block a later "queued" one.
 */
export function nextSendable(
    state: OutboxState,
    roomId: string,
): OutboxItem | null {
    // Single-flight: if something is sending, block all sends for this room
    if (hasSending(state, roomId)) {
        return null;
    }

    // Return the earliest queued item (FIFO)
    return (
        state.items.find((i) => i.roomId === roomId && i.status === "queued") ??
        null
    );
}

/**
 * Get a list of all room IDs that have at least one item in the outbox.
 */
export function roomsWithItems(state: OutboxState): string[] {
    const roomIds = new Set<string>();
    for (const item of state.items) {
        roomIds.add(item.roomId);
    }
    return Array.from(roomIds);
}
