import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSerialQueue } from "./serialQueue";

/** A promise a test can hold open, to keep a task in flight on purpose. */
function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
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

// ── Timeout: the queue must ALWAYS advance ────────────────────────────────
//
// A push-rule write that never settles (matrix-js-sdk attaches no abort signal
// because `localTimeoutMs` is unset anywhere in src/) used to block every later
// push-rule write for the rest of the session. The queue now stops WAITING for
// such a task — but it never stops the task, and never invents an outcome for
// its caller.
describe("createSerialQueue — timeoutMs", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("a task that never settles does not block the next", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
        const stuck = deferred<string>();
        const ran: string[] = [];

        const first = queue.run(async () => {
            ran.push("first-start");
            return stuck.promise;
        });
        const second = queue.run(async () => {
            ran.push("second");
            return "second-done";
        });

        await vi.advanceTimersByTimeAsync(999);
        expect(ran).toEqual(["first-start"]);

        await vi.advanceTimersByTimeAsync(1);
        await expect(second).resolves.toBe("second-done");
        expect(ran).toEqual(["first-start", "second"]);

        // The stuck caller is still waiting — nothing was fabricated for it.
        stuck.resolve("late");
        await expect(first).resolves.toBe("late");
    });

    it("the timed-out task's own caller still receives its real resolution", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
        const stuck = deferred<number>();
        const first = queue.run(() => stuck.promise);
        await vi.advanceTimersByTimeAsync(1000);
        stuck.resolve(42);
        await expect(first).resolves.toBe(42);
    });

    it("the timed-out task's own caller still receives its real rejection", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
        const stuck = deferred<number>();
        const first = queue.run(() => stuck.promise);
        // Attach the assertion before the rejection so it is never unhandled.
        const assertion = expect(first).rejects.toThrow("server said no");
        await vi.advanceTimersByTimeAsync(1000);
        stuck.reject(new Error("server said no"));
        await assertion;
    });

    it("ordering is unchanged when nothing times out", async () => {
        const queue = createSerialQueue({ timeoutMs: 10_000 });
        const order: string[] = [];
        const queueTask = (label: string, ms: number) =>
            queue.run(async () => {
                await new Promise((r) => setTimeout(r, ms));
                order.push(label);
            });
        const all = Promise.all([queueTask("slow", 30), queueTask("fast", 0)]);
        // 31, not 30: a fake timer created *during* an advance, at the exact
        // instant the advance ends, is left pending by the harness — "fast"
        // schedules its 0ms timer at t=30 — so a literal 30 deadlocks `all`.
        // Verified against a bare async chain with no queue involved.
        await vi.advanceTimersByTimeAsync(31);
        await all;
        expect(order).toEqual(["slow", "fast"]);
    });

    it("a settled task leaves no pending timer behind", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
        await queue.run(async () => "done");
        // Not cleaning up would leave one live 1000ms timer per push-rule write.
        expect(vi.getTimerCount()).toBe(0);
    });

    it("creates no timer at all when no timeout is configured", async () => {
        const queue = createSerialQueue();
        const stuck = deferred<void>();
        void queue.run(() => stuck.promise);
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(0);
        stuck.resolve();
    });

    it("reports a timeout exactly once, and never for a task that settles", async () => {
        const onTimeout = vi.fn();
        const queue = createSerialQueue({ timeoutMs: 1000, onTimeout });

        await queue.run(async () => "fast");
        await vi.advanceTimersByTimeAsync(5000);
        expect(onTimeout).not.toHaveBeenCalled();

        const stuck = deferred<void>();
        void queue.run(() => stuck.promise);
        await vi.advanceTimersByTimeAsync(1000);
        expect(onTimeout).toHaveBeenCalledTimes(1);

        // Settling late must not report a second time, nor disturb the queue.
        stuck.resolve();
        await vi.advanceTimersByTimeAsync(5000);
        expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it("keeps later tasks in call order after a timeout, even when the stuck task settles mid-flight", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
        const stuck = deferred<void>();
        const gate = deferred<void>();
        const order: string[] = [];

        const first = queue.run(() => stuck.promise);
        const second = queue.run(async () => {
            order.push("second-start");
            await gate.promise;
            order.push("second-end");
        });
        const third = queue.run(async () => {
            order.push("third");
        });

        await vi.advanceTimersByTimeAsync(1000);
        expect(order).toEqual(["second-start"]);

        // The abandoned task finishing must not let `third` overtake `second`.
        stuck.resolve();
        await vi.advanceTimersByTimeAsync(0);
        expect(order).toEqual(["second-start"]);

        gate.resolve();
        await Promise.all([first, second, third]);
        expect(order).toEqual(["second-start", "second-end", "third"]);
    });

    it("a rejecting task with a timeout set neither blocks nor fails the next one", async () => {
        const queue = createSerialQueue({ timeoutMs: 1000 });
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
        expect(vi.getTimerCount()).toBe(0);
    });
});
