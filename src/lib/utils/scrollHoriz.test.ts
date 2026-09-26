import { describe, it, expect } from "vitest";
import { targetCanScrollHoriz } from "./scrollHoriz";

describe("targetCanScrollHoriz", () => {
    it("returns true when target can scroll right (dx < 0) and is not at max scroll", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 100,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, -10)).toBe(true);
    });

    it("returns true when target can scroll left (dx > 0) and is not at start", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 100,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, 10)).toBe(true);
    });

    it("returns false when target is at max scroll and dx < 0", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 300,
            configurable: true,
        }); // at max
        expect(targetCanScrollHoriz(el, -10)).toBe(false);
    });

    it("returns false when target is at scroll start and dx > 0", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 0,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, 10)).toBe(false);
    });

    it("returns false when scrollWidth <= clientWidth (not scrollable)", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 0,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, -10)).toBe(false);
        expect(targetCanScrollHoriz(el, 10)).toBe(false);
    });

    it("returns false when overflow-x is not auto or scroll", () => {
        const el = document.createElement("div");
        el.style.overflowX = "visible";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 100,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, -10)).toBe(false);
    });

    it("checks ancestors when target itself is not scrollable", () => {
        const parent = document.createElement("div");
        parent.style.overflowX = "auto";
        Object.defineProperty(parent, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(parent, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(parent, "scrollLeft", {
            value: 100,
            configurable: true,
        });

        const child = document.createElement("div");
        parent.appendChild(child);

        expect(targetCanScrollHoriz(child, -10)).toBe(true);
    });

    it("returns false when el is null", () => {
        expect(targetCanScrollHoriz(null, -10)).toBe(false);
        expect(targetCanScrollHoriz(null, 10)).toBe(false);
    });

    it("stops traversal at document.body", () => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        // body itself is not scrollable in this test
        expect(targetCanScrollHoriz(el, -10)).toBe(false);
        el.remove();
    });

    it("respects overflow-x: scroll as well as auto", () => {
        const el = document.createElement("div");
        el.style.overflowX = "scroll";
        Object.defineProperty(el, "scrollWidth", {
            value: 500,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 100,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, -10)).toBe(true);
    });

    it("requires scrollWidth to exceed clientWidth by more than 1px", () => {
        const el = document.createElement("div");
        el.style.overflowX = "auto";
        Object.defineProperty(el, "scrollWidth", {
            value: 201,
            configurable: true,
        });
        Object.defineProperty(el, "clientWidth", {
            value: 200,
            configurable: true,
        });
        Object.defineProperty(el, "scrollLeft", {
            value: 0,
            configurable: true,
        });
        // scrollWidth - clientWidth = 1, should be false (needs > 1)
        expect(targetCanScrollHoriz(el, -10)).toBe(false);

        // Make it 202, now it should work
        Object.defineProperty(el, "scrollWidth", {
            value: 202,
            configurable: true,
        });
        expect(targetCanScrollHoriz(el, -10)).toBe(true);
    });
});
