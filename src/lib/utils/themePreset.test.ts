import { describe, it, expect } from "vitest";
import {
    BUILTIN_PRESETS,
    isBuiltinPreset,
    defaultActivePresetName,
    orderedPresetNames,
    resolveActivePreset,
    forkFromEdit,
    sanitizeCustomPreset,
    migrateThemeToPresetName,
    type CustomPreset,
} from "./themePreset";

describe("themePreset", () => {
    describe("BUILTIN_PRESETS", () => {
        it("has exactly 3 built-in presets", () => {
            expect(BUILTIN_PRESETS).toHaveLength(3);
        });

        it("includes Default Dark with base dark and empty colors", () => {
            const darkPreset = BUILTIN_PRESETS.find(
                (p) => p.name === "Default Dark",
            );
            expect(darkPreset).toBeDefined();
            expect(darkPreset?.base).toBe("dark");
            expect(darkPreset?.colors).toEqual({});
        });

        it("includes Default Light with base light and empty colors", () => {
            const lightPreset = BUILTIN_PRESETS.find(
                (p) => p.name === "Default Light",
            );
            expect(lightPreset).toBeDefined();
            expect(lightPreset?.base).toBe("light");
            expect(lightPreset?.colors).toEqual({});
        });

        it("includes Default AMOLED with base amoled and empty colors", () => {
            const amoledPreset = BUILTIN_PRESETS.find(
                (p) => p.name === "Default AMOLED",
            );
            expect(amoledPreset).toBeDefined();
            expect(amoledPreset?.base).toBe("amoled");
            expect(amoledPreset?.colors).toEqual({});
        });
    });

    describe("isBuiltinPreset", () => {
        it("returns true for Default Dark", () => {
            expect(isBuiltinPreset("Default Dark")).toBe(true);
        });

        it("returns true for Default Light", () => {
            expect(isBuiltinPreset("Default Light")).toBe(true);
        });

        it("returns true for Default AMOLED", () => {
            expect(isBuiltinPreset("Default AMOLED")).toBe(true);
        });

        it("returns false for unknown names", () => {
            expect(isBuiltinPreset("Custom Theme")).toBe(false);
            expect(isBuiltinPreset("")).toBe(false);
            expect(isBuiltinPreset("default dark")).toBe(false); // Case-sensitive
        });
    });

    describe("defaultActivePresetName", () => {
        it("returns Default Dark", () => {
            expect(defaultActivePresetName()).toBe("Default Dark");
        });
    });

    describe("orderedPresetNames", () => {
        it("returns only built-in names when no custom presets exist", () => {
            const names = orderedPresetNames({});
            expect(names).toHaveLength(3);
            expect(names[0]).toBe("Default Dark");
            expect(names[1]).toBe("Default Light");
            expect(names[2]).toBe("Default AMOLED");
        });

        it("returns built-ins first, then custom presets in alphabetical order", () => {
            const customs = {
                Zulu: { base: "dark" as const, colors: {} },
                Alpha: { base: "light" as const, colors: {} },
                Beta: { base: "amoled" as const, colors: {} },
            };
            const names = orderedPresetNames(customs);
            expect(names).toHaveLength(6);
            expect(names[0]).toBe("Default Dark");
            expect(names[1]).toBe("Default Light");
            expect(names[2]).toBe("Default AMOLED");
            expect(names[3]).toBe("Alpha");
            expect(names[4]).toBe("Beta");
            expect(names[5]).toBe("Zulu");
        });
    });

    describe("resolveActivePreset", () => {
        it("returns base and empty colors for Default Dark", () => {
            const result = resolveActivePreset("Default Dark", {});
            expect(result.base).toBe("dark");
            expect(result.colors).toEqual({});
        });

        it("returns base and empty colors for Default Light", () => {
            const result = resolveActivePreset("Default Light", {});
            expect(result.base).toBe("light");
            expect(result.colors).toEqual({});
        });

        it("returns base and empty colors for Default AMOLED", () => {
            const result = resolveActivePreset("Default AMOLED", {});
            expect(result.base).toBe("amoled");
            expect(result.colors).toEqual({});
        });

        it("returns the stored preset for a known custom preset", () => {
            const customs = {
                "My Theme": {
                    base: "dark" as const,
                    colors: { accent: "#ff0000", background: "#000000" },
                },
            };
            const result = resolveActivePreset("My Theme", customs);
            expect(result.base).toBe("dark");
            expect(result.colors).toEqual({
                accent: "#ff0000",
                background: "#000000",
            });
        });

        it("falls back to Default Dark for unknown preset name", () => {
            const result = resolveActivePreset("Unknown Theme", {});
            expect(result.base).toBe("dark");
            expect(result.colors).toEqual({});
        });

        it("falls back to Default Dark when custom preset is missing", () => {
            const customs = {
                Existing: { base: "light" as const, colors: {} },
            };
            const result = resolveActivePreset("Missing", customs);
            expect(result.base).toBe("dark");
            expect(result.colors).toEqual({});
        });
    });

    describe("forkFromEdit", () => {
        it("creates a new custom preset inheriting the source base", () => {
            const result = forkFromEdit(
                "dark",
                { accent: "#ff0000" },
                "My Dark Fork",
            );
            expect(result.name).toBe("My Dark Fork");
            expect(result.preset.base).toBe("dark");
            expect(result.preset.colors.accent).toBe("#ff0000");
        });

        it("sanitizes color overrides", () => {
            const result = forkFromEdit(
                "light",
                { accent: "#f00", invalidKey: "#123456" } as any,
                "Test",
            );
            expect(result.preset.colors.accent).toBe("#ff0000"); // Normalized
            expect("invalidKey" in result.preset.colors).toBe(false);
        });

        it("refuses to shadow Default Dark by renaming", () => {
            const result = forkFromEdit("dark", {}, "Default Dark");
            expect(result.name).not.toBe("Default Dark");
            // Should be renamed to something like "Default Dark 2" or similar
        });

        it("refuses to shadow Default Light by renaming", () => {
            const result = forkFromEdit("light", {}, "Default Light");
            expect(result.name).not.toBe("Default Light");
        });

        it("refuses to shadow Default AMOLED by renaming", () => {
            const result = forkFromEdit("amoled", {}, "Default AMOLED");
            expect(result.name).not.toBe("Default AMOLED");
        });

        it("allows non-built-in names without renaming", () => {
            const result = forkFromEdit("dark", {}, "Custom Theme");
            expect(result.name).toBe("Custom Theme");
        });
    });

    describe("sanitizeCustomPreset", () => {
        it("validates a complete preset", () => {
            const input = {
                base: "dark",
                colors: { accent: "#ff0000", background: "#000000" },
            };
            const result = sanitizeCustomPreset(input);
            expect(result).not.toBeNull();
            expect(result?.base).toBe("dark");
            expect(result?.colors).toEqual({
                accent: "#ff0000",
                background: "#000000",
            });
        });

        it("normalizes color hex values", () => {
            const input = {
                base: "light",
                colors: { accent: "#F00" },
            };
            const result = sanitizeCustomPreset(input);
            expect(result?.colors.accent).toBe("#ff0000");
        });

        it("filters out invalid colors", () => {
            const input = {
                base: "amoled",
                colors: { accent: "not-a-color", background: "#123456" },
            };
            const result = sanitizeCustomPreset(input);
            expect(result?.colors).toEqual({ background: "#123456" });
        });

        it("filters out unknown token keys", () => {
            const input = {
                base: "dark",
                colors: { accent: "#ff0000", unknownKey: "#123456" },
            };
            const result = sanitizeCustomPreset(input);
            expect(result?.colors).toEqual({ accent: "#ff0000" });
        });

        it("returns null for invalid base", () => {
            const input = {
                base: "invalid-base",
                colors: {},
            };
            const result = sanitizeCustomPreset(input);
            expect(result).toBeNull();
        });

        it("returns null for non-object input", () => {
            expect(sanitizeCustomPreset(null)).toBeNull();
            expect(sanitizeCustomPreset("string")).toBeNull();
            expect(sanitizeCustomPreset(123)).toBeNull();
            expect(sanitizeCustomPreset(undefined)).toBeNull();
        });

        it("returns null for missing base", () => {
            const input = {
                colors: { accent: "#ff0000" },
            };
            const result = sanitizeCustomPreset(input);
            expect(result).toBeNull();
        });
    });

    describe("migrateThemeToPresetName", () => {
        it('maps "dark" to "Default Dark"', () => {
            expect(migrateThemeToPresetName("dark")).toBe("Default Dark");
        });

        it('maps "light" to "Default Light"', () => {
            expect(migrateThemeToPresetName("light")).toBe("Default Light");
        });

        it('maps "amoled" to "Default AMOLED"', () => {
            expect(migrateThemeToPresetName("amoled")).toBe("Default AMOLED");
        });

        it("defaults null to Default Dark", () => {
            expect(migrateThemeToPresetName(null)).toBe("Default Dark");
        });

        it("defaults undefined to Default Dark", () => {
            expect(migrateThemeToPresetName(undefined)).toBe("Default Dark");
        });

        it("defaults unknown theme to Default Dark", () => {
            expect(migrateThemeToPresetName("unknown")).toBe("Default Dark");
            expect(migrateThemeToPresetName("")).toBe("Default Dark");
            expect(migrateThemeToPresetName("DARK")).toBe("Default Dark"); // Case-sensitive
        });
    });
});
