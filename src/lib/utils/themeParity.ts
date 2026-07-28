/**
 * Pure helpers for auditing the theme tokens in `src/app.css`.
 *
 * The light theme is implemented purely as a second custom-property block
 * (`:root[data-theme="light"]`) that re-declares the dark `:root` values. A
 * token declared in dark and forgotten in light silently keeps its dark
 * value in light mode — a whole class of bug that is invisible in review.
 *
 * No CSS parser dependency: the blocks we care about are flat lists of
 * `--name: value;` declarations, so a scan is enough (and stays honest —
 * it deliberately understands nothing about nesting or at-rules).
 */

/** Strip `/* … *\/` comments so commented-out declarations do not count. */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Return the custom properties declared directly inside the first block
 * whose selector matches `selector` exactly (whitespace-insensitive).
 * Returns an empty map when the selector is absent.
 */
export function parseCssVariableBlock(
    css: string,
    selector: string,
): Map<string, string> {
    const out = new Map<string, string>();
    const source = stripComments(css);
    const wanted = selector.replace(/\s+/g, "");

    let cursor = 0;
    while (cursor < source.length) {
        const open = source.indexOf("{", cursor);
        if (open === -1) break;
        const close = source.indexOf("}", open);
        if (close === -1) break;

        const head = source.slice(cursor, open);
        // The selector is whatever follows the previous block/declaration.
        const found = head.slice(head.lastIndexOf("}") + 1).replace(/\s+/g, "");
        if (found === wanted) {
            for (const line of source.slice(open + 1, close).split(";")) {
                const colon = line.indexOf(":");
                if (colon === -1) continue;
                const name = line.slice(0, colon).trim();
                if (!name.startsWith("--")) continue;
                out.set(name, line.slice(colon + 1).trim());
            }
            return out;
        }
        cursor = close + 1;
    }
    return out;
}

export interface MissingLightOverridesOptions {
    /** Defaults to `:root`. */
    selectorDark?: string;
    /** Defaults to `:root[data-theme="light"]`. */
    selectorLight?: string;
    /** Only tokens starting with one of these are audited. */
    prefixes: string[];
    /** Tokens that are deliberately dark-only. */
    allowMissing: string[];
}

/**
 * Themed tokens declared in the dark block that the light block never
 * overrides, minus `allowMissing`. Sorted, so the failure message is stable.
 */
export function missingLightOverrides(
    css: string,
    opts: MissingLightOverridesOptions,
): string[] {
    const dark = parseCssVariableBlock(css, opts.selectorDark ?? ":root");
    const light = parseCssVariableBlock(
        css,
        opts.selectorLight ?? ':root[data-theme="light"]',
    );
    const allowed = new Set(opts.allowMissing);

    return [...dark.keys()]
        .filter((name) => opts.prefixes.some((p) => name.startsWith(p)))
        .filter((name) => !light.has(name) && !allowed.has(name))
        .sort();
}
