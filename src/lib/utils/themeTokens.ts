/**
 * Read the design tokens straight out of a CSS text blob.
 *
 * `src/app.css` declares a token three ways: a literal hex, an indirection
 * (`var(--brand-500)`), and a bare `R G B` triplet for Tailwind's
 * `<alpha-value>` support. Flattening all three to hex is what lets a unit
 * test assert the palette actually clears WCAG AA. Pure: no DOM, no fs.
 */

const MAX_VAR_HOPS = 10;

function escapeRegExp(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Custom properties declared in the block for `selector`.
 *
 * The selector must match exactly: asking for `:root` will NOT also pick up
 * `:root[data-theme="light"]`, because the pattern requires the selector to be
 * followed directly by `{`.
 */
export function extractCssVariables(
    css: string,
    selector: string,
): Record<string, string> {
    const block = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(
        css,
    );
    if (!block) return {};
    const vars: Record<string, string> = {};
    const decl = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = decl.exec(block[1])) !== null) {
        vars[m[1]] = m[2].trim();
    }
    return vars;
}

function tripletToHex(value: string): string | null {
    const parts = value.trim().split(/[\s,]+/);
    if (parts.length !== 3) return null;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    return `#${nums.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Flatten `name` to a lowercase `#rrggbb`, following `var()` hops.
 * Returns null for anything that is not a flat colour (rgba(), gradients,
 * undeclared names, or a var cycle).
 */
export function resolveTokenToHex(
    vars: Record<string, string>,
    name: string,
): string | null {
    let value: string | undefined = vars[name];
    for (let hop = 0; hop < MAX_VAR_HOPS; hop++) {
        if (value === undefined) return null;
        const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
        if (!ref) break;
        value = vars[ref[1]];
    }
    if (value === undefined) return null;
    if (/^var\(/.test(value.trim())) return null; // hop limit hit — cycle

    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
    if (hex) {
        const raw = hex[1];
        const full =
            raw.length === 3
                ? raw
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : raw;
        return `#${full.toLowerCase()}`;
    }
    return tripletToHex(value);
}
