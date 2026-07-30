import { describe, it, expect, vi } from "vitest";
import {
    OWNERSHIP_LOST_MESSAGE,
    captureOwnership,
    guardOwnership,
    nextGeneration,
    ownsRuntime,
} from "./clientGeneration";

/** Stand-in for a MatrixClient: the util only ever compares identity. */
const clientA = { id: "A" };
const clientB = { id: "B" };

describe("nextGeneration", () => {
    it("strictly increases", () => {
        expect(nextGeneration(0)).toBe(1);
        expect(nextGeneration(41)).toBe(42);
    });

    it("never returns the value it was given", () => {
        for (const n of [0, 1, 7, 1000]) {
            expect(nextGeneration(n)).not.toBe(n);
        }
    });
});

describe("captureOwnership", () => {
    it("snapshots the client and the generation", () => {
        const owner = captureOwnership(clientA, 3);
        expect(owner.client).toBe(clientA);
        expect(owner.generation).toBe(3);
    });

    it("captures the generation by value, so a later bump does not follow it", () => {
        let generation = 3;
        const owner = captureOwnership(clientA, generation);
        generation = nextGeneration(generation);
        expect(owner.generation).toBe(3);
    });
});

describe("ownsRuntime", () => {
    it("is true while the same client still holds the same generation", () => {
        const owner = captureOwnership(clientA, 5);
        expect(ownsRuntime(owner, clientA, 5)).toBe(true);
    });

    // Mutation guard: fails an implementation that only compares identity.
    it("is false when the generation moved on, even for the same client object", () => {
        const owner = captureOwnership(clientA, 5);
        expect(ownsRuntime(owner, clientA, 6)).toBe(false);
    });

    // Mutation guard: fails an implementation that only compares generation.
    it("is false when a different client holds the same generation number", () => {
        const owner = captureOwnership(clientA, 5);
        expect(ownsRuntime(owner, clientB, 5)).toBe(false);
    });

    it("is false after teardown left the slot empty", () => {
        const owner = captureOwnership(clientA, 5);
        expect(ownsRuntime(owner, null, 5)).toBe(false);
        expect(ownsRuntime(owner, undefined, 5)).toBe(false);
    });

    it("is false for a missing owner", () => {
        expect(ownsRuntime(null, clientA, 1)).toBe(false);
        expect(ownsRuntime(undefined, clientA, 1)).toBe(false);
    });
});

describe("guardOwnership", () => {
    it("runs the callback with its arguments while ownership holds", () => {
        const owner = captureOwnership(clientA, 1);
        const fn = vi.fn<(room: string, n: number) => void>();
        const guarded = guardOwnership(
            owner,
            () => ({ client: clientA, generation: 1 }),
            fn,
        );

        guarded("!room:example.org", 7);

        expect(fn).toHaveBeenCalledWith("!room:example.org", 7);
    });

    it("makes a stale-generation callback a no-op", () => {
        const owner = captureOwnership(clientA, 1);
        const fn = vi.fn();
        const guarded = guardOwnership(
            owner,
            () => ({ client: clientA, generation: 2 }),
            fn,
        );

        guarded();

        expect(fn).not.toHaveBeenCalled();
    });

    it("makes a callback from a replaced client a no-op", () => {
        const owner = captureOwnership(clientA, 1);
        const fn = vi.fn();
        const guarded = guardOwnership(
            owner,
            () => ({ client: clientB, generation: 2 }),
            fn,
        );

        guarded();

        expect(fn).not.toHaveBeenCalled();
    });

    it("makes a callback after teardown a no-op", () => {
        const owner = captureOwnership(clientA, 1);
        const fn = vi.fn();
        const guarded = guardOwnership(
            owner,
            () => ({ client: null, generation: 2 }),
            fn,
        );

        guarded();

        expect(fn).not.toHaveBeenCalled();
    });

    it("re-reads the live slot on every call, not once at wrap time", () => {
        const owner = captureOwnership(clientA, 1);
        const fn = vi.fn();
        let current: { client: typeof clientA | null; generation: number } = {
            client: clientA,
            generation: 1,
        };
        const guarded = guardOwnership(owner, () => current, fn);

        guarded();
        expect(fn).toHaveBeenCalledTimes(1);

        current = { client: clientB, generation: nextGeneration(1) };
        guarded();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe("OWNERSHIP_LOST_MESSAGE", () => {
    it("is a non-empty message an operation can reject with", () => {
        expect(OWNERSHIP_LOST_MESSAGE.length).toBeGreaterThan(0);
    });
});
