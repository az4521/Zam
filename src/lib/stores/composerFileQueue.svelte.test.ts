import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    getFileQueue,
    addQueuedFile,
    removeQueuedFile,
    clearFileQueue,
} from "./composerFileQueue.svelte";

const A = "!a:server";
const B = "!b:server";

const revoke = vi.fn();

function makeFile(name = "photo.png"): File {
    return new File(["x"], name, { type: "image/png" });
}

// jsdom does not implement the object-URL API, and the module-level store
// persists across tests — install a spy and reset the ids we touch.
beforeEach(() => {
    URL.revokeObjectURL = revoke;
    revoke.mockClear();
    clearFileQueue(A);
    clearFileQueue(B);
    revoke.mockClear();
});

describe("composerFileQueue", () => {
    it("returns an empty queue for a room with nothing queued", () => {
        expect(getFileQueue(A)).toEqual([]);
    });

    it("appends files in the order they were added", () => {
        addQueuedFile(A, makeFile("one.png"), "one.png", null);
        addQueuedFile(A, makeFile("two.png"), "two.png", null);
        expect(getFileQueue(A).map((q) => q.name)).toEqual([
            "one.png",
            "two.png",
        ]);
    });

    it("returns the stored item, including a unique id", () => {
        const first = addQueuedFile(A, makeFile(), "one.png", "blob:one");
        const second = addQueuedFile(A, makeFile(), "two.png", "blob:two");
        expect(first.id).not.toBe(second.id);
        expect(first.previewUrl).toBe("blob:one");
        expect(getFileQueue(A)[0]).toEqual(first);
    });

    it("keeps each room's queue separate", () => {
        addQueuedFile(A, makeFile(), "for-a.png", null);
        expect(getFileQueue(B)).toEqual([]);
        addQueuedFile(B, makeFile(), "for-b.png", null);
        expect(getFileQueue(A).map((q) => q.name)).toEqual(["for-a.png"]);
        expect(getFileQueue(B).map((q) => q.name)).toEqual(["for-b.png"]);
    });

    it("replaces the queues record on every add so a derived read re-runs", () => {
        addQueuedFile(A, makeFile(), "one.png", null);
        const before = getFileQueue(A);
        addQueuedFile(A, makeFile(), "two.png", null);
        expect(getFileQueue(A)).not.toBe(before);
    });

    it("replaces the queues record on removal so a derived read re-runs", () => {
        const first = addQueuedFile(A, makeFile(), "one.png", null);
        addQueuedFile(A, makeFile(), "two.png", null);
        const before = getFileQueue(A);
        removeQueuedFile(A, first.id);
        expect(getFileQueue(A)).not.toBe(before);
    });

    it("replaces the queues record on clear so a derived read re-runs", () => {
        addQueuedFile(A, makeFile(), "one.png", null);
        const before = getFileQueue(A);
        clearFileQueue(A);
        expect(getFileQueue(A)).not.toBe(before);
    });

    it("removes a single item by id and leaves the rest", () => {
        const first = addQueuedFile(A, makeFile(), "one.png", null);
        addQueuedFile(A, makeFile(), "two.png", null);
        removeQueuedFile(A, first.id);
        expect(getFileQueue(A).map((q) => q.name)).toEqual(["two.png"]);
    });

    it("removes a middle item by id, not by position", () => {
        addQueuedFile(A, makeFile(), "one.png", "blob:one");
        const second = addQueuedFile(A, makeFile(), "two.png", "blob:two");
        addQueuedFile(A, makeFile(), "three.png", "blob:three");
        removeQueuedFile(A, second.id);
        expect(getFileQueue(A).map((q) => q.name)).toEqual([
            "one.png",
            "three.png",
        ]);
        expect(revoke).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith("blob:two");
    });

    it("revokes the removed item's object URL exactly once", () => {
        const item = addQueuedFile(A, makeFile(), "one.png", "blob:one");
        removeQueuedFile(A, item.id);
        expect(revoke).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith("blob:one");
    });

    it("does not revoke for an item with no preview URL", () => {
        const item = addQueuedFile(A, makeFile("doc.pdf"), "doc.pdf", null);
        removeQueuedFile(A, item.id);
        expect(revoke).not.toHaveBeenCalled();
    });

    it("ignores a remove for an unknown id without revoking anything", () => {
        addQueuedFile(A, makeFile(), "one.png", "blob:one");
        removeQueuedFile(A, "nope");
        expect(getFileQueue(A)).toHaveLength(1);
        expect(revoke).not.toHaveBeenCalled();
    });

    it("ignores a remove for a room with no queue", () => {
        expect(() => removeQueuedFile(B, "nope")).not.toThrow();
    });

    it("does not remove an id that belongs to another room", () => {
        const item = addQueuedFile(A, makeFile(), "one.png", "blob:one");
        addQueuedFile(B, makeFile(), "other.png", null);
        removeQueuedFile(B, item.id);
        expect(getFileQueue(A)).toHaveLength(1);
        expect(revoke).not.toHaveBeenCalled();
    });

    it("clears a room's queue and revokes every preview URL", () => {
        addQueuedFile(A, makeFile(), "one.png", "blob:one");
        addQueuedFile(A, makeFile(), "two.png", "blob:two");
        addQueuedFile(A, makeFile("doc.pdf"), "doc.pdf", null);
        clearFileQueue(A);
        expect(getFileQueue(A)).toEqual([]);
        expect(revoke).toHaveBeenCalledTimes(2);
        expect(revoke).toHaveBeenCalledWith("blob:one");
        expect(revoke).toHaveBeenCalledWith("blob:two");
    });

    it("clearing one room leaves another room's queue intact", () => {
        addQueuedFile(A, makeFile(), "one.png", null);
        addQueuedFile(B, makeFile(), "two.png", null);
        clearFileQueue(A);
        expect(getFileQueue(B)).toHaveLength(1);
    });

    it("emptying a room by removal leaves an empty queue, not a stale entry", () => {
        const item = addQueuedFile(A, makeFile(), "one.png", null);
        removeQueuedFile(A, item.id);
        expect(getFileQueue(A)).toEqual([]);
    });
});
