import {
    themeColorsToCssVars,
    ALL_MANAGED_CSS_VARS,
    type ThemeColors,
} from "./themePalette";

export type Theme = "dark" | "light" | "amoled";

export function normalizeTheme(value: string | null): Theme {
    if (value === "light") return "light";
    if (value === "amoled") return "amoled";
    return "dark";
}

/**
 * Force reduced motion via a root attribute, mirroring how applyTheme sets
 * data-theme. `app.css` targets `:root[data-reduce-motion="true"]` with the
 * same suppression the OS `@media (prefers-reduced-motion)` block uses, so the
 * in-app toggle can reduce motion even when the OS makes no such request.
 *
 * Off deletes the attribute rather than writing "false": the CSS selector keys
 * on the literal "true", and a lingering `data-reduce-motion="false"` would be
 * dead attribute noise. Lives here (not in motionPreference.ts) because
 * settings.svelte already imports theme.ts — importing motionPreference from
 * settings would close a cycle (motionPreference reads the settings store).
 */
export function applyReduceMotion(on: boolean): void {
    if (typeof document === "undefined") return;
    if (on) document.documentElement.dataset.reduceMotion = "true";
    else delete document.documentElement.dataset.reduceMotion;
}

export function applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    const themeColor =
        theme === "light"
            ? "#f2f3f5"
            : theme === "amoled"
              ? "#000000"
              : "#313338";
    document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", themeColor);
}

/**
 * Serialize a ThemeColors map to inline CSS custom property declarations.
 * Returns a string like "--discord-bg:#000000;--discord-bg-rgb:0 0 0;..."
 * with the SAME set of vars that applyThemeColors would set on the root element.
 * Empty/null colors → returns "".
 */
export function themeColorsToCssText(colors: ThemeColors | null): string {
    if (!colors || Object.keys(colors).length === 0) return "";
    const pairs = themeColorsToCssVars(colors);
    return pairs.map(([prop, value]) => `${prop}:${value};`).join("");
}

/**
 * Apply a custom color preset as inline custom properties on the root element,
 * or clear all managed overrides when passed null. Inline styles beat the
 * stylesheet :root blocks, so a preset overrides whichever base theme is active.
 * Always clears every managed var first so switching presets never leaves a
 * stale override behind.
 */
export function applyThemeColors(colors: ThemeColors | null): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    for (const v of ALL_MANAGED_CSS_VARS) root.style.removeProperty(v);
    if (!colors) return;
    for (const [prop, value] of themeColorsToCssVars(colors)) {
        root.style.setProperty(prop, value);
    }
}

/**
 * Apply a theme preset = base theme + optional color overrides.
 * Sets the data-theme attribute and theme-color meta tag, then applies
 * any custom color overrides as inline styles. Pass null for colors to
 * apply the base theme with no overrides.
 */
export function applyPreset(
    base: Theme,
    colors: Partial<ThemeColors> | null,
): void {
    applyTheme(base);
    applyThemeColors(colors);
}
