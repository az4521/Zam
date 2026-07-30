import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serialQueue";

/** A promise a test can hold open, to keep a task in flight on purpose. */
function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

/** Yield past the microtask queue AND one macrotask turn. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createSerialQueue", () => {
    it("runs tasks in call order even when a later task is faster", async () => {
        const queue = createSerialQueue();
        const order: string[] = [];
        const queueTask = (label: string, ms: number) =>
            queue.run(async () => {
                await new Promise((r) => setTimeout(r, ms));
                order.push(label);
            });
        // Queued slow-first: without serialization "fast" would finish first.
        await Promise.all([queueTask("slow", 30), queueTask("fast", 0)]);
        expect(order).toEqual(["slow", "fast"]);
    });

    it("never runs two tasks at the same time", async () => {
        const queue = createSerialQueue();
        let active = 0;
        let peak = 0;
        const task = async () => {
            active++;
            peak = Math.max(peak, active);
            await tick();
            active--;
        };
        await Promise.all([queue.run(task), queue.run(task), queue.run(task)]);
        expect(peak).toBe(1);
    });

    it("runs a task queued mid-flight only after the running one finishes", async () => {
        const queue = createSerialQueue();
        const gate = deferred<void>();
        const order: string[] = [];
        const first = queue.run(async () => {
            order.push("first-start");
            await gate.promise;
            order.push("first-end");
        });
        const second = queue.run(async () => {
            order.push("second");
        });
        await tick();
        expect(order).toEqual(["first-start"]);
        gate.resolve();
        await Promise.all([first, second]);
        expect(order).toEqual(["first-start", "first-end", "second"]);
    });

    it("gives each caller its own resolved value", async () => {
        const queue = createSerialQueue();
        const results = await Promise.all([
            queue.run(async () => 1),
            queue.run(async () => "two"),
            queue.run(async () => ({ three: true })),
        ]);
        expect(results).toEqual([1, "two", { three: true }]);
    });

    // The chain must SURVIVE a rejection without ADOPTING it: a failed push-rule
    // write must not make the next, unrelated write fail or be skipped.
    it("a rejecting task neither blocks nor fails the next one", async () => {
        const queue = createSerialQueue();
        const ran: string[] = [];
        const failing = queue.run(async () => {
            ran.push("first");
            throw new Error("boom");
        });
        const next = queue.run(async () => {
            ran.push("second");
            return "ok";
        });
        await expect(failing).rejects.toThrow("boom");
        await expect(next).resolves.toBe("ok");
        expect(ran).toEqual(["first", "second"]);
    });

    // …and the rejection must still REACH its own caller. `q = q.then(run, run)`
    // (the sw.js shape this deliberately avoids) swallows it instead.
    it("gives each caller its own rejection", async () => {
        const queue = createSerialQueue();
        const first = queue.run(async () => {
            throw new Error("first failed");
        });
        const second = queue.run(async () => {
            throw new Error("second failed");
        });
        const third = queue.run(async () => "fine");
        await expect(first).rejects.toThrow("first failed");
        await expect(second).rejects.toThrow("second failed");
        await expect(third).resolves.toBe("fine");
    });

    it("a task that throws synchronously rejects only its own caller", async () => {
        const queue = createSerialQueue();
        const boom = queue.run(() => {
            throw new Error("sync boom");
        });
        await expect(boom).rejects.toThrow("sync boom");
        await expect(queue.run(async () => "after")).resolves.toBe("after");
    });

    it("keeps running after the queue has drained", async () => {
        const queue = createSerialQueue();
        await expect(queue.run(async () => "one")).resolves.toBe("one");
        await expect(queue.run(async () => "two")).resolves.toBe("two");
    });
});
