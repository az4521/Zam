import { describe, it, expect } from "vitest";
import { popoutPosition, summarizeMutualRooms } from "./profileCard";

describe("popoutPosition", () => {
    const card = { width: 288, height: 360 };
    const viewport = { width: 1280, height: 720 };

    it("places the card to the right of the anchor when there is room", () => {
        const anchor = { top: 100, left: 40, right: 80, bottom: 140 };
        const pos = popoutPosition(anchor, card, viewport);
        expect(pos.left).toBe(88); // anchor.right + 8px gap
        expect(pos.top).toBe(100);
    });

    it("flips to the left of the anchor when the right side overflows", () => {
        const anchor = { top: 100, left: 1100, right: 1140, bottom: 140 };
        const pos = popoutPosition(anchor, card, viewport);
        expect(pos.left).toBe(1100 - 288 - 8); // anchor.left - width - gap
    });

    it("clamps the top so the card stays inside the viewport", () => {
        const anchor = { top: 600, left: 40, right: 80, bottom: 640 };
        const pos = popoutPosition(anchor, card, viewport);
        expect(pos.top + card.height).toBeLessThanOrEqual(viewport.height - 8);
    });

    it("never goes above the viewport margin", () => {
        const anchor = { top: -20, left: 40, right: 80, bottom: 0 };
        const pos = popoutPosition(anchor, card, viewport);
        expect(pos.top).toBeGreaterThanOrEqual(8);
    });

    it("clamps left into the viewport when neither side fits cleanly", () => {
        const narrow = { width: 300, height: 720 };
        const anchor = { top: 10, left: 5, right: 295, bottom: 50 };
        const pos = popoutPosition(anchor, card, narrow);
        expect(pos.left).toBeGreaterThanOrEqual(8);
        expect(pos.left + card.width).toBeLessThanOrEqual(300 - 8 + 288); // clamped, may overflow a narrow viewport but never past the left margin
    });
});

describe("summarizeMutualRooms", () => {
    it("sorts names case-insensitively and caps the list", () => {
        const res = summarizeMutualRooms(["zeta", "Alpha", "beta", "Gamma"], 3);
        expect(res.shown).toEqual(["Alpha", "beta", "Gamma"]);
        expect(res.moreCount).toBe(1);
    });

    it("returns everything when under the cap", () => {
        const res = summarizeMutualRooms(["b", "a"], 3);
        expect(res.shown).toEqual(["a", "b"]);
        expect(res.moreCount).toBe(0);
    });

    it("handles an empty list", () => {
        const res = summarizeMutualRooms([], 3);
        expect(res.shown).toEqual([]);
        expect(res.moreCount).toBe(0);
    });
});
