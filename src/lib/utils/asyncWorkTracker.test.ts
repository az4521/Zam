import { describe, it, expect, vi } from "vitest";
import { createAsyncWorkTracker } from "./asyncWorkTracker";

function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("createAsyncWorkTracker", () => {
    function makeClass() {
        class Engine {
            pending: ReturnType<typeof deferred>[] = [];
            work() {
                const d = deferred();
                this.pending.push(d);
                return d.promise;
            }
            sync() {
                return 42;
            }
            boom() {
                throw new Error("closed");
            }
            get id() {
                return "dev";
            }
            close() {
                return Promise.resolve();
            }
        }
        return Engine;
    }

    it("counts promises from wrapped methods until they settle", async () => {
        const Engine = makeClass();
        const t = createAsyncWorkTracker();
        t.track(Engine.prototype);
        const a = new Engine();
        const b = new Engine();
        const p1 = a.work();
        const p2 = b.work();
        expect(t.inFlight()).toBe(2);
        a.pending[0].resolve();
        await p1;
        await Promise.resolve();
        expect(t.inFlight()).toBe(1);
        b.pending[0].reject(new Error("x"));
        await p2.catch(() => {});
        await Promise.resolve();
        expect(t.inFlight()).toBe(0);
    });

    it("leaves sync results, throws, getters and skipped methods alone", () => {
        const Engine = makeClass();
        const t = createAsyncWorkTracker();
        t.track(Engine.prototype, ["close"]);
        const e = new Engine();
        expect(e.sync()).toBe(42);
        expect(() => e.boom()).toThrow("closed");
        expect(e.id).toBe("dev");
        void e.close();
        expect(t.inFlight()).toBe(0);
    });

    it("wraps a prototype once however often it is tracked", () => {
        const Engine = makeClass();
        const t = createAsyncWorkTracker();
        t.track(Engine.prototype);
        t.track(Engine.prototype);
        void new Engine().work();
        expect(t.inFlight()).toBe(1);
    });

    it("waits for idle, or gives up after the timeout", async () => {
        vi.useFakeTimers();
        try {
            const Engine = makeClass();
            const t = createAsyncWorkTracker();
            t.track(Engine.prototype);
            expect(await t.waitForIdle(1000)).toBe(true);

            const e = new Engine();
            void e.work();
            const timedOut = t.waitForIdle(1000);
            await vi.advanceTimersByTimeAsync(1000);
            expect(await timedOut).toBe(false);

            const idle = t.waitForIdle(1000);
            e.pending[0].resolve();
            await vi.advanceTimersByTimeAsync(0);
            expect(await idle).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
