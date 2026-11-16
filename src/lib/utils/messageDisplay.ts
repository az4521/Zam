// Device-local message text size and font family logic.
// Pure resolution, clamping, and DOM-apply helpers for adjustable message
// display. Sets --zam-font-family and the ROOT font-size (app-wide scale).
import { t } from "$lib/i18n";

export const MSG_FONT_SIZE_MIN = 12;
export const MSG_FONT_SIZE_MAX = 24;
export const MSG_FONT_SIZE_DEFAULT = 16;

export type MessageFontKey = "system" | "inter" | "atkinson" | "custom";

export const MESSAGE_FONTS: readonly {
    key: MessageFontKey;
    label: string;
    stack: string | null;
}[] = [
    { key: "system", label: t("messageDisplay.systemDefault"), stack: null },
    {
        key: "inter",
        label: "Inter",
        stack: '"Inter", "Helvetica Neue", Arial, "Noto Sans Syriac Eastern", "Noto Sans Syriac", "Estrangelo Edessa", sans-serif',
    },
    {
        key: "atkinson",
        label: "Atkinson Hyperlegible",
        stack: '"Atkinson Hyperlegible", "Helvetica Neue", Arial, "Noto Sans Syriac Eastern", "Noto Sans Syriac", "Estrangelo Edessa", sans-serif',
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

/** Interface scale (whole UI, root font-size), percent. Steps of 5. */
export const INTERFACE_SCALE_MIN = 75;
export const INTERFACE_SCALE_MAX = 150;
export const INTERFACE_SCALE_STEP = 5;
export const INTERFACE_SCALE_DEFAULT = 100;

/** Message text scale (chat bodies + composer only), percent. Steps of 10. */
export const MESSAGE_TEXT_SCALE_MIN = 80;
export const MESSAGE_TEXT_SCALE_MAX = 200;
export const MESSAGE_TEXT_SCALE_STEP = 10;
export const MESSAGE_TEXT_SCALE_DEFAULT = 100;

/** Clamps `n` to [min, max] and snaps it to the nearest multiple of `step`
 *  measured from `min` (so the bounds themselves are always valid values).
 *  Non-finite input yields `fallback`. */
function snapScale(
    raw: string | number | null | undefined,
    min: number,
    max: number,
    step: number,
    fallback: number,
): number {
    if (raw == null) return fallback;
    if (typeof raw === "string" && raw.trim() === "") return fallback;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return fallback;
    const snapped = min + Math.round((n - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
}

/** Resolves a stored interface scale percent to a valid 75..150 step-5 value. */
export function resolveInterfaceScale(
    raw: string | number | null | undefined,
): number {
    return snapScale(
        raw,
        INTERFACE_SCALE_MIN,
        INTERFACE_SCALE_MAX,
        INTERFACE_SCALE_STEP,
        INTERFACE_SCALE_DEFAULT,
    );
}

/** Resolves a stored message text scale percent to a valid 80..200 step-10 value. */
export function resolveMessageTextScale(
    raw: string | number | null | undefined,
): number {
    return snapScale(
        raw,
        MESSAGE_TEXT_SCALE_MIN,
        MESSAGE_TEXT_SCALE_MAX,
        MESSAGE_TEXT_SCALE_STEP,
        MESSAGE_TEXT_SCALE_DEFAULT,
    );
}

/**
 * Migrates the legacy px text size (`messageFontSize`, 12-24 px, 16 = 100%)
 * into an interface scale percent: px / 16 * 100, snapped to the nearest 5.
 * 19px -> 118.75 -> 120; 21px -> 131.25 -> 130. Null/garbage -> default 100.
 */
export function migrateLegacyInterfaceScale(
    legacyPx: string | number | null | undefined,
): number {
    const px = resolveMessageFontSize(legacyPx);
    return resolveInterfaceScale((px / 16) * 100);
}

/**
 * Picks the stored interface scale: the new key wins when present, otherwise
 * the legacy px key is migrated (absent in both -> default 100).
 */
export function resolveStoredInterfaceScale(
    raw: string | null | undefined,
    legacyPx: string | null | undefined,
): number {
    if (raw != null && raw.trim() !== "") return resolveInterfaceScale(raw);
    if (legacyPx != null && legacyPx.trim() !== "") {
        return migrateLegacyInterfaceScale(legacyPx);
    }
    return INTERFACE_SCALE_DEFAULT;
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
 * Applies the interface scale by setting the ROOT font-size (a % of the browser
 * base). All rem/Tailwind sizing follows, so the whole UI scales.
 */
export function applyInterfaceScale(percent: number): void {
    if (typeof document === "undefined") return;
    const p = resolveInterfaceScale(percent);
    document.documentElement.style.fontSize = `${p}%`;
}

/**
 * Applies the message text scale as a unitless multiplier on the root
 * (`--message-text-scale`, e.g. 120% -> "1.2"). Message bodies and the composer
 * read it in calc(); nothing else does, so the UI scale is not doubled.
 */
export function applyMessageTextScale(percent: number): void {
    if (typeof document === "undefined") return;
    const p = resolveMessageTextScale(percent);
    document.documentElement.style.setProperty(
        "--message-text-scale",
        String(p / 100),
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
