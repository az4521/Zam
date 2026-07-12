import { describe, expect, it } from "vitest";
import { applyTheme, normalizeTheme } from "./theme";

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
