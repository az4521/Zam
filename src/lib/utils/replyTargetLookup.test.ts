import { describe, it, expect } from "vitest";
import { shouldRescanReplyTarget } from "./replyTargetLookup";

const EV = { marker: "an opaque MatrixEvent" };

describe("shouldRescanReplyTarget", () => {
    it("rescans when nothing is cached", () => {
        expect(shouldRescanReplyTarget(null, "$a")).toBe(true);
    });

    it("rescans when the cached lookup was for a different event", () => {
        expect(shouldRescanReplyTarget({ id: "$a", target: EV }, "$b")).toBe(
            true,
        );
    });

    it("rescans while the target is still unresolved", () => {
        // The parent may still be backfilling in — a miss must keep looking.
        expect(shouldRescanReplyTarget({ id: "$a", target: null }, "$a")).toBe(
            true,
        );
    });

    it("skips the scan once the target is resolved", () => {
        expect(shouldRescanReplyTarget({ id: "$a", target: EV }, "$a")).toBe(
            false,
        );
    });

    it("does not rescan when there is no reply at all", () => {
        expect(shouldRescanReplyTarget(null, undefined)).toBe(false);
        expect(
            shouldRescanReplyTarget({ id: "$a", target: EV }, undefined),
        ).toBe(false);
    });
});
