import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK boundary. `sendOutboxMessage` is a spy the tests drive (resolve,
// reject with an {httpStatus} error, or a controlled deferred). `onSyncReconnected`
// is captured so the init/dispose test can assert wiring; the flush tests call
// `flushOutbox()` directly instead of firing a fake reconnect.
const h = vi.hoisted(() => ({
    sendOutboxMessage:
        vi.fn<
            (
                roomId: string,
                content: Record<string, unknown>,
            ) => Promise<string>
        >(),
    onSyncReconnected: vi.fn((_cb: () => void) => () => {}),
}));

vi.mock("$lib/matrix/client", () => ({
    sendOutboxMessage: h.sendOutboxMessage,
    onSyncReconnected: h.onSyncReconnected,
}));

import {
    queueMessage,
    getOutboxItems,
    outboxTick,
    flushOutbox,
    retryOutboxItem,
    retryRoomOutbox,
    removeOutboxItem,
    initOutbox,
    resetOutbox,
    OUTBOX_MAX_ATTEMPTS,
} from "./outbox.svelte";

const ROOM = "!room1:server";

/** A promise whose settlement the test controls — used for ordering/single-flight. */
function deferred<T = unknown>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks wipes calls, not implementations — restore the defaults.
    h.sendOutboxMessage.mockResolvedValue("$ev");
    h.onSyncReconnected.mockImplementation((_cb: () => void) => () => {});
    resetOutbox();
});

