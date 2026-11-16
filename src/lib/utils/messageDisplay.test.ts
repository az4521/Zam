import { describe, it, expect } from "vitest";
import {
    resolveMessageFontSize,
    resolveMessageFont,
    messageFontFamily,
    MESSAGE_FONTS,
    MSG_FONT_SIZE_DEFAULT,
    resolveInterfaceScale,
    resolveMessageTextScale,
    migrateLegacyInterfaceScale,
    resolveStoredInterfaceScale,
    applyInterfaceScale,
    applyMessageTextScale,
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

describe("resolveInterfaceScale", () => {
    it("snaps to steps of 5 within 75..150", () => {
        expect(resolveInterfaceScale(113)).toBe(115);
        expect(resolveInterfaceScale(117)).toBe(115);
        expect(resolveInterfaceScale("132")).toBe(130);
        expect(resolveInterfaceScale(75)).toBe(75);
        expect(resolveInterfaceScale(150)).toBe(150);
    });
    it("clamps out-of-range values", () => {
        expect(resolveInterfaceScale(10)).toBe(75);
        expect(resolveInterfaceScale(999)).toBe(150);
        expect(resolveInterfaceScale("-5")).toBe(75);
    });
    it("defaults garbage to 100", () => {
        expect(resolveInterfaceScale(null)).toBe(100);
        expect(resolveInterfaceScale(undefined)).toBe(100);
        expect(resolveInterfaceScale("")).toBe(100);
        expect(resolveInterfaceScale("abc")).toBe(100);
        expect(resolveInterfaceScale(NaN)).toBe(100);
    });
    it("every value in range is a multiple of 5 (exact labels)", () => {
        for (let p = 75; p <= 150; p += 5) {
            expect(resolveInterfaceScale(p) % 5).toBe(0);
        }
    });
});

describe("resolveMessageTextScale", () => {
    it("snaps to steps of 10 within 80..200", () => {
        expect(resolveMessageTextScale(125)).toBe(130); // halfway rounds up
        expect(resolveMessageTextScale(124)).toBe(120);
        expect(resolveMessageTextScale(135)).toBe(140);
        expect(resolveMessageTextScale("180")).toBe(180);
    });
    it("clamps out-of-range values", () => {
        expect(resolveMessageTextScale(10)).toBe(80);
        expect(resolveMessageTextScale(999)).toBe(200);
    });
    it("defaults garbage to 100", () => {
        expect(resolveMessageTextScale(null)).toBe(100);
        expect(resolveMessageTextScale("nope")).toBe(100);
        expect(resolveMessageTextScale(Infinity)).toBe(100);
    });
    it("every value in range is a multiple of 10", () => {
        for (let p = 80; p <= 200; p += 10) {
            expect(resolveMessageTextScale(p) % 10).toBe(0);
        }
    });
});

describe("legacy messageFontSize migration", () => {
    it("maps px to a nearest-5 interface percent", () => {
        expect(migrateLegacyInterfaceScale("16")).toBe(100);
        expect(migrateLegacyInterfaceScale(19)).toBe(120); // 118.75 -> 120
        expect(migrateLegacyInterfaceScale(21)).toBe(130); // 131.25 -> 130
        expect(migrateLegacyInterfaceScale(12)).toBe(75);
        expect(migrateLegacyInterfaceScale(24)).toBe(150);
    });
    it("clamps legacy px before mapping", () => {
        expect(migrateLegacyInterfaceScale(4)).toBe(75);
        expect(migrateLegacyInterfaceScale(999)).toBe(150);
        expect(migrateLegacyInterfaceScale("junk")).toBe(100);
    });
    it("new key wins over legacy when both exist", () => {
        expect(resolveStoredInterfaceScale("110", "24")).toBe(110);
    });
    it("migrates legacy when the new key is absent", () => {
        expect(resolveStoredInterfaceScale(null, "19")).toBe(120);
        expect(resolveStoredInterfaceScale("", "21")).toBe(130);
    });
    it("defaults to 100 when neither key exists", () => {
        expect(resolveStoredInterfaceScale(null, null)).toBe(100);
        expect(resolveStoredInterfaceScale(null, "")).toBe(100);
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

describe("applyInterfaceScale / applyMessageTextScale (jsdom)", () => {
    it("sets the root font-size as a percentage", () => {
        applyInterfaceScale(150);
        expect(document.documentElement.style.fontSize).toBe("150%");
        applyInterfaceScale(100);
        expect(document.documentElement.style.fontSize).toBe("100%");
    });
    it("snaps before applying the root font-size", () => {
        applyInterfaceScale(118);
        expect(document.documentElement.style.fontSize).toBe("120%");
    });
    it("sets the message text multiplier var", () => {
        applyMessageTextScale(120);
        expect(
            document.documentElement.style.getPropertyValue(
                "--message-text-scale",
            ),
        ).toBe("1.2");
        applyMessageTextScale(100);
        expect(
            document.documentElement.style.getPropertyValue(
                "--message-text-scale",
            ),
        ).toBe("1");
    });
    it("message scale does not touch the root font-size", () => {
        applyInterfaceScale(110);
        applyMessageTextScale(200);
        expect(document.documentElement.style.fontSize).toBe("110%");
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
