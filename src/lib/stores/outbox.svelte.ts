// Per-room offline outbox store. Owns the reducer state (from utils/outbox),
// exposes per-room reads for the UI, and drives flushing.
//
// Flushing is IMPERATIVE and per-room single-flight. It runs only from event
// triggers — `onSyncReconnected`, the window `online` event, and manual retry —
// NEVER from a tracked `$effect` that reads outbox state. An effect that both
// reads and (via the flush) writes this state would retrigger itself
// (`effect_update_depth_exceeded`, a documented CLAUDE.md landmine). The only
// `$effect`-adjacent code is `initOutbox`, and it just wires listeners.
//
// `queueMessage` deliberately does NOT flush: we queue precisely because we are
// offline, so an immediate send would just fail and requeue. Delivery waits for
// a reconnect / online / manual-retry trigger.
//
// Session-scoped in-memory, like composerFileQueue — an account switch is a full
// page reload, so there is no cross-account keying or persistence.

import {
    emptyOutbox,
    enqueue,
    markSending,
    markSent,
    markFailed,
    requeue,
    removeItem,
    itemsForRoom,
    nextSendable,
    roomsWithItems,
    type OutboxItem,
    type OutboxState,
} from "$lib/utils/outbox";
import { classifySendError } from "$lib/utils/sendGating";
import { matrixErrorMessage } from "$lib/utils/knock";
import { sendOutboxMessage, onSyncReconnected } from "$lib/matrix/client";

/** Give up on an item after this many send attempts and mark it failed. */
export const OUTBOX_MAX_ATTEMPTS = 5;

// Whole-record reactivity: reassign `state.s` (never mutate the reducer state in
// place) and bump `state.tick` on every transition so a `$derived` re-runs even
// though the item objects are structurally similar. Callers pair a read with
// `void outboxTick()`.
const state = $state<{ s: OutboxState; tick: number }>({
    s: emptyOutbox,
    tick: 0,
});

// Monotonic counter → stable id + FIFO seq for each queued message.
let counter = 0;

// Single-flight guard: at most one in-flight `flushRoom` per room. Combined with
// `nextSendable` returning null while a room `hasSending`, this guarantees one
// send in flight per room and preserves FIFO order.
const flushing = new Set<string>();

/** Apply a reducer result and bump the reactivity tick. */
function commit(next: OutboxState): void {
    state.s = next;
    state.tick++;
}

/**
 * Enqueue a message for a room. Does NOT flush — flushing happens on the
 * reconnect/online triggers and on manual retry (see module header).
 */
export function queueMessage(
    roomId: string,
    content: Record<string, unknown>,
): void {
    const seq = ++counter;
    commit(enqueue(state.s, { id: `o${seq}`, roomId, content, seq }));
}

/** Reactive per-room read. Components pair this with `void outboxTick()`. */
export function getOutboxItems(roomId: string): OutboxItem[] {
    return itemsForRoom(state.s, roomId);
}

/** Reactivity counter — bumped on every outbox transition. */
export function outboxTick(): number {
    return state.tick;
}

/**
 * Flush a single room's queued items, one at a time, in FIFO order.
 * Single-flight: re-entrant calls for a room already flushing are ignored.
 */
async function flushRoom(roomId: string): Promise<void> {
    if (flushing.has(roomId)) return;
    flushing.add(roomId);
    try {
        for (;;) {
            const item = nextSendable(state.s, roomId);
            if (!item) break;

            // markSending increments attempts; `item` is the pre-send snapshot.
            commit(markSending(state.s, item.id));
            try {
                await sendOutboxMessage(roomId, {
                    ...item.content,
                });
                commit(markSent(state.s, item.id));
            } catch (err) {
                const attempts = item.attempts + 1; // post-markSending value
                const cls = classifySendError(err);
                if (cls === "retriable" && attempts < OUTBOX_MAX_ATTEMPTS) {
                    // The room is likely still down — requeue this item and stop.
                    // The next reconnect/online/retry trigger resumes it.
                    commit(requeue(state.s, item.id));
                    break;
                }
                // Terminal, or retriable at/over the attempt cap → mark failed
                // and CONTINUE so a failed item never blocks later queued ones.
                commit(
                    markFailed(
                        state.s,
                        item.id,
                        matrixErrorMessage(err, "Failed to send"),
                    ),
                );
            }
        }
    } finally {
        flushing.delete(roomId);
    }
}

/** Flush every room that has items. Fire-and-forget per room (single-flight). */
export function flushOutbox(): void {
    for (const roomId of roomsWithItems(state.s)) {
        void flushRoom(roomId);
    }
}

/** Requeue one failed item, then flush its room. */
export function retryOutboxItem(roomId: string, id: string): void {
    commit(requeue(state.s, id));
    void flushRoom(roomId);
}

/** Requeue every failed item in a room, then flush it. */
export function retryRoomOutbox(roomId: string): void {
    let next = state.s;
    for (const item of itemsForRoom(next, roomId)) {
        if (item.status === "failed") next = requeue(next, item.id);
    }
    commit(next);
    void flushRoom(roomId);
}

/** Drop an item from the outbox without sending it. */
export function removeOutboxItem(_roomId: string, id: string): void {
    commit(removeItem(state.s, id));
}

/**
 * Wire the flush triggers: a sync reconnect and the browser coming back online.
 * Returns a disposer that removes BOTH. Called once from the app shell (Task 6).
 * This is the only listener-wiring code and it performs no synchronous send.
 */
export function initOutbox(): () => void {
    const unsubReconnect = onSyncReconnected(flushOutbox);
    window.addEventListener("online", flushOutbox);
    return () => {
        unsubReconnect();
        window.removeEventListener("online", flushOutbox);
    };
}

/**
 * Reset the store to empty. For test isolation and logout — the module `$state`
 * otherwise persists across a session.
 */
export function resetOutbox(): void {
    state.s = emptyOutbox;
    state.tick = 0;
    counter = 0;
    flushing.clear();
}
