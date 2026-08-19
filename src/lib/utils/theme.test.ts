import { describe, expect, it, afterEach } from "vitest";
import { applyTheme, normalizeTheme, applyThemeColors } from "./theme";

describe("theme", () => {
    it("accepts light and defaults every other value to dark", () => {
        expect(normalizeTheme("light")).toBe("light");
        expect(normalizeTheme("dark")).toBe("dark");
        expect(normalizeTheme("system")).toBe("dark");
        expect(normalizeTheme(null)).toBe("dark");
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
