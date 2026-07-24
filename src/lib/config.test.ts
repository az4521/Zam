import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { isInstalledApp } from "./config";

describe("isInstalledApp", () => {
    beforeEach(() => {
        vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
        Object.defineProperty(window, "desktop", {
            configurable: true,
            value: undefined,
        });
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            value: vi.fn().mockReturnValue({ matches: false }),
        });
        Object.defineProperty(navigator, "standalone", {
            configurable: true,
            value: undefined,
        });
        Object.defineProperty(navigator, "userAgent", {
            configurable: true,
            value: "Mozilla/5.0",
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not classify a regular website as installed", () => {
        expect(isInstalledApp()).toBe(false);
    });

    it("detects a Capacitor native app", () => {
        vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
        expect(isInstalledApp()).toBe(true);
    });

    it("detects Electron through its preload bridge", () => {
        Object.defineProperty(window, "desktop", {
            configurable: true,
            value: {},
        });
        expect(isInstalledApp()).toBe(true);
    });

    it("detects an installed PWA display mode", () => {
        vi.mocked(window.matchMedia).mockReturnValue({
            matches: true,
        } as MediaQueryList);
        expect(isInstalledApp()).toBe(true);
    });

    it("detects the iOS installed-PWA flag", () => {
        Object.defineProperty(navigator, "standalone", {
            configurable: true,
            value: true,
        });
        expect(isInstalledApp()).toBe(true);
    });
});
