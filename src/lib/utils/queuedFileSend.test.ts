import { describe, it, expect, vi } from "vitest";
import { sendQueuedFiles } from "./queuedFileSend";

/** A promise plus the function that resolves it. */
function deferred() {
    let resolve!: () => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Let every pending microtask chain run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("sendQueuedFiles", () => {
    it("resolves without calling anything for an empty batch", async () => {
        const send = vi.fn(async () => {});
        const onSent = vi.fn();
        await sendQueuedFiles([], send, onSent);
        expect(send).not.toHaveBeenCalled();
        expect(onSent).not.toHaveBeenCalled();
    });

    it("sends every item and commits each one in order", async () => {
        const order: string[] = [];
        await sendQueuedFiles(
            ["a", "b", "c"],
            async (item, _i, ready) => {
                await ready();
                order.push(`send:${item}`);
            },
            (item) => {
                order.push(`sent:${item}`);
            },
        );
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
        const committed: [string, number][] = [];
        await sendQueuedFiles(
            ["a", "b"],
            async (_item, i) => {
                seen.push(i);
            },
            (item, i) => {
                committed.push([item, i]);
            },
        );
        expect(seen).toEqual([0, 1]);
        // The consumer's commit callback keys off this index (only item 0
        // carries the caption), so an off-by-one here clears the wrong thing.
        expect(committed).toEqual([
            ["a", 0],
            ["b", 1],
        ]);
    });

    it("starts uploads in parallel, up to the concurrency limit", async () => {
        const gates = ["a", "b", "c", "d"].map(() => deferred());
        const started: string[] = [];
        const promise = sendQueuedFiles(
            ["a", "b", "c", "d"],
            (item, i) => {
                started.push(item);
                return gates[i].promise;
            },
            () => {},
            3,
        );
        await flush();
        expect(started).toEqual(["a", "b", "c"]);
        gates[0].resolve();
        await flush();
        expect(started).toEqual(["a", "b", "c", "d"]);
        gates.forEach((g) => g.resolve());
        await promise;
    });

    it("posts in queue order even when a later upload finishes first", async () => {
        const uploads = ["a", "b"].map(() => deferred());
        const posted: string[] = [];
        const promise = sendQueuedFiles(
            ["a", "b"],
            async (item, i, ready) => {
                await uploads[i].promise;
                await ready();
                posted.push(item);
            },
            () => {},
        );
        uploads[1].resolve();
        await flush();
        expect(posted).toEqual([]);
        uploads[0].resolve();
        await promise;
        expect(posted).toEqual(["a", "b"]);
    });

    it("gates a later item on the earlier item's commit", async () => {
        const events: string[] = [];
        await sendQueuedFiles(
            ["a", "b"],
            async (item, _i, ready) => {
                await ready();
                events.push(`post:${item}`);
            },
            (item) => events.push(`commit:${item}`),
        );
        // The caption on item 0 is cleared in its commit, before item 1 posts.
        expect(events).toEqual(["post:a", "commit:a", "post:b", "commit:b"]);
    });

    it("commits an item only after that item's send has resolved", async () => {
        const gate = deferred();
        const onSent = vi.fn();
        const promise = sendQueuedFiles(["a"], () => gate.promise, onSent);
        await flush();
        expect(onSent).not.toHaveBeenCalled();
        gate.resolve();
        await promise;
        expect(onSent).toHaveBeenCalledWith("a", 0);
    });

    it("keeps sending after a failure, commits every success, and rethrows", async () => {
        const boom = new Error("upload failed");
        const committed: string[] = [];
        await expect(
            sendQueuedFiles(
                ["a", "b", "c"],
                async (item, _i, ready) => {
                    if (item === "b") throw boom;
                    await ready();
                },
                (item) => committed.push(item),
            ),
        ).rejects.toBe(boom);
        expect(committed).toEqual(["a", "c"]);
    });

    it("posts a later item whose upload finished despite an earlier failure", async () => {
        // Holding it back would leave its upload orphaned on the server.
        const posted: string[] = [];
        const uploads = ["a", "b"].map(() => deferred());
        const promise = sendQueuedFiles(
            ["a", "b"],
            async (item, i, ready) => {
                await uploads[i].promise;
                await ready();
                posted.push(item);
            },
            () => {},
        );
        uploads[1].resolve();
        uploads[0].reject(new Error("first"));
        await expect(promise).rejects.toThrow("first");
        expect(posted).toEqual(["b"]);
    });

    it("holds a later post until an earlier failing item has settled", async () => {
        const uploads = ["a", "b"].map(() => deferred());
        const posted: string[] = [];
        const promise = sendQueuedFiles(
            ["a", "b"],
            async (item, i, ready) => {
                await uploads[i].promise;
                await ready();
                posted.push(item);
            },
            () => {},
        );
        uploads[1].resolve();
        await flush();
        expect(posted).toEqual([]);
        uploads[0].reject(new Error("first"));
        await expect(promise).rejects.toThrow("first");
        expect(posted).toEqual(["b"]);
    });

    it("reports the earliest failure in queue order", async () => {
        const uploads = ["a", "b"].map(() => deferred());
        const promise = sendQueuedFiles(
            ["a", "b"],
            async (_item, i, ready) => {
                await uploads[i].promise;
                await ready();
            },
            () => {},
        );
        uploads[1].reject(new Error("second"));
        await flush();
        uploads[0].reject(new Error("first"));
        await expect(promise).rejects.toThrow("first");
    });

    it("still starts every upload after a failure", async () => {
        const send = vi.fn(async (item: string) => {
            if (item === "a") throw new Error("nope");
        });
        const committed: string[] = [];
        await expect(
            sendQueuedFiles(
                ["a", "b", "c", "d"],
                send,
                (item) => committed.push(item),
                1,
            ),
        ).rejects.toThrow("nope");
        expect(send).toHaveBeenCalledTimes(4);
        expect(committed).toEqual(["b", "c", "d"]);
    });

    it("still commits in order when send skips the ready gate", async () => {
        const uploads = ["a", "b"].map(() => deferred());
        const committed: string[] = [];
        const promise = sendQueuedFiles(
            ["a", "b"],
            (_item, i) => uploads[i].promise,
            (item) => committed.push(item),
        );
        uploads[1].resolve();
        await flush();
        expect(committed).toEqual([]);
        uploads[0].resolve();
        await promise;
        expect(committed).toEqual(["a", "b"]);
    });

    it("propagates a throw from the commit callback", async () => {
        await expect(
            sendQueuedFiles(
                ["a", "b"],
                async () => {},
                () => {
                    throw new Error("commit blew up");
                },
            ),
        ).rejects.toThrow("commit blew up");
    });
});
