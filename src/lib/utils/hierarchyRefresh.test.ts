import { describe, it, expect } from "vitest";
import {
    HIERARCHY_TTL_MS,
    HIERARCHY_FAILURE_BACKOFF_MS,
    hierarchyKey,
    shouldFetchHierarchy,
    hierarchyResultAction,
} from "./hierarchyRefresh";

const key = (over: Partial<Parameters<typeof hierarchyKey>[0]> = {}) =>
    hierarchyKey({
        spaceId: "!sp:s",
        parentSpaceId: null,
        drillDepth: 1,
        childSignature: "$a",
        parentSignature: "",
        joinedChildCount: 2,
        ...over,
    });

const decide = (
    over: Partial<Parameters<typeof shouldFetchHierarchy>[0]> = {},
) =>
    shouldFetchHierarchy({
        key: "k",
        inFlightKey: null,
        lastAppliedKey: "k",
        lastAppliedAt: 1000,
        lastFailedKey: null,
        lastFailedAt: null,
        failureBackoffMs: HIERARCHY_FAILURE_BACKOFF_MS,
        now: 1000,
        ttlMs: HIERARCHY_TTL_MS,
        force: false,
        ...over,
    });

describe("hierarchyKey", () => {
    it("changes when the local child state changes", () => {
        expect(key({ childSignature: "$a" })).not.toBe(
            key({ childSignature: "$a|$b" }),
        );
    });

    it("changes when the space itself changes", () => {
        // A space whose child state cannot be signed signs as "" — without the
        // space id in the key, two such spaces would share a key and a forced
        // open of one would coalesce onto the other's in-flight request.
        expect(key({ spaceId: "!a:s", childSignature: "" })).not.toBe(
            key({ spaceId: "!b:s", childSignature: "" }),
        );
    });

    it("changes when the drill target changes", () => {
        expect(key({ parentSpaceId: null })).not.toBe(
            key({ parentSpaceId: "!p:s" }),
        );
        expect(key({ drillDepth: 1 })).not.toBe(key({ drillDepth: 2 }));
    });

    it("changes when the drill parent's child state changes", () => {
        expect(key({ parentSignature: "" })).not.toBe(
            key({ parentSignature: "$p" }),
        );
    });

    it("changes when a child room is joined or left on another device", () => {
        // isJoined is baked into the response at fetch time and no m.space.child
        // event fires for a join, so the joined count is the only local signal.
        expect(key({ joinedChildCount: 2 })).not.toBe(
            key({ joinedChildCount: 3 }),
        );
    });

    it("is stable for identical inputs", () => {
        expect(key()).toBe(key());
    });

    it("keeps neighbouring fields distinct", () => {
        // Concatenating the fields without a separator would let two genuinely
        // different targets share a key — and a shared key is a refresh that
        // silently never happens.
        expect(key({ childSignature: "", parentSignature: "$p" })).not.toBe(
            key({ childSignature: "$p", parentSignature: "" }),
        );
    });
});

describe("the timing constants", () => {
    it("keeps the TTL a real floor, not master's two-second cadence", () => {
        // Every other test feeds the constant back in as ttlMs, so this is the
        // only thing pinning the value — and the value IS the fix.
        expect(HIERARCHY_TTL_MS).toBeGreaterThanOrEqual(60_000);
    });

    it("keeps the failure backoff longer than the sync cadence", () => {
        expect(HIERARCHY_FAILURE_BACKOFF_MS).toBeGreaterThanOrEqual(5_000);
    });
});

describe("shouldFetchHierarchy", () => {
    it("does not fetch when nothing changed and the TTL has not elapsed", () => {
        expect(decide()).toBe(false);
    });

    it("does not fetch a burst of syncs with an unchanged child list", () => {
        for (let i = 0; i < 50; i++) {
            expect(decide({ now: 1000 + i * 40 })).toBe(false);
        }
    });

    it("fetches when the key changed", () => {
        expect(decide({ lastAppliedKey: "other" })).toBe(true);
    });

    it("fetches when nothing has ever been applied", () => {
        expect(decide({ lastAppliedKey: null, lastAppliedAt: null })).toBe(
            true,
        );
    });

    it("fetches once the TTL has elapsed", () => {
        expect(decide({ now: 1000 + HIERARCHY_TTL_MS - 1 })).toBe(false);
        expect(decide({ now: 1000 + HIERARCHY_TTL_MS })).toBe(true);
    });

    it("fetches when forced even though the key and TTL say no", () => {
        expect(decide({ force: true })).toBe(true);
    });

    it("never starts a second fetch for the same key, even when forced", () => {
        expect(decide({ force: true, inFlightKey: "k" })).toBe(false);
        expect(decide({ lastAppliedKey: "other", inFlightKey: "k" })).toBe(
            false,
        );
    });

    it("does start a fetch when a DIFFERENT key is in flight", () => {
        expect(decide({ force: true, inFlightKey: "other" })).toBe(true);
    });

    it("does not retry a failed key before the backoff elapses", () => {
        // Without the backoff this would fetch — the key changed.
        expect(
            decide({
                lastAppliedKey: "other",
                lastFailedKey: "k",
                lastFailedAt: 1000,
                now: 1000 + HIERARCHY_FAILURE_BACKOFF_MS - 1,
            }),
        ).toBe(false);
    });

    it("retries a failed key once the backoff elapses", () => {
        expect(
            decide({
                lastAppliedKey: "other",
                lastFailedKey: "k",
                lastFailedAt: 1000,
                now: 1000 + HIERARCHY_FAILURE_BACKOFF_MS,
            }),
        ).toBe(true);
    });

    it("lets a forced open retry immediately despite the backoff", () => {
        expect(
            decide({
                force: true,
                lastFailedKey: "k",
                lastFailedAt: 1000,
                now: 1001,
            }),
        ).toBe(true);
    });

    it("does not hold back a different key after another key failed", () => {
        expect(
            decide({
                lastAppliedKey: "other",
                lastFailedKey: "a different key",
                lastFailedAt: 1000,
                now: 1001,
            }),
        ).toBe(true);
    });
});

describe("hierarchyResultAction", () => {
    const act = (
        over: Partial<Parameters<typeof hierarchyResultAction>[0]> = {},
    ) =>
        hierarchyResultAction({
            requestGeneration: 4,
            latestGeneration: 4,
            requestSpaceId: "!sp:s",
            activeSpaceId: "!sp:s",
            failed: false,
            ...over,
        });

    it("applies a fresh successful result", () => {
        expect(act()).toBe("apply");
    });

    it("drops a superseded result even for the same space", () => {
        expect(act({ requestGeneration: 3 })).toBe("drop");
    });

    it("drops a result for a space that is no longer active", () => {
        expect(act({ activeSpaceId: "!other:s" })).toBe("drop");
        expect(act({ activeSpaceId: null })).toBe("drop");
    });

    it("keeps the previous hierarchy when the fetch failed", () => {
        expect(act({ failed: true })).toBe("keep-previous");
    });

    it("drops a failed result that is also superseded", () => {
        expect(act({ failed: true, requestGeneration: 3 })).toBe("drop");
    });
});
