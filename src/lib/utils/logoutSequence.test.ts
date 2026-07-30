import { describe, expect, it, vi } from "vitest";
import { runLogoutSequence } from "./logoutSequence";

/** Let every queued microtask AND macrotask run, so "is it still pending?" is a
 *  question about the sequence itself rather than about scheduling luck. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Assert the sequence has not resolved yet. Racing an already-resolved sentinel
 *  is decisive after `flush()`: a sequence that had settled would win the race,
 *  because `Promise.race` subscribes to it first. */
async function expectStillPending(sequence: Promise<unknown>) {
    const pending = Symbol("pending");
    expect(await Promise.race([sequence, Promise.resolve(pending)])).toBe(
        pending,
    );
}

describe("runLogoutSequence", () => {
    it("runs the local wipe without waiting for the network, then keeps waiting for the network", async () => {
        const order: string[] = [];
        const sequence = runLogoutSequence({
            invalidateSession: () => {
                order.push("invalidate");
                return new Promise<void>(() => {}); // never settles: a hung /logout
            },
            wipeLocalStores: async () => {
                order.push("wipe");
            },
        });
        await flush();
        // The wipe ran to completion while the invalidation is still outstanding.
        expect(order).toEqual(["invalidate", "wipe"]);
        // And the sequence is still pending, so a caller that bounds the whole
        // thing (AppShell's 4s race) spends the rest of its window on the
        // invalidation instead of aborting it at the reload.
        await expectStillPending(sequence);
    });

    it("starts the invalidation before the wipe, because it is what stops the client", async () => {
        const order: string[] = [];
        const outcome = await runLogoutSequence({
            invalidateSession: async () => {
                order.push("invalidate");
            },
            wipeLocalStores: async () => {
                order.push("wipe");
            },
        });
        expect(order).toEqual(["invalidate", "wipe"]);
        expect(outcome).toEqual({
            invalidationStarted: true,
            invalidationOk: true,
            localWipeOk: true,
        });
    });

    it("wipes anyway when the invalidation rejects, and never rejects itself", async () => {
        const wipe = vi.fn().mockResolvedValue(undefined);
        const outcome = await runLogoutSequence({
            invalidateSession: () => Promise.reject(new Error("network down")),
            wipeLocalStores: wipe,
        });
        expect(wipe).toHaveBeenCalledTimes(1);
        expect(outcome.localWipeOk).toBe(true);
    });

    it("waits for a slow invalidation and reports invalidationOk false when it rejects", async () => {
        const order: string[] = [];
        let failInvalidation!: (reason: Error) => void;
        const sequence = runLogoutSequence({
            invalidateSession: () =>
                new Promise<void>((_resolve, reject) => {
                    failInvalidation = reject;
                }),
            wipeLocalStores: async () => {
                order.push("wipe");
            },
        });
        await flush();
        expect(order).toEqual(["wipe"]);
        await expectStillPending(sequence);
        failInvalidation(new Error("network down"));
        // Resolves once the invalidation settles, and reports the failure rather
        // than rejecting or claiming the token was invalidated.
        expect(await sequence).toEqual({
            invalidationStarted: true,
            invalidationOk: false,
            localWipeOk: true,
        });
    });

    it("handles an invalidation that fails DURING a slow wipe, without an unhandled rejection", async () => {
        // The handler has to be attached when the request is dispatched, not
        // after the wipe: a real IndexedDB delete spans many event-loop turns,
        // and a rejection landing in that gap with nothing attached is an
        // unhandled rejection (vitest fails the run on one, which is the point).
        let failInvalidation!: (reason: Error) => void;
        const outcome = await runLogoutSequence({
            invalidateSession: () =>
                new Promise<void>((_resolve, reject) => {
                    failInvalidation = reject;
                }),
            wipeLocalStores: () =>
                new Promise<void>((resolve) => {
                    setTimeout(
                        () => failInvalidation(new Error("network down")),
                        0,
                    );
                    setTimeout(resolve, 5);
                }),
        });
        expect(outcome).toEqual({
            invalidationStarted: true,
            invalidationOk: false,
            localWipeOk: true,
        });
    });

    it("reports a failed wipe instead of throwing, and still awaits the invalidation", async () => {
        const outcome = await runLogoutSequence({
            invalidateSession: async () => {},
            wipeLocalStores: () => Promise.reject(new Error("blocked")),
        });
        expect(outcome).toEqual({
            invalidationStarted: true,
            invalidationOk: true,
            localWipeOk: false,
        });
    });

    it("still wipes, and still reports the invalidation as started, when starting it throws synchronously", async () => {
        const wipe = vi.fn().mockResolvedValue(undefined);
        const outcome = await runLogoutSequence({
            invalidateSession: () => {
                throw new Error("no client");
            },
            wipeLocalStores: wipe,
        });
        expect(wipe).toHaveBeenCalledTimes(1);
        // Nothing is in flight after a synchronous throw, so there is nothing
        // left to wait for — and the token was never invalidated.
        expect(outcome).toEqual({
            invalidationStarted: true,
            invalidationOk: false,
            localWipeOk: true,
        });
    });
});