describe("outbox store", () => {
    // 1
    it("queueMessage adds a queued item visible via getOutboxItems", () => {
        const before = outboxTick();
        queueMessage(ROOM, { body: "hi" });

        const items = getOutboxItems(ROOM);
        expect(items).toHaveLength(1);
        expect(items[0].status).toBe("queued");
        expect(items[0].attempts).toBe(0);
        expect(items[0].content).toEqual({ body: "hi" });
        // A transition bumped the tick so a $derived re-runs.
        expect(outboxTick()).toBeGreaterThan(before);
        // queueMessage must NOT auto-flush (we're offline when queueing).
        expect(h.sendOutboxMessage).not.toHaveBeenCalled();
    });

    // 2
    it("flushOutbox sends queued items in FIFO order and removes them on success", async () => {
        const order: string[] = [];
        h.sendOutboxMessage.mockImplementation(async (_r, c) => {
            order.push(c.body as string);
            return "$ev";
        });

        queueMessage(ROOM, { body: "first" });
        queueMessage(ROOM, { body: "second" });
        queueMessage(ROOM, { body: "third" });

        flushOutbox();

        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)).toHaveLength(0);
        });
        expect(order).toEqual(["first", "second", "third"]);
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(3);
    });

    // 3
    it("a retriable (502) failure returns the item to queued and stops that room's flush", async () => {
        h.sendOutboxMessage.mockRejectedValue({ httpStatus: 502 });

        queueMessage(ROOM, { body: "a" });
        queueMessage(ROOM, { body: "b" });

        flushOutbox();

        // Wait for the first send to fail and the item to be requeued.
        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)[0].status).toBe("queued");
            expect(h.sendOutboxMessage).toHaveBeenCalled();
        });
        // Let any (erroneous) continuation attempt a second send.
        await new Promise((r) => setTimeout(r, 20));

        const items = getOutboxItems(ROOM);
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.status === "queued")).toBe(true);
        // A retriable failure breaks the room's flush — exactly one send fired.
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(1);
    });

    // 4
    it("a terminal (403) failure marks the item failed but a later queued item still sends", async () => {
        h.sendOutboxMessage
            .mockRejectedValueOnce({ httpStatus: 403 })
            .mockResolvedValue("$ev");

        queueMessage(ROOM, { body: "bad" });
        queueMessage(ROOM, { body: "good" });

        flushOutbox();

        await vi.waitFor(() => {
            const items = getOutboxItems(ROOM);
            expect(items).toHaveLength(1);
            expect(items[0].status).toBe("failed");
        });

        const items = getOutboxItems(ROOM);
        expect(items[0].content).toEqual({ body: "bad" });
        expect(items[0].error).toBeTruthy();
        // Both the failed one and the later one were attempted — no room block.
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(2);
    });

    // 5
    it("reaching OUTBOX_MAX_ATTEMPTS retriable failures marks the item failed (no infinite loop)", async () => {
        h.sendOutboxMessage.mockRejectedValue({ httpStatus: 502 });

        queueMessage(ROOM, { body: "x" });

        // Each flush does exactly one send then requeues (break on retriable);
        // drive it MAX-1 times to walk attempts up while it stays queued.
        for (let i = 0; i < OUTBOX_MAX_ATTEMPTS - 1; i++) {
            flushOutbox();
            await vi.waitFor(() => {
                const it = getOutboxItems(ROOM)[0];
                expect(it.attempts).toBe(i + 1);
                expect(it.status).toBe("queued");
            });
        }

        // The final attempt reaches the cap → failed, not requeued.
        flushOutbox();
        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)[0].status).toBe("failed");
        });

        const item = getOutboxItems(ROOM)[0];
        expect(item.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(OUTBOX_MAX_ATTEMPTS);
    });

    // 6
    it("retryOutboxItem requeues a failed item and sends it once the send succeeds", async () => {
        h.sendOutboxMessage.mockRejectedValueOnce({ httpStatus: 403 });

        queueMessage(ROOM, { body: "retry-me" });
        flushOutbox();
        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)[0].status).toBe("failed");
        });
        const failedId = getOutboxItems(ROOM)[0].id;

        // Now the send works.
        h.sendOutboxMessage.mockResolvedValue("$ev");
        retryOutboxItem(ROOM, failedId);

        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)).toHaveLength(0);
        });
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(2);
    });

    // 7
    it("concurrent flushOutbox calls do not double-send (single-flight per room)", async () => {
        const d = deferred<string>();
        h.sendOutboxMessage.mockReturnValue(d.promise);

        queueMessage(ROOM, { body: "one" });
        queueMessage(ROOM, { body: "two" });

        flushOutbox();
        flushOutbox(); // second call must not start a parallel send

        // The first send is dispatched synchronously; let microtasks settle.
        await Promise.resolve();
        await Promise.resolve();
        expect(h.sendOutboxMessage).toHaveBeenCalledTimes(1);
        expect(getOutboxItems(ROOM)[0].status).toBe("sending");

        // Resolve the in-flight send → the single flusher advances to item two.
        d.resolve("$ev1");
        await vi.waitFor(() => {
            expect(h.sendOutboxMessage).toHaveBeenCalledTimes(2);
        });
        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)).toHaveLength(0);
        });
    });

    // Bonus: retryRoomOutbox requeues every failed item in the room and flushes.
    it("retryRoomOutbox requeues all failed items and flushes them", async () => {
        h.sendOutboxMessage
            .mockRejectedValueOnce({ httpStatus: 403 })
            .mockRejectedValueOnce({ httpStatus: 403 })
            .mockResolvedValue("$ev");

        queueMessage(ROOM, { body: "f1" });
        queueMessage(ROOM, { body: "f2" });
        flushOutbox();
        await vi.waitFor(() => {
            const items = getOutboxItems(ROOM);
            expect(items).toHaveLength(2);
            expect(items.every((i) => i.status === "failed")).toBe(true);
        });

        h.sendOutboxMessage.mockResolvedValue("$ev");
        retryRoomOutbox(ROOM);
        await vi.waitFor(() => {
            expect(getOutboxItems(ROOM)).toHaveLength(0);
        });
    });

    // Bonus: removeOutboxItem drops an item without sending.
    it("removeOutboxItem drops an item", () => {
        queueMessage(ROOM, { body: "gone" });
        const id = getOutboxItems(ROOM)[0].id;
        removeOutboxItem(ROOM, id);
        expect(getOutboxItems(ROOM)).toHaveLength(0);
    });

    // Bonus: per-room isolation — a stuck room does not block a different room.
    it("flushOutbox flushes independent rooms without cross-blocking", async () => {
        const roomA = "!a:server";
        const roomB = "!b:server";
        h.sendOutboxMessage.mockImplementation(async (roomId) => {
            if (roomId === roomA) throw { httpStatus: 502 };
            return "$ev";
        });

        queueMessage(roomA, { body: "stuck" });
        queueMessage(roomB, { body: "fine" });

        flushOutbox();

        await vi.waitFor(() => {
            expect(getOutboxItems(roomB)).toHaveLength(0); // B delivered
        });
        expect(getOutboxItems(roomA)).toHaveLength(1);
        expect(getOutboxItems(roomA)[0].status).toBe("queued"); // A requeued
    });

    // Bonus: initOutbox wiring + disposer (rubric #7 — no listener leaks).
    it("initOutbox wires reconnect + online triggers and the disposer removes both", () => {
        const unsub = vi.fn();
        h.onSyncReconnected.mockReturnValue(unsub);
        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");

        const dispose = initOutbox();
        expect(h.onSyncReconnected).toHaveBeenCalledWith(flushOutbox);
        expect(addSpy).toHaveBeenCalledWith("online", flushOutbox);

        dispose();
        expect(unsub).toHaveBeenCalledTimes(1);
        expect(removeSpy).toHaveBeenCalledWith("online", flushOutbox);

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
