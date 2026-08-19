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

describe("18-token expansion", () => {
    it("THEME_TOKENS registry contains all 18 keys", () => {
        const keys = THEME_TOKENS.map((t) => t.key);
        expect(keys).toContain("accent");
        expect(keys).toContain("link");
        expect(keys).toContain("warning");
        expect(keys).toContain("online");
        expect(keys).toContain("idle");
        expect(keys).toContain("dnd");
        expect(keys).toContain("offline");
        expect(keys).toContain("divider");
        expect(keys).toContain("spoilerBackground");
        expect(keys).toHaveLength(18);
    });

    it("link token expands to both hex and rgb vars", () => {
        const pairs = themeColorsToCssVars({ link: "#8fa1e2" });
        expect(pairs).toContainEqual(["--discord-link", "#8fa1e2"]);
        expect(pairs).toContainEqual(["--discord-link-rgb", "143 161 226"]);
    });

    it("warning token expands to both hex and rgb vars", () => {
        const pairs = themeColorsToCssVars({ warning: "#faa61a" });
        expect(pairs).toContainEqual(["--discord-warning", "#faa61a"]);
        expect(pairs).toContainEqual(["--discord-warning-rgb", "250 166 26"]);
    });

    it("online token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({ online: "#3ba55c" });
        expect(pairs).toEqual([["--discord-online", "#3ba55c"]]);
    });

    it("idle token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({ idle: "#faa61a" });
        expect(pairs).toEqual([["--discord-idle", "#faa61a"]]);
    });

    it("dnd token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({ dnd: "#ed4245" });
        expect(pairs).toEqual([["--discord-dnd", "#ed4245"]]);
    });

    it("offline token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({ offline: "#747f8d" });
        expect(pairs).toEqual([["--discord-offline", "#747f8d"]]);
    });

    it("divider token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({ divider: "#41444e" });
        expect(pairs).toEqual([["--discord-divider", "#41444e"]]);
    });

    it("spoilerBackground token expands to hex var only", () => {
        const pairs = themeColorsToCssVars({
            spoilerBackground: "#1e1f22",
        });
        expect(pairs).toEqual([["--discord-spoiler-bg", "#1e1f22"]]);
    });

    it("DEFAULT_THEME_COLORS.dark has all 18 tokens", () => {
        const keys = Object.keys(DEFAULT_THEME_COLORS.dark);
        expect(keys).toHaveLength(18);
        expect(DEFAULT_THEME_COLORS.dark.link).toBe("#8fa1e2");
        expect(DEFAULT_THEME_COLORS.dark.warning).toBe("#faa61a");
        expect(DEFAULT_THEME_COLORS.dark.online).toBe("#3ba55c");
        expect(DEFAULT_THEME_COLORS.dark.idle).toBe("#faa61a");
        expect(DEFAULT_THEME_COLORS.dark.dnd).toBe("#ed4245");
        expect(DEFAULT_THEME_COLORS.dark.offline).toBe("#747f8d");
        expect(DEFAULT_THEME_COLORS.dark.divider).toBe("#41444e");
        expect(DEFAULT_THEME_COLORS.dark.spoilerBackground).toBe("#1e1f22");
    });

    it("DEFAULT_THEME_COLORS.light has all 18 tokens", () => {
        const keys = Object.keys(DEFAULT_THEME_COLORS.light);
        expect(keys).toHaveLength(18);
        expect(DEFAULT_THEME_COLORS.light.link).toBe("#4d5bc1");
        expect(DEFAULT_THEME_COLORS.light.warning).toBe("#a86600");
        expect(DEFAULT_THEME_COLORS.light.online).toBe("#248046");
        expect(DEFAULT_THEME_COLORS.light.idle).toBe("#b87900");
        expect(DEFAULT_THEME_COLORS.light.dnd).toBe("#d83c3e");
        expect(DEFAULT_THEME_COLORS.light.offline).toBe("#80848e");
        expect(DEFAULT_THEME_COLORS.light.divider).toBe("#d4d7dc");
        expect(DEFAULT_THEME_COLORS.light.spoilerBackground).toBe("#c9ccd1");
    });

    it("DEFAULT_THEME_COLORS.amoled exists and has all 18 tokens", () => {
        expect(DEFAULT_THEME_COLORS.amoled).toBeDefined();
        const keys = Object.keys(DEFAULT_THEME_COLORS.amoled);
        expect(keys).toHaveLength(18);
        expect(DEFAULT_THEME_COLORS.amoled.background).toBe("#000000");
        expect(DEFAULT_THEME_COLORS.amoled.backgroundSecondary).toBe("#000000");
        expect(DEFAULT_THEME_COLORS.amoled.backgroundTertiary).toBe("#000000");
        expect(DEFAULT_THEME_COLORS.amoled.divider).toBe("#23262c");
        expect(DEFAULT_THEME_COLORS.amoled.spoilerBackground).toBe("#000000");
        expect(DEFAULT_THEME_COLORS.amoled.link).toBe("#8fa1e2");
        expect(DEFAULT_THEME_COLORS.amoled.warning).toBe("#faa61a");
    });

    it("ALL_MANAGED_CSS_VARS includes all new vars", () => {
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-link");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-link-rgb");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-warning");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-warning-rgb");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-online");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-idle");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-dnd");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-offline");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-divider");
        expect(ALL_MANAGED_CSS_VARS).toContain("--discord-spoiler-bg");
    });

    it("sanitizeThemeColors keeps valid new-token hexes", () => {
        const result = sanitizeThemeColors({
            link: "#8fa1e2",
            warning: "#faa61a",
            online: "#3ba55c",
            idle: "#faa61a",
            dnd: "#ed4245",
            offline: "#747f8d",
            divider: "#41444e",
            spoilerBackground: "#1e1f22",
        });
        expect(result.link).toBe("#8fa1e2");
        expect(result.warning).toBe("#faa61a");
        expect(result.online).toBe("#3ba55c");
        expect(result.idle).toBe("#faa61a");
        expect(result.dnd).toBe("#ed4245");
        expect(result.offline).toBe("#747f8d");
        expect(result.divider).toBe("#41444e");
        expect(result.spoilerBackground).toBe("#1e1f22");
    });

    it("sanitizeThemeColors drops garbage in new tokens", () => {
        const result = sanitizeThemeColors({
            link: "notacolor",
            warning: 123,
            online: null,
        });
        expect(result.link).toBeUndefined();
        expect(result.warning).toBeUndefined();
        expect(result.online).toBeUndefined();
    });
});
