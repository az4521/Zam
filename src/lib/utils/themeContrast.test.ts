// @vitest-environment node
// Reads app.css off disk; under the default jsdom environment `import.meta.url`
// is an http:// URL and fileURLToPath() throws "The URL must be of scheme file".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, relativeLuminance } from "./contrast";
import { extractCssVariables, resolveTokenToHex } from "./themeTokens";

const css = readFileSync(
    fileURLToPath(new URL("../../app.css", import.meta.url)),
    "utf8",
);

const darkVars = extractCssVariables(css, ":root");
const lightOnlyVars = extractCssVariables(css, ':root[data-theme="light"]');
const lightVars = {
    // The light block only redeclares a subset; everything else cascades from
    // :root, exactly as the browser resolves it.
    ...darkVars,
    ...lightOnlyVars,
};

const THEMES = [
    { name: "dark", vars: darkVars },
    { name: "light", vars: lightVars },
] as const;

/** Every pair must clear WCAG AA for normal text unless it declares otherwise. */
const AA_NORMAL = 4.5;

/**
 * fg/bg are either a token name (resolved per theme) or a literal hex.
 *
 * `accept` is the ratio this pair is asserted at, defaulting to 4.5. Lowering
 * it to 3 is an explicit, documented exception for a pair the palette cannot
 * currently satisfy — it is NOT a WCAG "large text" claim, and every such
 * entry must say in `why` what would have to change to reach 4.5.
 */
const PAIRS: {
    fg: string;
    bg: string;
    accept?: number;
    why?: string;
}[] = [
    // The two text tokens this item exists to fix.
    { fg: "--discord-text-muted", bg: "--discord-bg" },
    { fg: "--discord-text-muted", bg: "--discord-bg-secondary" },
    { fg: "--discord-text-muted", bg: "--discord-bg-hover" },
    { fg: "--discord-text-muted", bg: "--discord-bg-tertiary" },
    { fg: "--discord-text-secondary", bg: "--discord-bg-secondary" },
    { fg: "--discord-text-secondary", bg: "--discord-bg" },
    // Body text, already fine — pinned so a future palette edit cannot break it.
    { fg: "--discord-text-primary", bg: "--discord-bg" },
    { fg: "--discord-text-primary", bg: "--discord-bg-secondary" },
    // White on the accent/danger fills. Accepted at 3:1, NOT 4.5:1 — and NOT
    // because the text is large (these render as `text-sm font-semibold`
    // button captions, which WCAG counts as normal text). Clearing 4.5 needs
    // the brand blurple darkened to ~#5c6fb1 and the danger red darkened until
    // `text-discord-danger` stops being legible on the dark background. Both
    // are Zam identity changes and are out of scope here. Raise these to 4.5
    // only together with a deliberate brand decision.
    {
        fg: "#ffffff",
        bg: "--discord-accent-rgb",
        accept: 3,
        why: "brand blurple fill; 4.5 needs the blurple darkened — brand decision",
    },
    {
        fg: "#ffffff",
        bg: "--discord-danger-rgb",
        accept: 3,
        why: "danger fill; 4.5 needs the red darkened — brand decision",
    },
    // `text-discord-danger` as a FOREGROUND (destructive labels, error text,
    // "Leave room", failed-send notices). Accepted at 3:1 so the shortfall is
    // declared rather than silent: 4.5:1 is unreachable for this token as it
    // stands, because the very same `--discord-danger` is also a FILL under
    // white text (asserted above). Darkening it far enough for 4.5:1 against
    // the dark background is exactly the direction that breaks white-on-fill,
    // and lightening it breaks the reverse. Reaching AA here needs a separate
    // `--discord-danger-text` token — a palette decision for the repo owner,
    // deliberately not taken on this branch.
    {
        fg: "--discord-danger",
        bg: "--discord-bg",
        accept: 3,
        why: "danger as text; 4.5 unreachable — same token is a fill under white text, needs a separate dangerText token",
    },
    {
        fg: "--discord-danger",
        bg: "--discord-bg-secondary",
        accept: 3,
        why: "danger as text; 4.5 unreachable — same token is a fill under white text, needs a separate dangerText token",
    },
];

/** Tokens that exist twice: a hex form and an `R G B` form for Tailwind. */
const RGB_TWINS: [string, string][] = [
    ["--discord-bg", "--discord-bg-rgb"],
    ["--discord-bg-secondary", "--discord-bg-secondary-rgb"],
    ["--discord-accent", "--discord-accent-rgb"],
    ["--discord-accent-hover", "--discord-accent-hover-rgb"],
    ["--discord-danger", "--discord-danger-rgb"],
    ["--discord-warning", "--discord-warning-rgb"],
];

