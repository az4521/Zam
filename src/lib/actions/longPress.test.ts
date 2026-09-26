import { describe, it, expect, vi } from "vitest";
import { exceededMove, longPress } from "./longPress";

describe("exceededMove", () => {
    it("is false below tolerance", () => {
        expect(exceededMove(3, 4, 10)).toBe(false); // distance 5
    });

    it("is false at exactly the tolerance", () => {
        expect(exceededMove(6, 8, 10)).toBe(false); // distance 10, not > 10
    });

    it("is true past the tolerance", () => {
        expect(exceededMove(9, 12, 10)).toBe(true); // distance 15
    });

    it("handles negative deltas", () => {
        expect(exceededMove(-9, -12, 10)).toBe(true); // distance 15
    });
});

describe("longPress listeners", () => {
    it("registers touchstart and touchmove as passive (never blocks scroll)", () => {
        const node = document.createElement("div");
        const spy = vi.spyOn(node, "addEventListener");
        const handle = longPress(node, { onTrigger: () => {} });
        const opts = (type: string) =>
            spy.mock.calls.find(([t]) => t === type)?.[2];
        expect(opts("touchstart")).toEqual({ passive: true });
        expect(opts("touchmove")).toEqual({ passive: true });
        handle.destroy();
    });
});
