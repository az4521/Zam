import { describe, it, expect } from "vitest";
import {
    THEME_TOKENS,
    DEFAULT_THEME_COLORS,
    ALL_MANAGED_CSS_VARS,
    normalizeHex,
    sanitizeThemeColors,
    themeColorsToCssVars,
    resolveEffectiveColors,
    paletteContrastWarnings,
} from "./themePalette";

describe("normalizeHex", () => {
    it("expands #rgb and lowercases", () =>
        expect(normalizeHex("#ABC")).toBe("#aabbcc"));
    it("passes #rrggbb through lowercased", () =>
        expect(normalizeHex("#FF0088")).toBe("#ff0088"));
    it("rejects non-hex", () => {
        expect(normalizeHex("red")).toBeNull();
        expect(normalizeHex("#12")).toBeNull();
        expect(normalizeHex("")).toBeNull();
    });
});

describe("sanitizeThemeColors", () => {
    it("keeps known keys with valid normalized hex", () => {
        expect(
            sanitizeThemeColors({ accent: "#ABCDEF", background: "#000" }),
        ).toEqual({
            accent: "#abcdef",
            background: "#000000",
        });
    });
    it("drops unknown keys and invalid values", () => {
        expect(
            sanitizeThemeColors({
                accent: "#fff",
                bogus: "#fff",
                danger: "notacolor",
                textMuted: 5,
            }),
        ).toEqual({
            accent: "#ffffff",
        });
    });
    it("returns {} for non-objects", () => {
        expect(sanitizeThemeColors(null)).toEqual({});
        expect(sanitizeThemeColors("x")).toEqual({});
    });
});

describe("themeColorsToCssVars", () => {
    it("expands a token to all its hex vars and rgb triples", () => {
        const pairs = themeColorsToCssVars({ background: "#010203" });
        expect(pairs).toContainEqual(["--discord-bg", "#010203"]);
        expect(pairs).toContainEqual(["--discord-bg-rgb", "1 2 3"]);
    });
    it("emits accent fill vars and the accent rgb twin", () => {
        const pairs = themeColorsToCssVars({ accent: "#5865f2" });
        const vars = Object.fromEntries(pairs);
        expect(vars["--discord-accent"]).toBe("#5865f2");
        expect(vars["--discord-accent-fill"]).toBe("#5865f2");
        expect(vars["--discord-accent-rgb"]).toBe("88 101 242");
    });
    it("maps mention to only the mention-highlight rgb var", () => {
        expect(themeColorsToCssVars({ mention: "#010203" })).toEqual([
            ["--discord-mention-highlight-rgb", "1 2 3"],
        ]);
    });
    it("skips invalid hex", () => {
        expect(themeColorsToCssVars({ accent: "nope" as string })).toEqual([]);
    });
});

describe("ALL_MANAGED_CSS_VARS", () => {
    it("contains every managed var and is deduped", () => {
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-bg");
        expect(ALL_MANAGED_CSS_VARS).toContain(
            "--discord-mention-highlight-rgb",
        );
        expect(new Set(ALL_MANAGED_CSS_VARS).size).toBe(
            ALL_MANAGED_CSS_VARS.length,
        );
    });
});

describe("resolveEffectiveColors", () => {
    it("overlays overrides on the base theme defaults", () => {
        const r = resolveEffectiveColors("dark", { accent: "#000000" });
        expect(r.accent).toBe("#000000");
        expect(r.background).toBe(DEFAULT_THEME_COLORS.dark.background);
    });
});

describe("paletteContrastWarnings", () => {
    it("returns no warnings for the default dark palette", () => {
        expect(paletteContrastWarnings(DEFAULT_THEME_COLORS.dark)).toEqual([]);
    });
    it("returns no warnings for the default light palette", () => {
        expect(paletteContrastWarnings(DEFAULT_THEME_COLORS.light)).toEqual([]);
    });
    it("warns when primary text has poor contrast on background", () => {
        const bad = { ...DEFAULT_THEME_COLORS.dark, textPrimary: "#3a3d42" };
        const w = paletteContrastWarnings(bad);
        expect(w.some((x) => x.token === "textPrimary")).toBe(true);
    });
    it("warns when white-on-accent is illegible", () => {
        const bad = { ...DEFAULT_THEME_COLORS.dark, accent: "#ffffff" };
        expect(
            paletteContrastWarnings(bad).some((x) => x.token === "accent"),
        ).toBe(true);
    });
});
