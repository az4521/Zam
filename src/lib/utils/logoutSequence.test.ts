import { describe, expect, it, vi } from "vitest";
import { runLogoutSequence } from "./logoutSequence";

describe("runLogoutSequence", () => {
    it("runs the local wipe even when the network invalidation never settles", async () => {
        const order: string[] = [];
        const outcome = await runLogoutSequence({
            invalidateSession: () => {
                order.push("invalidate");
                return new Promise<void>(() => {}); // never settles: a hung /logout
            },
            wipeLocalStores: async () => {
                order.push("wipe");
            },
        });
        expect(order).toEqual(["invalidate", "wipe"]);
        expect(outcome).toEqual({
            invalidationStarted: true,
            localWipeOk: true,
        });
    });

    it("starts the invalidation before the wipe, because it is what stops the client", async () => {
        const order: string[] = [];
        await runLogoutSequence({
            invalidateSession: async () => {
                order.push("invalidate");
            },
            wipeLocalStores: async () => {
                order.push("wipe");
            },
        });
        expect(order).toEqual(["invalidate", "wipe"]);
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

    it("reports a failed wipe instead of throwing", async () => {
        const outcome = await runLogoutSequence({
            invalidateSession: async () => {},
            wipeLocalStores: () => Promise.reject(new Error("blocked")),
        });
        expect(outcome).toEqual({
            invalidationStarted: true,
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
        expect(outcome).toEqual({
            invalidationStarted: true,
            localWipeOk: true,
        });
    });
});
