import { describe, expect, it, afterEach } from "vitest";
import {
    applyTheme,
    normalizeTheme,
    applyThemeColors,
    applyPreset,
} from "./theme";

describe("theme", () => {
    it("accepts light and defaults every other value to dark", () => {
        expect(normalizeTheme("light")).toBe("light");
        expect(normalizeTheme("dark")).toBe("dark");
        expect(normalizeTheme("system")).toBe("dark");
        expect(normalizeTheme(null)).toBe("dark");
    });

    it("accepts amoled as a valid theme", () => {
        expect(normalizeTheme("amoled")).toBe("amoled");
    });

    it("updates the root theme and browser theme color", () => {
        document.head.innerHTML = '<meta name="theme-color" content="#000">';
        applyTheme("light");
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.content,
        ).toBe("#f2f3f5");
    });

    it("applies amoled theme with correct theme-color", () => {
        document.head.innerHTML = '<meta name="theme-color" content="#fff">';
        applyTheme("amoled");
        expect(document.documentElement.dataset.theme).toBe("amoled");
        expect(
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.content,
        ).toBe("#000000");
    });

    it("applies dark theme with correct theme-color", () => {
        document.head.innerHTML = '<meta name="theme-color" content="#fff">';
        applyTheme("dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.content,
        ).toBe("#313338");
    });
});

afterEach(() => applyThemeColors(null));

describe("applyThemeColors", () => {
    it("sets inline custom properties for a preset", () => {
        applyThemeColors({ background: "#010203", mention: "#0a0b0c" });
        const s = document.documentElement.style;
        expect(s.getPropertyValue("--discord-bg").trim()).toBe("#010203");
        expect(s.getPropertyValue("--discord-bg-rgb").trim()).toBe("1 2 3");
        expect(
            s.getPropertyValue("--discord-mention-highlight-rgb").trim(),
        ).toBe("10 11 12");
    });
    it("clears all managed vars when passed null", () => {
        applyThemeColors({ background: "#010203" });
        applyThemeColors(null);
        expect(
            document.documentElement.style.getPropertyValue("--discord-bg"),
        ).toBe("");
    });
    it("removes a stale override when switching presets", () => {
        applyThemeColors({ background: "#010203" });
        applyThemeColors({ accent: "#040506" });
        const s = document.documentElement.style;
        expect(s.getPropertyValue("--discord-bg")).toBe("");
        expect(s.getPropertyValue("--discord-accent").trim()).toBe("#040506");
    });
});

describe("applyPreset", () => {
    it("applies base theme and color overrides", () => {
        document.head.innerHTML = '<meta name="theme-color" content="#fff">';
        applyPreset("amoled", { accent: "#123456" });
        expect(document.documentElement.dataset.theme).toBe("amoled");
        expect(
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.content,
        ).toBe("#000000");
        expect(
            document.documentElement.style
                .getPropertyValue("--discord-accent")
                .trim(),
        ).toBe("#123456");
    });

    it("applies base theme and clears overrides when colors is null", () => {
        document.head.innerHTML = '<meta name="theme-color" content="#fff">';
        // First apply some colors
        applyThemeColors({ background: "#010203" });
        // Then apply preset with null colors
        applyPreset("light", null);
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(
            document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
                ?.content,
        ).toBe("#f2f3f5");
        expect(
            document.documentElement.style.getPropertyValue("--discord-bg"),
        ).toBe("");
    });
});
