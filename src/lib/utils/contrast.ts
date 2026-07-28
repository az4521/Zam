/**
 * WCAG 2.1 contrast maths on hex colours. Pure: no DOM, no imports.
 *
 * Used both by the theme regression test (which asserts every declared
 * foreground/background token pair clears AA in both themes) and by anything
 * that needs to reason about a colour at runtime.
 *
 * Spec: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/** `#rgb` / `#rrggbb` → `[r, g, b]` in 0–255, or null if it isn't a hex colour. */
export function parseHexColor(hex: string): [number, number, number] | null {
    const raw = hex.trim().replace(/^#/, "");
    if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return null;
    const full =
        raw.length === 3
            ? raw
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : raw;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}

/** sRGB channel (0–255) → linear-light value. */
function linearize(channel: number): number {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) → 1 (white). Throws on a bad colour. */
export function relativeLuminance(hex: string): number {
    const rgb = parseHexColor(hex);
    if (!rgb) throw new Error(`relativeLuminance: not a hex colour: ${hex}`);
    const [r, g, b] = rgb.map(linearize);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 → 21. Symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * AA verdict. `large` = ≥18.66px bold or ≥24px text, which WCAG lets pass at
 * 3:1; it is also the threshold WCAG uses for non-text UI components.
 */
export function meetsAA({
    ratio,
    large = false,
}: {
    ratio: number;
    large?: boolean;
}): boolean {
    return ratio >= (large ? AA_LARGE : AA_NORMAL);
}
