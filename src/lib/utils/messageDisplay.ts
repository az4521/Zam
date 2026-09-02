// Device-local message text size and font family logic.
// Pure resolution, clamping, and DOM-apply helpers for adjustable message
// display. Sets --zam-msg-font-size and --zam-font-family CSS custom properties.

export const MSG_FONT_SIZE_MIN = 12;
export const MSG_FONT_SIZE_MAX = 24;
export const MSG_FONT_SIZE_DEFAULT = 14;

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
 * Returns CSS pixel value for message font size (always valid).
 */
export function messageFontSizeCss(px: number): string {
    return `${resolveMessageFontSize(px)}px`;
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
 * Applies message font size to the DOM via CSS custom property.
 */
export function applyMessageFontSize(px: number): void {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
        "--zam-msg-font-size",
        messageFontSizeCss(px),
    );
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
