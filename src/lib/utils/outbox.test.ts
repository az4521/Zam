import { describe, it, expect } from "vitest";
import {
    emptyOutbox,
    enqueue,
    markSending,
    markSent,
    markFailed,
    requeue,
    removeItem,
    itemsForRoom,
    hasSending,
    nextSendable,
    roomsWithItems,
    type OutboxState,
} from "./outbox";

const c = (body: string) => ({ msgtype: "m.text", body });

function seed(): OutboxState {
    let s = emptyOutbox;
    s = enqueue(s, { id: "a", roomId: "!r1", content: c("1"), seq: 1 });
    s = enqueue(s, { id: "b", roomId: "!r1", content: c("2"), seq: 2 });
    s = enqueue(s, { id: "c", roomId: "!r2", content: c("3"), seq: 3 });
    return s;
}

describe("outbox reducer", () => {
    it("enqueues as queued with attempts 0, FIFO per room", () => {
        const s = seed();
        expect(itemsForRoom(s, "!r1").map((i) => i.id)).toEqual(["a", "b"]);
        expect(itemsForRoom(s, "!r2").map((i) => i.id)).toEqual(["c"]);
        expect(s.items[0]).toMatchObject({ status: "queued", attempts: 0 });
    });

    it("dedupes a repeated id (retry never duplicates)", () => {
        let s = seed();
        s = enqueue(s, { id: "a", roomId: "!r1", content: c("dup"), seq: 9 });
        expect(itemsForRoom(s, "!r1").map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("does not mutate the input state", () => {
        const s = seed();
        const before = s.items;
        markSending(s, "a");
        expect(s.items).toBe(before);
    });

    it("markSending sets sending + increments attempts", () => {
        const s = markSending(seed(), "a");
        expect(s.items.find((i) => i.id === "a")).toMatchObject({
            status: "sending",
            attempts: 1,
        });
    });

    it("markSent removes the item", () => {
        let s = markSending(seed(), "a");
        s = markSent(s, "a");
        expect(s.items.find((i) => i.id === "a")).toBeUndefined();
        expect(itemsForRoom(s, "!r1").map((i) => i.id)).toEqual(["b"]);
    });

    it("markFailed records status+error, keeps attempts", () => {
        let s = markSending(seed(), "a");
        s = markFailed(s, "a", "boom");
        expect(s.items.find((i) => i.id === "a")).toMatchObject({
            status: "failed",
            attempts: 1,
            error: "boom",
        });
    });

    it("requeue moves failed OR sending back to queued and clears error", () => {
        let s = markFailed(markSending(seed(), "a"), "a", "boom");
        s = requeue(s, "a");
        const it = s.items.find((i) => i.id === "a")!;
        expect(it.status).toBe("queued");
        expect(it.error).toBeUndefined();
    });

    it("hasSending / single-flight: nextSendable is null while a room has a sending item", () => {
        const s = markSending(seed(), "a");
        expect(hasSending(s, "!r1")).toBe(true);
        expect(nextSendable(s, "!r1")).toBeNull();
        // other rooms are independent
        expect(nextSendable(s, "!r2")?.id).toBe("c");
    });

    it("nextSendable returns the earliest queued item", () => {
        expect(nextSendable(seed(), "!r1")?.id).toBe("a");
    });

    it("a failed item does NOT block a later queued item", () => {
        let s = seed();
        s = markFailed(markSending(s, "a"), "a", "boom"); // 'a' failed
        // no sending in room now → next queued is 'b'
        expect(hasSending(s, "!r1")).toBe(false);
        expect(nextSendable(s, "!r1")?.id).toBe("b");
    });

    it("removeItem drops it; roomsWithItems lists rooms with any item", () => {
        let s = removeItem(seed(), "c");
        expect(itemsForRoom(s, "!r2")).toEqual([]);
        expect(roomsWithItems(s).sort()).toEqual(["!r1"]);
    });

    it("emptyOutbox is frozen and stable", () => {
        expect(() =>
            (emptyOutbox as { items: unknown[] }).items.push(1),
        ).toThrow();
    });
});
