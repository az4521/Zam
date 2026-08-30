import { describe, it, expect } from "vitest";
import { shouldOpenMessageMenu, menuModeFromSetting } from "./messageGesture";

describe("shouldOpenMessageMenu", () => {
    it("opens on tap in tap mode", () => {
        expect(shouldOpenMessageMenu("tap", "tap")).toBe(true);
    });
    it("does nothing on hold in tap mode", () => {
        expect(shouldOpenMessageMenu("tap", "hold")).toBe(false);
    });
    it("opens on hold in hold mode", () => {
        expect(shouldOpenMessageMenu("hold", "hold")).toBe(true);
    });
    it("does nothing on tap in hold mode", () => {
        expect(shouldOpenMessageMenu("hold", "tap")).toBe(false);
    });
    it("never opens on swipe — tap mode", () => {
        expect(shouldOpenMessageMenu("tap", "swipe")).toBe(false);
    });
    it("never opens on swipe — hold mode", () => {
        expect(shouldOpenMessageMenu("hold", "swipe")).toBe(false);
    });
});

describe("menuModeFromSetting", () => {
    it("maps false → tap (the default)", () => {
        expect(menuModeFromSetting(false)).toBe("tap");
    });
    it("maps true → hold", () => {
        expect(menuModeFromSetting(true)).toBe("hold");
    });
});
