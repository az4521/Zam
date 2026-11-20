import { describe, it, expect } from "vitest";
import {
    centreOf,
    dockPlacement,
    leftViewport,
    pipSizeFor,
    restBounds,
} from "./pipGeometry";

describe("leftViewport", () => {
    it("is false anywhere inside the viewport", () => {
        expect(leftViewport(0, 0, 800, 600)).toBe(false);
        expect(leftViewport(799, 599, 800, 600)).toBe(false);
    });
    it("is true past any side", () => {
        expect(leftViewport(-1, 10, 800, 600)).toBe(true);
        expect(leftViewport(10, -1, 800, 600)).toBe(true);
        expect(leftViewport(800, 10, 800, 600)).toBe(true);
        expect(leftViewport(10, 600, 800, 600)).toBe(true);
    });
});

describe("centreOf", () => {
    it("finds the middle", () => {
        expect(centreOf({ x: 10, y: 20, width: 100, height: 50 })).toEqual({
            x: 60,
            y: 45,
        });
    });
});

describe("pipSizeFor", () => {
    it("is 18rem wide on desktop and 11rem on phones, 16:9", () => {
        expect(pipSizeFor(false, 16)).toEqual({ width: 288, height: 162 });
        expect(pipSizeFor(true, 16).width).toBe(176);
    });
});

describe("dockPlacement", () => {
    it("rests against the right side when dropped near it", () => {
        const p = dockPlacement(700, 300, 288, 162, 1000, 800, 16);
        expect(p.side).toBe("right");
    });
    it("keeps clear of the header and composer in the rest bounds", () => {
        const b = restBounds(1000, 800, 288, 162, 16);
        expect(b.minY).toBe(56);
        expect(b.maxY).toBe(800 - 162 - 88);
        expect(b.minX).toBe(16);
        expect(b.maxX).toBe(1000 - 288 - 16);
    });
});
