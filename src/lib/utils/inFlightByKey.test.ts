import { describe, it, expect } from "vitest";
import { createInFlightByKey } from "./inFlightByKey";

const A = "@alice:example.org";
const B = "@bob:example.org";

/** A promise settled by hand, so two calls can genuinely overlap. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    // Nobody may be attached when we reject in a test; keep node quiet.
    promise.catch(() => {});
    return { promise, resolve, reject };
}

describe("createInFlightByKey", () => {
    it("joins a second call for the same key to the first", async () => {
        const inFlight = createInFlightByKey<string>();
        const d = deferred<string>();
        let starts = 0;
        const start = () => {
            starts++;
            return d.promise;
        };

        const first = inFlight.run(A, start);
        const second = inFlight.run(A, start);

        expect(starts).toBe(1);
        d.resolve("!room:example.org");
        expect(await first).toBe("!room:example.org");
        expect(await second).toBe("!room:example.org");
    });

    it("runs different keys independently", async () => {
        const inFlight = createInFlightByKey<string>();
        const first = deferred<string>();
        const second = deferred<string>();

        const a = inFlight.run(A, () => first.promise);
        const b = inFlight.run(B, () => second.promise);

        expect(inFlight.size()).toBe(2);
        first.resolve("!a:example.org");
        second.resolve("!b:example.org");
        expect(await a).toBe("!a:example.org");
        expect(await b).toBe("!b:example.org");
    });

    it("releases the key once the call resolves", async () => {
        const inFlight = createInFlightByKey<string>();
        const d = deferred<string>();

        const running = inFlight.run(A, () => d.promise);
        expect(inFlight.size()).toBe(1);

        d.resolve("!room:example.org");
        await running;

        expect(inFlight.size()).toBe(0);
    });

    // A failed call must not poison the key: leaving the rejected promise in
    // the map would hand the same failure to every later caller for the rest
    // of the session.
    it("releases the key once the call rejects", async () => {
        const inFlight = createInFlightByKey<string>();
        const d = deferred<string>();

        const running = inFlight.run(A, () => d.promise);
        d.reject(new Error("boom"));
        await expect(running).rejects.toThrow("boom");

        expect(inFlight.size()).toBe(0);
    });

    it("starts a fresh call for a key that already settled", async () => {
        const inFlight = createInFlightByKey<string>();
        let starts = 0;
        const start = () => {
            starts++;
            return Promise.resolve(`!room-${starts}:example.org`);
        };

        expect(await inFlight.run(A, start)).toBe("!room-1:example.org");
        expect(await inFlight.run(A, start)).toBe("!room-2:example.org");
        expect(starts).toBe(2);
    });

    it("starts a fresh call after a failed one", async () => {
        const inFlight = createInFlightByKey<string>();
        const failing = deferred<string>();
        const first = inFlight.run(A, () => failing.promise);
        failing.reject(new Error("boom"));
        await expect(first).rejects.toThrow("boom");

        await expect(
            inFlight.run(A, () => Promise.resolve("!room:example.org")),
        ).resolves.toBe("!room:example.org");
    });

    it("gives every joiner the same failure", async () => {
        const inFlight = createInFlightByKey<string>();
        const d = deferred<string>();
        const start = () => d.promise;

        const first = inFlight.run(A, start);
        const second = inFlight.run(A, start);

        d.reject(new Error("boom"));
        await expect(first).rejects.toThrow("boom");
        await expect(second).rejects.toThrow("boom");
    });
});
