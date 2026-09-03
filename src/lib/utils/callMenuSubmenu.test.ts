import { describe, it, expect } from "vitest";
import { toggleSubmenu, activeDeviceLabel } from "./callMenuSubmenu";

describe("toggleSubmenu (accordion)", () => {
    it("opens a section from closed", () => {
        expect(toggleSubmenu(null, "input")).toBe("input");
        expect(toggleSubmenu(null, "output")).toBe("output");
    });
    it("collapses when re-selecting the open section", () => {
        expect(toggleSubmenu("input", "input")).toBe(null);
        expect(toggleSubmenu("output", "output")).toBe(null);
    });
    it("switches (collapsing the other) when selecting the closed section", () => {
        expect(toggleSubmenu("input", "output")).toBe("output");
        expect(toggleSubmenu("output", "input")).toBe("input");
    });
});

describe("activeDeviceLabel", () => {
    const devices = [
        { id: "a", label: "Mic A" },
        { id: "b", label: "Mic B" },
    ];
    it("returns Default when nothing is selected", () => {
        expect(activeDeviceLabel(devices, null)).toBe("Default");
        expect(activeDeviceLabel([], null)).toBe("Default");
    });
    it("returns the matching device label when selected", () => {
        expect(activeDeviceLabel(devices, "a")).toBe("Mic A");
        expect(activeDeviceLabel(devices, "b")).toBe("Mic B");
    });
    it("falls back to Default when the saved id is no longer present", () => {
        // A vanished device resolves to the default (mirrors resolveDeviceId).
        expect(activeDeviceLabel(devices, "gone")).toBe("Default");
        expect(activeDeviceLabel([], "a")).toBe("Default");
    });
});
