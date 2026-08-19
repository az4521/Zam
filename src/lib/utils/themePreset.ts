/**
 * Theme preset model: base + overlay.
 *
 * Every preset = { base: "dark"|"light"|"amoled", colors: partial overrides }.
 * Three built-in read-only presets (Default Dark/Light/AMOLED) plus custom user presets.
 */

import {
    sanitizeThemeColors,
    DEFAULT_THEME_COLORS,
    type ThemeTokenKey,
    type ThemeColors,
} from "./themePalette";

/**
 * Base theme determining structural CSS vars (data-theme attribute).
 * Defined locally to avoid dependency on theme.ts during the migration.
 */
export type ThemeBase = keyof typeof DEFAULT_THEME_COLORS;

/**
 * A custom preset: base theme + optional color overrides.
 */
export interface CustomPreset {
    base: ThemeBase;
    colors: Partial<Record<ThemeTokenKey, string>>;
}

interface BuiltinPreset {
    name: string;
    base: ThemeBase;
    colors: Partial<Record<ThemeTokenKey, string>>;
}

/**
 * The 3 built-in presets, ordered: Dark, Light, AMOLED.
 * Read-only, undeletable, base-only (no color overrides).
 */
export const BUILTIN_PRESETS: readonly BuiltinPreset[] = [
    { name: "Default Dark", base: "dark", colors: {} },
    { name: "Default Light", base: "light", colors: {} },
    { name: "Default AMOLED", base: "amoled", colors: {} },
] as const;

const BUILTIN_NAMES = new Set(BUILTIN_PRESETS.map((p) => p.name));

/**
 * Check if a name is one of the 3 reserved built-in preset names.
 */
export function isBuiltinPreset(name: string): boolean {
    return BUILTIN_NAMES.has(name);
}

/**
 * The default active preset for new users.
 */
export function defaultActivePresetName(): string {
    return "Default Dark";
}

/**
 * Returns all preset names ordered: built-ins first, then custom presets alphabetically.
 */
export function orderedPresetNames(
    customPresets: Record<string, CustomPreset>,
): string[] {
    const builtinNames = BUILTIN_PRESETS.map((p) => p.name);
    const customNames = Object.keys(customPresets).sort();
    return [...builtinNames, ...customNames];
}

/**
 * Resolve a preset name to its base + colors.
 * For built-ins: returns { base, colors: {} }.
 * For known custom: returns that preset.
 * For unknown: falls back to Default Dark.
 */
export function resolveActivePreset(
    name: string,
    customPresets: Record<string, CustomPreset>,
): { base: ThemeBase; colors: Partial<Record<ThemeTokenKey, string>> } {
    // Check built-ins first
    const builtin = BUILTIN_PRESETS.find((p) => p.name === name);
    if (builtin) {
        return { base: builtin.base, colors: {} };
    }

    // Check custom presets
    const custom = customPresets[name];
    if (custom) {
        return custom;
    }

    // Fall back to Default Dark
    return { base: "dark", colors: {} };
}

/**
 * Fork a new custom preset from an edit.
 * Inherits sourceBase, sanitizes editedColors.
 * If newName collides with a built-in, renames to avoid shadowing.
 */
export function forkFromEdit(
    sourceBase: ThemeBase,
    editedColors: Partial<Record<ThemeTokenKey, string>>,
    newName: string,
): { name: string; preset: CustomPreset } {
    // Sanitize colors
    const sanitizedColors = sanitizeThemeColors(editedColors);

    // Dedupe if shadowing a built-in
    let finalName = newName;
    if (isBuiltinPreset(newName)) {
        finalName = `${newName} (Copy)`;
    }

    return {
        name: finalName,
        preset: {
            base: sourceBase,
            colors: sanitizedColors,
        },
    };
}

/**
 * Validate and sanitize a custom preset from unknown input.
 * Returns null if base is invalid or input is not an object.
 */
export function sanitizeCustomPreset(value: unknown): CustomPreset | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const obj = value as Record<string, unknown>;

    // Validate base
    const base = obj.base;
    if (
        typeof base !== "string" ||
        !["dark", "light", "amoled"].includes(base)
    ) {
        return null;
    }

    // Sanitize colors
    const colors = sanitizeThemeColors(obj.colors);

    return {
        base: base as ThemeBase,
        colors,
    };
}

/**
 * Migrate a legacy theme setting to a built-in preset name.
 * Maps "dark"/"light"/"amoled" to their corresponding Default preset.
 * Anything else (null, undefined, unknown) defaults to "Default Dark".
 */
export function migrateThemeToPresetName(
    theme: string | null | undefined,
): string {
    if (theme === "dark") {
        return BUILTIN_PRESETS[0].name; // "Default Dark"
    }
    if (theme === "light") {
        return BUILTIN_PRESETS[1].name; // "Default Light"
    }
    if (theme === "amoled") {
        return BUILTIN_PRESETS[2].name; // "Default AMOLED"
    }
    return defaultActivePresetName(); // "Default Dark"
}
