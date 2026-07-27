// @vitest-environment node
// Reads app.css off disk; under the default jsdom environment `import.meta.url`
// is an http:// URL and fileURLToPath() throws "The URL must be of scheme file".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, meetsAA } from "./contrast";
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

/**
 * fg/bg are either a token name (resolved per theme) or a literal hex.
 * `large: true` means the 3:1 threshold.
 */
const PAIRS: {
    fg: string;
    bg: string;
    large?: boolean;
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
    // White on the accent/danger fills. Asserted at the 3:1 (large/non-text)
    // threshold, NOT 4.5:1: clearing 4.5 needs the brand blurple darkened to
    // ~#5c6fb1 and the danger red darkened until `text-discord-danger` stops
    // being legible on the dark background. Both are Zam identity changes and
    // are out of scope here. Raise these to 4.5 only together with a
    // deliberate brand decision.
    {
        fg: "#ffffff",
        bg: "--discord-accent-rgb",
        large: true,
        why: "brand blurple fill",
    },
    {
        fg: "#ffffff",
        bg: "--discord-danger-rgb",
        large: true,
        why: "danger fill",
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
        expect(Object.keys(darkVars).length).toBeGreaterThan(50);
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
                const threshold = pair.large ? 3 : 4.5;
                const label = `${pair.fg} on ${pair.bg} clears ${threshold}:1${
                    pair.why ? ` (${pair.why})` : ""
                }`;
                it(label, () => {
                    const fg = colourOf(theme.vars, pair.fg);
                    const bg = colourOf(theme.vars, pair.bg);
                    const ratio = contrastRatio(fg, bg);
                    expect(
                        meetsAA({ ratio, large: pair.large }),
                        `${pair.fg} (${fg}) on ${pair.bg} (${bg}) is ${ratio.toFixed(2)}:1, needs ${threshold}:1`,
                    ).toBe(true);
                });
            }

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
