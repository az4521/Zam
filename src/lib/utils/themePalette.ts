/**
 * Theme palette registry and utilities.
 *
 * Pure data + functions for the theme editor: token registry, defaults,
 * sanitization, CSS-var expansion, and contrast validation. No DOM, no stores.
 */

import { t } from "$lib/i18n";
import { parseHexColor, contrastRatio } from "./contrast";

export type ThemeTokenKey =
    | "accent"
    | "background"
    | "backgroundSecondary"
    | "backgroundTertiary"
    | "textPrimary"
    | "textSecondary"
    | "textMuted"
    | "danger"
    | "positive"
    | "mention"
    | "link"
    | "warning"
    | "online"
    | "idle"
    | "dnd"
    | "offline"
    | "divider"
    | "spoilerBackground"
    | "ownBubbleBackground";

export type ThemeColors = Partial<Record<ThemeTokenKey, string>>;

export interface ThemeToken {
    key: ThemeTokenKey;
    label: string;
    hexVars: string[];
    rgbVars: string[];
}

export interface ContrastWarning {
    token: ThemeTokenKey;
    label: string;
    ratio: number;
}

export const THEME_TOKENS: readonly ThemeToken[] = [
    {
        key: "accent",
        label: t("themePalette.accent"),
        hexVars: [
            "--discord-accent",
            "--discord-accent-hover",
            "--discord-accent-fill",
            "--discord-accent-fill-hover",
        ],
        rgbVars: ["--discord-accent-rgb", "--discord-accent-fill-rgb"],
    },
    {
        key: "background",
        label: t("themePalette.background"),
        hexVars: ["--discord-bg"],
        rgbVars: ["--discord-bg-rgb"],
    },
    {
        key: "backgroundSecondary",
        label: t("themePalette.secondaryBackground"),
        hexVars: ["--discord-bg-secondary"],
        rgbVars: ["--discord-bg-secondary-rgb"],
    },
    {
        key: "backgroundTertiary",
        label: t("themePalette.tertiaryBackground"),
        hexVars: ["--discord-bg-tertiary"],
        rgbVars: [],
    },
    {
        key: "textPrimary",
        label: t("themePalette.primaryText"),
        hexVars: ["--discord-text-primary"],
        rgbVars: [],
    },
    {
        key: "textSecondary",
        label: t("themePalette.secondaryText"),
        hexVars: ["--discord-text-secondary"],
        rgbVars: [],
    },
    {
        key: "textMuted",
        label: t("themePalette.mutedText"),
        hexVars: ["--discord-text-muted"],
        rgbVars: [],
    },
    {
        key: "danger",
        label: t("themePalette.danger"),
        hexVars: ["--discord-danger", "--discord-danger-fill"],
        rgbVars: ["--discord-danger-rgb", "--discord-danger-fill-rgb"],
    },
    {
        key: "positive",
        label: t("themePalette.positive"),
        hexVars: ["--discord-positive"],
        rgbVars: [],
    },
    {
        key: "mention",
        label: t("themePalette.mentionHighlight"),
        hexVars: [],
        rgbVars: ["--discord-mention-highlight-rgb"],
    },
    {
        key: "link",
        label: t("themePalette.link"),
        hexVars: ["--discord-link"],
        rgbVars: ["--discord-link-rgb"],
    },
    {
        key: "warning",
        label: t("themePalette.warning"),
        hexVars: ["--discord-warning"],
        rgbVars: ["--discord-warning-rgb"],
    },
    {
        key: "online",
        label: t("themePalette.onlineStatus"),
        hexVars: ["--discord-online"],
        rgbVars: [],
    },
    {
        key: "idle",
        label: t("themePalette.idleStatus"),
        hexVars: ["--discord-idle"],
        rgbVars: [],
    },
    {
        key: "dnd",
        label: t("themePalette.doNotDisturbStatus"),
        hexVars: ["--discord-dnd"],
        rgbVars: [],
    },
    {
        key: "offline",
        label: t("themePalette.offlineStatus"),
        hexVars: ["--discord-offline"],
        rgbVars: [],
    },
    {
        key: "divider",
        label: t("themePalette.divider"),
        hexVars: ["--discord-divider"],
        rgbVars: [],
    },
    {
        key: "spoilerBackground",
        label: t("themePalette.spoilerBackground"),
        hexVars: ["--discord-spoiler-bg"],
        rgbVars: [],
    },
    {
        key: "ownBubbleBackground",
        label: t("themePalette.ownMessageBubble"),
        hexVars: ["--discord-own-bubble"],
        rgbVars: [],
    },
];

