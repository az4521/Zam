import { describe, expect, it } from "vitest";
import { isDoubleTap, normalizeDoubleTapAction } from "./doubleTap";

describe("double-tap settings", () => {
    it("only permits edit for your own messages", () => {
        expect(normalizeDoubleTapAction("none", "reply", false)).toBe("none");
        expect(normalizeDoubleTapAction("edit", "reply", true)).toBe("edit");
        expect(normalizeDoubleTapAction("edit", "reply", false)).toBe("reply");
        expect(normalizeDoubleTapAction("unknown", "reaction", true)).toBe(
            "reaction",
        );
    });

    it("requires taps to be close in time and position", () => {
        const first = { at: 1000, x: 40, y: 50 };
        expect(isDoubleTap(first, { at: 1250, x: 48, y: 55 })).toBe(true);
        expect(isDoubleTap(first, { at: 1400, x: 48, y: 55 })).toBe(false);
        expect(isDoubleTap(first, { at: 1250, x: 100, y: 55 })).toBe(false);
    });
});
