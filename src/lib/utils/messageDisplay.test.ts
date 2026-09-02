import { describe, it, expect } from "vitest";
import {
    resolveMessageFontSize,
    resolveMessageFont,
    messageFontFamily,
    MESSAGE_FONTS,
    MSG_FONT_SIZE_DEFAULT,
    appTextScalePercent,
    appTextScaleCss,
    applyAppTextScale,
    applyMessageFont,
    CUSTOM_FONT_FAMILY,
} from "./messageDisplay";

describe("resolveMessageFontSize", () => {
    it("defaults when unset/garbage", () => {
        expect(resolveMessageFontSize(null)).toBe(16);
        expect(resolveMessageFontSize(undefined)).toBe(16);
        expect(resolveMessageFontSize("")).toBe(16);
        expect(resolveMessageFontSize("   ")).toBe(16);
        expect(resolveMessageFontSize("abc")).toBe(16);
        expect(resolveMessageFontSize(NaN)).toBe(16);
        expect(resolveMessageFontSize(Infinity)).toBe(16);
    });
    it("parses stored strings and numbers", () => {
        expect(resolveMessageFontSize("16")).toBe(16);
        expect(resolveMessageFontSize(18)).toBe(18);
    });
    it("rounds floats to int", () => {
        expect(resolveMessageFontSize("15.6")).toBe(16);
        expect(resolveMessageFontSize(13.2)).toBe(13);
    });
    it("clamps out of range", () => {
        expect(resolveMessageFontSize(4)).toBe(12);
        expect(resolveMessageFontSize(999)).toBe(24);
        expect(resolveMessageFontSize("-5")).toBe(12);
    });
});

describe("appTextScalePercent / appTextScaleCss", () => {
    it("maps px to a percentage of 16", () => {
        expect(appTextScalePercent(16)).toBe(100);
        expect(appTextScalePercent(12)).toBe(75);
        expect(appTextScalePercent(24)).toBe(150);
        expect(appTextScalePercent(14)).toBe(87.5);
    });
    it("clamps out-of-range and defaults garbage before mapping", () => {
        expect(appTextScalePercent(999)).toBe(150); // clamps to 24 -> 150
        expect(appTextScalePercent(4)).toBe(75); // clamps to 12 -> 75
        expect(appTextScalePercent(NaN)).toBe(100); // default 16 -> 100
    });
    it("appTextScaleCss appends a percent sign", () => {
        expect(appTextScaleCss(16)).toBe("100%");
        expect(appTextScaleCss(12)).toBe("75%");
        expect(appTextScaleCss(14)).toBe("87.5%");
    });
});

describe("resolveMessageFont", () => {
    it("accepts known keys", () => {
        expect(resolveMessageFont("inter")).toBe("inter");
        expect(resolveMessageFont("atkinson")).toBe("atkinson");
        expect(resolveMessageFont("system")).toBe("system");
    });
    it("falls back to system for unknown/empty", () => {
        expect(resolveMessageFont(null)).toBe("system");
        expect(resolveMessageFont(undefined)).toBe("system");
        expect(resolveMessageFont("")).toBe("system");
        expect(resolveMessageFont("comic-sans")).toBe("system");
    });
});

describe("messageFontFamily / MESSAGE_FONTS", () => {
    it("system is null (inherit)", () => {
        expect(messageFontFamily("system")).toBeNull();
    });
    it("bundled fonts return a stack", () => {
        expect(messageFontFamily("inter")).toContain("Inter");
        expect(messageFontFamily("atkinson")).toContain(
            "Atkinson Hyperlegible",
        );
    });
    it("every MESSAGE_FONTS entry round-trips", () => {
        for (const f of MESSAGE_FONTS) {
            expect(resolveMessageFont(f.key)).toBe(f.key);
            expect(messageFontFamily(f.key)).toBe(f.stack);
        }
    });
    it("system is first option and default size is 16", () => {
        expect(MESSAGE_FONTS[0].key).toBe("system");
        expect(MSG_FONT_SIZE_DEFAULT).toBe(16);
    });
});

describe("applyAppTextScale (jsdom)", () => {
    it("sets the root font-size as a percentage", () => {
        applyAppTextScale(24);
        expect(document.documentElement.style.fontSize).toBe("150%");
        applyAppTextScale(16);
        expect(document.documentElement.style.fontSize).toBe("100%");
    });
});

describe("applyMessageFont (jsdom)", () => {
    it("sets the family var for a bundled font", () => {
        applyMessageFont("inter");
        expect(
            document.documentElement.style.getPropertyValue(
                "--zam-font-family",
            ),
        ).toContain("Inter");
    });
    it("removes the var for system", () => {
        applyMessageFont("inter");
        applyMessageFont("system");
        expect(
            document.documentElement.style.getPropertyValue(
                "--zam-font-family",
            ),
        ).toBe("");
    });
});

describe("custom font key", () => {
    it("resolveMessageFont accepts 'custom'", () => {
        expect(resolveMessageFont("custom")).toBe("custom");
    });
    it("resolveMessageFont still rejects unknown keys to 'system'", () => {
        expect(resolveMessageFont("bogus")).toBe("system");
    });
    it("messageFontFamily('custom') returns the custom stack with fallbacks", () => {
        const stack = messageFontFamily("custom");
        expect(stack).toContain(CUSTOM_FONT_FAMILY);
        expect(stack).toContain("sans-serif");
    });
    it("messageFontFamily('system') is still null", () => {
        expect(messageFontFamily("system")).toBeNull();
    });
});
