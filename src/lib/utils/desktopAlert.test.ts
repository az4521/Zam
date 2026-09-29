import { describe, expect, it } from "vitest";
import { normalizeDesktopAlertMode, shouldAlertDesktop } from "./desktopAlert";

describe("normalizeDesktopAlertMode", () => {
    it("keeps valid modes and defaults everything else to all", () => {
        expect(normalizeDesktopAlertMode("loud")).toBe("loud");
        expect(normalizeDesktopAlertMode("all")).toBe("all");
        expect(normalizeDesktopAlertMode("none")).toBe("none");
        expect(normalizeDesktopAlertMode(null)).toBe("all");
        expect(normalizeDesktopAlertMode("bogus")).toBe("all");
    });
});

describe("shouldAlertDesktop", () => {
    it("loud only alerts for loud notifications", () => {
        expect(shouldAlertDesktop("loud", true)).toBe(true);
        expect(shouldAlertDesktop("loud", false)).toBe(false);
    });
    it("all alerts for both", () => {
        expect(shouldAlertDesktop("all", true)).toBe(true);
        expect(shouldAlertDesktop("all", false)).toBe(true);
    });
    it("none never alerts", () => {
        expect(shouldAlertDesktop("none", true)).toBe(false);
        expect(shouldAlertDesktop("none", false)).toBe(false);
    });
});
