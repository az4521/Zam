import { describe, it, expect } from "vitest";
import { sanitizeCustomization } from "./customization";

describe("sanitizeCustomization", () => {
    it("keeps known keys with the right primitive type", () => {
        expect(
            sanitizeCustomization({
                theme: "light",
                alwaysAbsolute: true,
                doubleTapReaction: "🔥",
            }),
        ).toEqual({
            theme: "light",
            alwaysAbsolute: true,
            doubleTapReaction: "🔥",
        });
    });

    it("drops unknown keys and wrongly-typed values", () => {
        expect(
            sanitizeCustomization({
                theme: 42,
                alwaysAbsolute: "yes",
                somethingElse: "hi",
            }),
        ).toEqual({});
    });

    it("omits absent keys rather than emitting undefined", () => {
        const out = sanitizeCustomization({ theme: "dark" });
        expect(Object.keys(out)).toEqual(["theme"]);
    });

    it("filters the per-space reaction map to non-empty strings", () => {
        expect(
            sanitizeCustomization({
                doubleTapReactionBySpace: { a: "👍", b: "", c: 3, d: "🎉" },
            }),
        ).toEqual({ doubleTapReactionBySpace: { a: "👍", d: "🎉" } });
    });

    it("rejects a non-object map, including an array", () => {
        expect(
            sanitizeCustomization({ doubleTapReactionBySpace: ["👍"] }),
        ).toEqual({});
    });

    it("survives junk input", () => {
        expect(sanitizeCustomization(null)).toEqual({});
        expect(sanitizeCustomization("nope")).toEqual({});
        expect(sanitizeCustomization(undefined)).toEqual({});
    });

    it("round-trips a full payload unchanged, so the echo guard can compare by value", () => {
        const full = {
            theme: "dark",
            timeClock: "24h",
            dateStyle: "iso",
            customDatePattern: "yyyy-MM-dd",
            alwaysAbsolute: false,
            gifDefaultTab: "favourites",
            keepSidebarOpen: true,
            ownDoubleTapAction: "reaction",
            otherDoubleTapAction: "none",
            doubleTapReaction: "👍",
            doubleTapReactionBySpace: { "!s:x": "🎉" },
        };
        expect(JSON.stringify(sanitizeCustomization(full))).toBe(
            JSON.stringify(full),
        );
    });

    it("sanitizes themePresets with {base,colors}: keeps valid presets", () => {
        expect(
            sanitizeCustomization({
                themePresets: {
                    Mine: { base: "dark", colors: { accent: "#FFF" } },
                },
                activePreset: "Mine",
            }),
        ).toEqual({
            themePresets: {
                Mine: { base: "dark", colors: { accent: "#ffffff" } },
            },
            activePreset: "Mine",
        });
    });

    it("sanitizes themePresets: drops presets with invalid base", () => {
        expect(
            sanitizeCustomization({
                themePresets: {
                    Valid: { base: "light", colors: { accent: "#123456" } },
                    BadBase: { base: "purple", colors: { accent: "#abcdef" } },
                },
            }),
        ).toEqual({
            themePresets: {
                Valid: { base: "light", colors: { accent: "#123456" } },
            },
        });
    });

    it("sanitizes themePresets: drops non-object preset values", () => {
        expect(
            sanitizeCustomization({
                themePresets: {
                    Valid: { base: "amoled", colors: {} },
                    NotObject: "not an object",
                    AlsoNot: null,
                },
            }),
        ).toEqual({
            themePresets: { Valid: { base: "amoled", colors: {} } },
        });
    });

    it("sanitizes themePresets: cleans colors within each preset", () => {
        expect(
            sanitizeCustomization({
                themePresets: {
                    A: {
                        base: "dark",
                        colors: { accent: "#abc", bogus: "nope" },
                    },
                },
            }),
        ).toEqual({
            themePresets: {
                A: { base: "dark", colors: { accent: "#aabbcc" } },
            },
        });
    });

    it("drops themePresets and activePreset when absent", () => {
        const out = sanitizeCustomization({ theme: "dark" });
        expect(Object.keys(out)).toEqual(["theme"]);
    });

    it("returns empty themePresets object when result is empty after sanitization", () => {
        expect(
            sanitizeCustomization({ themePresets: { Empty: { bad: "x" } } }),
        ).toEqual({ themePresets: {} });
    });

    it("caps themePresets at 50 entries, keeping the first 50 in iteration order", () => {
        const tooMany: Record<string, unknown> = {};
        for (let i = 0; i < 60; i++) {
            tooMany[`preset${i}`] = {
                base: "dark",
                colors: { accent: "#010203" },
            };
        }
        const result = sanitizeCustomization({ themePresets: tooMany });
        expect(Object.keys(result.themePresets ?? {}).length).toBe(50);
        expect(result.themePresets).toHaveProperty("preset0");
        expect(result.themePresets).toHaveProperty("preset49");
        expect(result.themePresets).not.toHaveProperty("preset50");
    });

    it("rejects non-object themePresets", () => {
        expect(
            sanitizeCustomization({ themePresets: "not an object" }),
        ).toEqual({});
        expect(sanitizeCustomization({ themePresets: null })).toEqual({});
        expect(sanitizeCustomization({ themePresets: [] })).toEqual({});
    });
});

describe("sanitizeCustomization showMatrixIds", () => {
    it("keeps a boolean showMatrixIds", () => {
        expect(sanitizeCustomization({ showMatrixIds: true })).toEqual({
            showMatrixIds: true,
        });
        expect(sanitizeCustomization({ showMatrixIds: false })).toEqual({
            showMatrixIds: false,
        });
    });
    it("drops a non-boolean showMatrixIds", () => {
        expect(sanitizeCustomization({ showMatrixIds: "yes" })).toEqual({});
    });
});
