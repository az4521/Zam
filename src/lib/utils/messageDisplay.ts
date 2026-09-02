// Device-local message text size and font family logic.
// Pure resolution, clamping, and DOM-apply helpers for adjustable message
// display. Sets --zam-font-family and the ROOT font-size (app-wide scale).

export const MSG_FONT_SIZE_MIN = 12;
export const MSG_FONT_SIZE_MAX = 24;
export const MSG_FONT_SIZE_DEFAULT = 16;

export type MessageFontKey = "system" | "inter" | "atkinson" | "custom";

export const MESSAGE_FONTS: readonly {
    key: MessageFontKey;
    label: string;
    stack: string | null;
}[] = [
    { key: "system", label: "System default", stack: null },
    {
        key: "inter",
        label: "Inter",
        stack: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
    {
        key: "atkinson",
        label: "Atkinson Hyperlegible",
        stack: '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif',
    },
];

/** Family name the uploaded custom font is registered under (FontFace API). */
export const CUSTOM_FONT_FAMILY = "ZamCustomFont";

/** CSS stack when the custom font is selected: the registered family plus safe
 *  sans-serif fallbacks so message text still renders if the FontFace is not
 *  (yet) loaded — e.g. before boot registration finishes. */
const CUSTOM_FONT_STACK = `"${CUSTOM_FONT_FAMILY}", "Helvetica Neue", Arial, sans-serif`;

/**
 * Resolves and clamps message font size from stored value.
 * Returns MSG_FONT_SIZE_DEFAULT for null/undefined/empty/invalid.
 */
export function resolveMessageFontSize(
    raw: string | number | null | undefined,
): number {
    // Guard null/undefined
    if (raw == null) return MSG_FONT_SIZE_DEFAULT;

    // Guard empty/whitespace strings BEFORE numeric coercion (Number("") = 0)
    if (typeof raw === "string" && raw.trim() === "") {
        return MSG_FONT_SIZE_DEFAULT;
    }

    // Coerce to number
    const n = typeof raw === "number" ? raw : Number(raw);

    // Guard NaN/Infinity
    if (!Number.isFinite(n)) return MSG_FONT_SIZE_DEFAULT;

    // Clamp and round
    return Math.min(
        MSG_FONT_SIZE_MAX,
        Math.max(MSG_FONT_SIZE_MIN, Math.round(n)),
    );
}

/**
 * Maps the stored text-size px (12-24) to an app-wide scale percentage of a
 * 16px base (16 -> 100, 12 -> 75, 24 -> 150). Resolves/clamps garbage first.
 */
export function appTextScalePercent(
    raw: string | number | null | undefined,
): number {
    return (resolveMessageFontSize(raw) / 16) * 100;
}

/** The scale as a CSS percentage string (e.g. "87.5%") for the root font-size. */
export function appTextScaleCss(
    raw: string | number | null | undefined,
): string {
    return `${appTextScalePercent(raw)}%`;
}

/**
 * Validates and resolves a font key. Unknown keys fall back to "system".
 */
export function resolveMessageFont(
    raw: string | null | undefined,
): MessageFontKey {
    if (raw == null) return "system";
    const key = raw as MessageFontKey;
    if (key === "custom") return "custom";
    return MESSAGE_FONTS.some((f) => f.key === key) ? key : "system";
}

/**
 * Returns the font stack for a given key, or null for system (inherit).
 */
export function messageFontFamily(key: MessageFontKey): string | null {
    if (key === "custom") return CUSTOM_FONT_STACK;
    const entry = MESSAGE_FONTS.find((f) => f.key === key);
    return entry ? entry.stack : null;
}

/**
 * Applies the app-wide text scale by setting the ROOT font-size (as a % of the
 * browser base). All rem/Tailwind sizing follows, so the whole app scales.
 * Message text follows the root via .message-body's plain rem — it must NOT
 * also read a px var, or it would scale twice.
 */
export function applyAppTextScale(px: number): void {
    if (typeof document === "undefined") return;
    document.documentElement.style.fontSize = appTextScaleCss(px);
}

/**
 * Applies message font family to the DOM via CSS custom property.
 * Removes the property for "system" to inherit default.
 */
export function applyMessageFont(key: MessageFontKey): void {
    if (typeof document === "undefined") return;
    const stack = messageFontFamily(resolveMessageFont(key));
    if (stack === null) {
        document.documentElement.style.removeProperty("--zam-font-family");
    } else {
        document.documentElement.style.setProperty("--zam-font-family", stack);
    }
}
