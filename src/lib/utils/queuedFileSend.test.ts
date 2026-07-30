import { describe, it, expect, vi } from "vitest";
import { sendQueuedFilesInOrder } from "./queuedFileSend";

describe("sendQueuedFilesInOrder", () => {
    it("resolves without calling anything for an empty batch", async () => {
        const send = vi.fn(async () => {});
        const onSent = vi.fn();
        await sendQueuedFilesInOrder([], send, onSent);
        expect(send).not.toHaveBeenCalled();
        expect(onSent).not.toHaveBeenCalled();
    });

    it("sends every item in order and commits each one", async () => {
        const order: string[] = [];
        const send = vi.fn(async (item: string) => {
            order.push(`send:${item}`);
        });
        const onSent = vi.fn((item: string) => {
            order.push(`sent:${item}`);
        });
        await sendQueuedFilesInOrder(["a", "b", "c"], send, onSent);
        expect(order).toEqual([
            "send:a",
            "sent:a",
            "send:b",
            "sent:b",
            "send:c",
            "sent:c",
        ]);
    });

    it("passes the index alongside the item", async () => {
        const seen: number[] = [];
        await sendQueuedFilesInOrder(
            ["a", "b"],
            async (_item, i) => {
                seen.push(i);
            },
            () => {},
        );
        expect(seen).toEqual([0, 1]);
    });

    it("commits the items that succeeded before a failure and rethrows", async () => {
        const boom = new Error("upload failed");
        const send = vi.fn(async (item: string) => {
            if (item === "b") throw boom;
        });
        const committed: string[] = [];
        await expect(
            sendQueuedFilesInOrder(["a", "b", "c"], send, (item) =>
                committed.push(item),
            ),
        ).rejects.toBe(boom);
        expect(committed).toEqual(["a"]);
    });

    it("does not send anything after the first failure", async () => {
        const send = vi.fn(async (item: string) => {
            if (item === "b") throw new Error("nope");
        });
        await expect(
            sendQueuedFilesInOrder(["a", "b", "c"], send, () => {}),
        ).rejects.toThrow("nope");
        expect(send).toHaveBeenCalledTimes(2);
    });

    it("commits nothing when the very first item fails", async () => {
        const onSent = vi.fn();
        await expect(
            sendQueuedFilesInOrder(
                ["a", "b"],
                async () => {
                    throw new Error("first");
                },
                onSent,
            ),
        ).rejects.toThrow("first");
        expect(onSent).not.toHaveBeenCalled();
    });

    it("waits for each send to settle before starting the next", async () => {
        let releaseFirst: (() => void) | null = null;
        const started: string[] = [];
        const promise = sendQueuedFilesInOrder(
            ["a", "b"],
            (item) => {
                started.push(item);
                if (item === "a") {
                    return new Promise<void>((resolve) => {
                        releaseFirst = resolve;
                    });
                }
                return Promise.resolve();
            },
            () => {},
        );
        await Promise.resolve();
        expect(started).toEqual(["a"]);
        releaseFirst!();
        await promise;
        expect(started).toEqual(["a", "b"]);
    });

    it("propagates a throw from the commit callback without sending further items", async () => {
        const send = vi.fn(async () => {});
        await expect(
            sendQueuedFilesInOrder(["a", "b"], send, () => {
                throw new Error("commit blew up");
            }),
        ).rejects.toThrow("commit blew up");
        expect(send).toHaveBeenCalledTimes(1);
    });
});