function colourOf(vars: Record<string, string>, ref: string): string {
    if (ref.startsWith("#")) return ref;
    const hex = resolveTokenToHex(vars, ref);
    if (!hex) throw new Error(`token did not resolve to a colour: ${ref}`);
    return hex;
}

describe("app.css palette", () => {
    it("parses tokens out of both theme blocks", () => {
        // Sanity guard that the :root block parsed at all, not a census. The
        // floor was 50 until fix/light-theme-escapes deleted the ~47-strong
        // dead `--brand-*` ramp; 40 still catches a selector typo (which would
        // yield 0) without pinning the palette's exact size.
        expect(Object.keys(darkVars).length).toBeGreaterThan(40);
        expect(resolveTokenToHex(darkVars, "--discord-bg")).toBe("#36393f");
        expect(resolveTokenToHex(lightVars, "--discord-bg")).toBe("#f2f3f5");
        // A mis-typed light selector would make {...dark, ...light} collapse to
        // dark, and every "light theme" assertion below would silently re-test
        // the dark one. Pin that the light block really parsed.
        expect(Object.keys(lightOnlyVars).length).toBeGreaterThan(20);
    });

    for (const theme of THEMES) {
        describe(`${theme.name} theme`, () => {
            for (const pair of PAIRS) {
                const threshold = pair.accept ?? AA_NORMAL;
                const label = `${pair.fg} on ${pair.bg} clears ${threshold}:1${
                    pair.why ? ` (${pair.why})` : ""
                }`;
                it(label, () => {
                    const fg = colourOf(theme.vars, pair.fg);
                    const bg = colourOf(theme.vars, pair.bg);
                    const ratio = contrastRatio(fg, bg);
                    expect(
                        ratio >= threshold,
                        `${pair.fg} (${fg}) on ${pair.bg} (${bg}) is ${ratio.toFixed(2)}:1, needs ${threshold}:1`,
                    ).toBe(true);
                });
            }

            // A ratio floor on its own cannot protect the design: setting
            // --discord-text-muted to #ffffff would satisfy every PAIRS
            // assertion above while flattening the three-step text ramp and
            // destroying de-emphasis. Pin the ordering itself, not just the
            // ratios — in the dark theme less important means darker, in the
            // light theme it means lighter.
            it("keeps the muted → secondary → primary brightness ramp", () => {
                const mutedHex = colourOf(theme.vars, "--discord-text-muted");
                const secondaryHex = colourOf(
                    theme.vars,
                    "--discord-text-secondary",
                );
                const primaryHex = colourOf(
                    theme.vars,
                    "--discord-text-primary",
                );
                const muted = relativeLuminance(mutedHex);
                const secondary = relativeLuminance(secondaryHex);
                const primary = relativeLuminance(primaryHex);

                const ramp =
                    `--discord-text-muted (${mutedHex}) L=${muted.toFixed(4)}, ` +
                    `--discord-text-secondary (${secondaryHex}) L=${secondary.toFixed(4)}, ` +
                    `--discord-text-primary (${primaryHex}) L=${primary.toFixed(4)}`;

                if (theme.name === "dark") {
                    expect(
                        muted,
                        `dark theme: muted must be DARKER than secondary — ${ramp}`,
                    ).toBeLessThan(secondary);
                    expect(
                        secondary,
                        `dark theme: secondary must be DARKER than primary — ${ramp}`,
                    ).toBeLessThan(primary);
                } else {
                    expect(
                        muted,
                        `light theme: muted must be LIGHTER than secondary — ${ramp}`,
                    ).toBeGreaterThan(secondary);
                    expect(
                        secondary,
                        `light theme: secondary must be LIGHTER than primary — ${ramp}`,
                    ).toBeGreaterThan(primary);
                }
            });

            for (const [hexToken, rgbToken] of RGB_TWINS) {
                it(`${rgbToken} matches ${hexToken}`, () => {
                    const asHex = colourOf(theme.vars, hexToken);
                    const asRgb = colourOf(theme.vars, rgbToken);
                    expect(
                        asRgb,
                        `${rgbToken} resolves to ${asRgb} but ${hexToken} is ${asHex} — the Tailwind token and the raw var disagree in the ${theme.name} theme`,
                    ).toBe(asHex);
                });
            }
        });
    }
});
