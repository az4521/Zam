import { describe, it, expect } from "vitest";
import { shouldMountActionBar, focusLeavesRow } from "./actionBarMount";

describe("shouldMountActionBar", () => {
    const idle = { hovered: false, focused: false, pinned: false };

    it("does not mount an idle row's bar", () => {
        expect(shouldMountActionBar(idle)).toBe(false);
    });
    it("mounts while the pointer is over the row", () => {
        expect(shouldMountActionBar({ ...idle, hovered: true })).toBe(true);
    });
    it("mounts while focus is inside the row (keyboard reach)", () => {
        expect(shouldMountActionBar({ ...idle, focused: true })).toBe(true);
    });
    it("mounts while something pins the bar open (picker, dialog, selection)", () => {
        expect(shouldMountActionBar({ ...idle, pinned: true })).toBe(true);
    });
});

describe("focusLeavesRow", () => {
    function row() {
        const r = document.createElement("div");
        const inner = document.createElement("button");
        r.appendChild(inner);
        const outside = document.createElement("button");
        document.body.append(r, outside);
        return { r, inner, outside };
    }

    it("is false when focus moves to an element inside the row", () => {
        const { r, inner } = row();
        expect(focusLeavesRow(r, inner)).toBe(false);
    });
    it("is false when focus moves to the row itself", () => {
        const { r } = row();
        expect(focusLeavesRow(r, r)).toBe(false);
    });
    it("is true when focus moves outside the row", () => {
        const { r, outside } = row();
        expect(focusLeavesRow(r, outside)).toBe(true);
    });
    it("is true when focus goes nowhere (window blur, body)", () => {
        const { r } = row();
        expect(focusLeavesRow(r, null)).toBe(true);
    });
});
