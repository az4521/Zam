import { describe, it, expect } from "vitest";
import {
    resolveMessageFontSize,
    messageFontSizeCss,
    resolveMessageFont,
    messageFontFamily,
    MESSAGE_FONTS,
    MSG_FONT_SIZE_DEFAULT,
    applyMessageFontSize,
    applyMessageFont,
} from "./messageDisplay";

describe("resolveMessageFontSize", () => {
    it("defaults when unset/garbage", () => {
        expect(resolveMessageFontSize(null)).toBe(14);
        expect(resolveMessageFontSize(undefined)).toBe(14);
        expect(resolveMessageFontSize("")).toBe(14);
        expect(resolveMessageFontSize("   ")).toBe(14);
        expect(resolveMessageFontSize("abc")).toBe(14);
        expect(resolveMessageFontSize(NaN)).toBe(14);
        expect(resolveMessageFontSize(Infinity)).toBe(14);
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

describe("messageFontSizeCss", () => {
    it("appends px and clamps invalid", () => {
        expect(messageFontSizeCss(16)).toBe("16px");
        expect(messageFontSizeCss(999)).toBe("24px");
        expect(messageFontSizeCss(NaN)).toBe("14px");
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
    it("system is first option and default size is 14", () => {
        expect(MESSAGE_FONTS[0].key).toBe("system");
        expect(MSG_FONT_SIZE_DEFAULT).toBe(14);
    });
});

describe("applyMessageFontSize (jsdom)", () => {
    it("sets the css var in px", () => {
        applyMessageFontSize(18);
        expect(
            document.documentElement.style.getPropertyValue(
                "--zam-msg-font-size",
            ),
        ).toBe("18px");
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
