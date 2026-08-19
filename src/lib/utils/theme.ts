import {
    themeColorsToCssVars,
    ALL_MANAGED_CSS_VARS,
    type ThemeColors,
} from "./themePalette";

export type Theme = "dark" | "light";

export function normalizeTheme(value: string | null): Theme {
    return value === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "light" ? "#f2f3f5" : "#313338");
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
