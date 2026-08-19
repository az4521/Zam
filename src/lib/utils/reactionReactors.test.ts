import { describe, it, expect } from "vitest";
import { orderReactors } from "./reactionReactors";

describe("orderReactors — self-first ordering, cap, overflow", () => {
    it("returns empty shown and zero overflow for no reactors", () => {
        expect(orderReactors([], "@me:hs")).toEqual({ shown: [], overflow: 0 });
    });

    it("moves the own user to the front when present", () => {
        expect(orderReactors(["@a:hs", "@me:hs", "@b:hs"], "@me:hs")).toEqual({
            shown: ["@me:hs", "@a:hs", "@b:hs"],
            overflow: 0,
        });
    });

    it("preserves order when the own user is absent", () => {
        expect(orderReactors(["@a:hs", "@b:hs"], "@me:hs")).toEqual({
            shown: ["@a:hs", "@b:hs"],
            overflow: 0,
        });
    });

    it("preserves order when ownUserId is null", () => {
        expect(orderReactors(["@a:hs", "@b:hs"], null)).toEqual({
            shown: ["@a:hs", "@b:hs"],
            overflow: 0,
        });
    });

    it("de-dupes repeated ids defensively", () => {
        expect(orderReactors(["@a:hs", "@a:hs", "@b:hs"], null)).toEqual({
            shown: ["@a:hs", "@b:hs"],
            overflow: 0,
        });
    });

    it("caps shown and reports overflow beyond the cap", () => {
        const ids = Array.from({ length: 23 }, (_, i) => `@u${i}:hs`);
        const out = orderReactors(ids, null, 20);
        expect(out.shown).toHaveLength(20);
        expect(out.shown[0]).toBe("@u0:hs");
        expect(out.overflow).toBe(3);
    });

    it("reports zero overflow at exactly the cap", () => {
        const ids = Array.from({ length: 20 }, (_, i) => `@u${i}:hs`);
        expect(orderReactors(ids, null, 20).overflow).toBe(0);
    });

    it("counts the self-moved user once toward the cap", () => {
        const ids = Array.from({ length: 21 }, (_, i) => `@u${i}:hs`);
        // own user is the last one; after self-first it is index 0 and still
        // within the 21 total → overflow 1, and it appears exactly once.
        const out = orderReactors(ids, "@u20:hs", 20);
        expect(out.shown[0]).toBe("@u20:hs");
        expect(out.shown).toHaveLength(20);
        expect(out.overflow).toBe(1);
        expect(out.shown.filter((id) => id === "@u20:hs")).toHaveLength(1);
    });
});