/**
 * Seed values shown in the editor for each token, per base theme. Accent and
 * danger use the app's AA-safe *fill* tokens (--discord-accent-fill /
 * --discord-danger-fill), NOT the brand accent/danger (#7289da / #ed4245):
 * the accent/danger editable token drives the filled-button vars, and white
 * text on the brand hues is only ~3.3:1. Do NOT change these to the brand
 * values — paletteContrastWarnings would then flag the default palette.
 * Verified white-on-fill: dark accent 4.61, dark danger 4.53, light accent
 * 5.12, light danger 4.53.
 */
export const DEFAULT_THEME_COLORS = {
    dark: {
        accent: "#5865f2",
        background: "#36393f",
        backgroundSecondary: "#2f3136",
        backgroundTertiary: "#202225",
        textPrimary: "#dcddde",
        textSecondary: "#babec4",
        textMuted: "#a4a7ae",
        danger: "#d83c3f",
        positive: "#23a559",
        mention: "#7289da",
        link: "#8fa1e2",
        warning: "#faa61a",
        online: "#3ba55c",
        idle: "#faa61a",
        dnd: "#ed4245",
        offline: "#747f8d",
        divider: "#41444e",
        spoilerBackground: "#1e1f22",
        ownBubbleBackground: "#5865f2",
    },
    light: {
        accent: "#5865c7",
        background: "#f2f3f5",
        backgroundSecondary: "#ffffff",
        backgroundTertiary: "#e3e5e8",
        textPrimary: "#2e3338",
        textSecondary: "#4e5058",
        textMuted: "#5f6169",
        danger: "#d83c3e",
        positive: "#1f7a43",
        mention: "#5865c7",
        link: "#4d5bc1",
        warning: "#a86600",
        online: "#248046",
        idle: "#b87900",
        dnd: "#d83c3e",
        offline: "#80848e",
        divider: "#d4d7dc",
        spoilerBackground: "#c9ccd1",
        ownBubbleBackground: "#5865c7",
    },
    amoled: {
        accent: "#5865f2",
        background: "#000000",
        backgroundSecondary: "#000000",
        backgroundTertiary: "#000000",
        textPrimary: "#dcddde",
        textSecondary: "#babec4",
        textMuted: "#a4a7ae",
        danger: "#d83c3f",
        positive: "#23a559",
        mention: "#7289da",
        link: "#8fa1e2",
        warning: "#faa61a",
        online: "#3ba55c",
        idle: "#faa61a",
        dnd: "#ed4245",
        offline: "#747f8d",
        divider: "#23262c",
        spoilerBackground: "#000000",
        ownBubbleBackground: "#5865f2",
    },
} as const;

/**
 * All CSS variables managed by the theme system (hex + rgb), deduped.
 */
export const ALL_MANAGED_CSS_VARS: string[] = Array.from(
    new Set(THEME_TOKENS.flatMap((t) => [...t.hexVars, ...t.rgbVars])),
);

/**
 * Normalize a hex color to `#rrggbb` lowercase.
 * Expands `#rgb` → `#rrggbb`. Returns null for invalid input.
 */
export function normalizeHex(v: string): string | null {
    const rgb = parseHexColor(v);
    if (!rgb) return null;
    return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Sanitize an unknown value to a valid ThemeColors object.
 * Keeps only known token keys with valid normalized hex values.
 */
export function sanitizeThemeColors(raw: unknown): ThemeColors {
    if (typeof raw !== "object" || raw === null) return {};

    const result: ThemeColors = {};
    const validKeys = new Set<string>(THEME_TOKENS.map((t) => t.key));

    for (const [key, value] of Object.entries(raw)) {
        if (validKeys.has(key) && typeof value === "string") {
            const normalized = normalizeHex(value);
            if (normalized) {
                result[key as ThemeTokenKey] = normalized;
            }
        }
    }

    return result;
}

/**
 * Expand a partial ThemeColors map to CSS variable assignments.
 * Emits both hex vars (as-is) and rgb vars (as "r g b" triples).
 * Skips tokens whose values fail hex parsing.
 */
export function themeColorsToCssVars(
    colors: ThemeColors,
): Array<[string, string]> {
    const result: Array<[string, string]> = [];

    for (const token of THEME_TOKENS) {
        const hex = colors[token.key];
        if (!hex) continue;

        const rgb = parseHexColor(hex);
        if (!rgb) continue; // Skip invalid hex

        // Emit hex vars
        for (const hexVar of token.hexVars) {
            result.push([hexVar, hex]);
        }

        // Emit rgb vars as "r g b" triples
        for (const rgbVar of token.rgbVars) {
            result.push([rgbVar, rgb.join(" ")]);
        }
    }

    return result;
}

/**
 * Resolve effective theme colors by overlaying partial overrides on a base theme.
 * Returns a complete map with all 19 tokens.
 */
export function resolveEffectiveColors(
    base: "dark" | "light" | "amoled",
    overrides: ThemeColors,
): Record<ThemeTokenKey, string> {
    return { ...DEFAULT_THEME_COLORS[base], ...sanitizeThemeColors(overrides) };
}

/**
 * Check a resolved palette for contrast warnings.
 * Returns warnings for any of the 5 check pairs that fall below 4.5:1.
 * Ratio is rounded to 2 decimals.
 */
export function paletteContrastWarnings(
    resolved: Record<ThemeTokenKey, string>,
): ContrastWarning[] {
    const warnings: ContrastWarning[] = [];
    const threshold = 4.5;

    // Helper to round to 2 decimals
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Check pairs as specified in the brief
    const checks: Array<{
        token: ThemeTokenKey;
        label: string;
        fg: string;
        bg: string;
    }> = [
        {
            token: "textPrimary",
            label: t("themePalette.primaryTextOnBackground"),
            fg: resolved.textPrimary,
            bg: resolved.background,
        },
        {
            token: "textSecondary",
            label: t("themePalette.secondaryTextOnBackground"),
            fg: resolved.textSecondary,
            bg: resolved.background,
        },
        {
            token: "textMuted",
            label: t("themePalette.mutedTextOnTertiaryBackground"),
            fg: resolved.textMuted,
            bg: resolved.backgroundTertiary,
        },
        {
            token: "accent",
            label: t("themePalette.whiteTextOnAccentButtons"),
            fg: "#ffffff",
            bg: resolved.accent,
        },
        {
            token: "danger",
            label: t("themePalette.whiteTextOnDangerButtons"),
            fg: "#ffffff",
            bg: resolved.danger,
        },
        {
            token: "ownBubbleBackground",
            label: t("themePalette.whiteTextOnOwnBubble"),
            fg: "#ffffff",
            bg: resolved.ownBubbleBackground,
        },
    ];

    for (const check of checks) {
        const ratio = contrastRatio(check.fg, check.bg);
        if (ratio < threshold) {
            warnings.push({
                token: check.token,
                label: check.label,
                ratio: round2(ratio),
            });
        }
    }

    return warnings;
}
