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
 * There is deliberately NO per-pair threshold override. This list used to
 * carry an `accept` escape (plus a `why` note) that four pairs set to 3,
 * which meant the suite *certified* sub-AA text while looking green — the
 * substance of audit finding A11Y-10. The palette now separates fill from
 * text (see the `*-fill` / `*-text` tokens in app.css), so every pair here
 * clears AA_NORMAL. Re-introducing an escape has to be a visible edit to
 * this harness, not a one-line property on an entry.
 */
const PAIRS: {
    fg: string;
    bg: string;
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
    // White label on a filled brand/danger surface (primary buttons, badges).
    // These render as `text-sm font-semibold` button captions, which WCAG
    // counts as normal text — 4.5:1, not 3:1. They point at the `*-fill`
    // tokens, NOT at `--discord-accent` / `--discord-danger`: the brand values
    // stay put for borders, rings, focus outlines and alpha tints.
    { fg: "#ffffff", bg: "--discord-accent-fill-rgb" },
    { fg: "#ffffff", bg: "--discord-accent-fill-hover-rgb" },
    { fg: "#ffffff", bg: "--discord-danger-fill-rgb" },
    { fg: "#ffffff", bg: "--discord-danger-fill-hover-rgb" },
    // The same hues used as TEXT (destructive labels, error text, "Leave
    // room", failed-send notices; `.message-body a` links and active labels),
    // on every surface they can land on. This is the direction the suite never
    // tested, and the one the dark theme was failing silently — accent-as-text
    // was 3.48:1 on --discord-bg and nothing asserted it.
    //
    // --discord-bg-hover is in the list because a message row IS one of these
    // surfaces: hovering a message swaps its background to --discord-bg-hover
    // while the link inside keeps its colour. Without this pair the suite would
    // certify the resting link and say nothing about the hovered one.
    //
    // A single token cannot serve both directions: white-on-accent wants the
    // hue DARKER, accent-as-text wants it LIGHTER. Hence the split.
    { fg: "--discord-accent-text", bg: "--discord-bg" },
    { fg: "--discord-accent-text", bg: "--discord-bg-secondary" },
    { fg: "--discord-accent-text", bg: "--discord-bg-tertiary" },
    { fg: "--discord-accent-text", bg: "--discord-bg-hover" },
    { fg: "--discord-danger-text", bg: "--discord-bg" },
    { fg: "--discord-danger-text", bg: "--discord-bg-secondary" },
    { fg: "--discord-danger-text", bg: "--discord-bg-tertiary" },
    { fg: "--discord-danger-text", bg: "--discord-bg-hover" },
];

/** Tokens that exist twice: a hex form and an `R G B` form for Tailwind. */
const RGB_TWINS: [string, string][] = [
    ["--discord-bg", "--discord-bg-rgb"],
    ["--discord-bg-secondary", "--discord-bg-secondary-rgb"],
    ["--discord-accent", "--discord-accent-rgb"],
    ["--discord-accent-hover", "--discord-accent-hover-rgb"],
    ["--discord-danger", "--discord-danger-rgb"],
    ["--discord-warning", "--discord-warning-rgb"],
    // Contrast-split tokens (A11Y-10). The PAIRS entries above assert the
    // fills through their `-rgb` form and the text tokens through their hex
    // form, so without these twins a typo in one form would go unnoticed.
    ["--discord-accent-fill", "--discord-accent-fill-rgb"],
    ["--discord-accent-fill-hover", "--discord-accent-fill-hover-rgb"],
    ["--discord-accent-text", "--discord-accent-text-rgb"],
    ["--discord-danger-fill", "--discord-danger-fill-rgb"],
    ["--discord-danger-fill-hover", "--discord-danger-fill-hover-rgb"],
    ["--discord-danger-text", "--discord-danger-text-rgb"],
];

function colourOf(vars: Record<string, string>, ref: string): string {
    if (ref.startsWith("#")) return ref;
    const hex = resolveTokenToHex(vars, ref);
    if (!hex) throw new Error(`token did not resolve to a colour: ${ref}`);
    return hex;
}

/**
 * Declarations of hand-written rules whose selector starts with `prefix`.
 *
 * PAIRS pins what a *token* is worth. It cannot see which token a rule picks,
 * and that gap shipped: `.message-body a` — the app's most numerous
 * accent-as-text surface — declared `color: var(--discord-accent)` (3.48:1 in
 * the dark theme) while this suite certified `--discord-accent-text` at 4.61
 * and its comment claimed to cover links. Asserting the rule, not just the
 * token, is what makes reverting that colour go red. Rules reached through a
 * Tailwind utility need no equivalent: the utility resolves to the token the
 * config points at, which PAIRS already covers.
 */
function rulesStartingWith(
    prefix: string,
    source: string = css,
): { selector: string; props: Record<string, string> }[] {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    const found: { selector: string; props: Record<string, string> }[] = [];
    let m: RegExpExecArray | null;
    while ((m = rule.exec(withoutComments)) !== null) {
        const selector = m[1].trim();
        if (!selector.startsWith(prefix)) continue;
        const props: Record<string, string> = {};
        const decl = /([-\w]+)\s*:\s*([^;]+)/g;
        let d: RegExpExecArray | null;
        while ((d = decl.exec(m[2])) !== null) props[d[1]] = d[2].trim();
        found.push({ selector, props });
    }
    return found;
}

/**
 * The body of the at-rule whose prelude (up to and including its `{`) matches
 * `preludePattern`, brace-balanced so nested rules come back intact.
 *
 * `rulesStartingWith` cannot see an at-rule's prelude — its selector pattern
 * excludes `{`, so it silently skips straight past `@media (…)` and returns the
 * rules *inside* as though they were top level. That is fine for reading a
 * rule, and useless for asserting that a media query still exists. Returns null
 * when the block is absent so the caller can fail on that explicitly.
 */
function atRuleBody(preludePattern: RegExp): string | null {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const m = preludePattern.exec(withoutComments);
    if (!m) return null;
    let depth = 0;
    const open = m.index + m[0].length - 1; // the `{` the pattern ends on
    for (let i = open; i < withoutComments.length; i++) {
        if (withoutComments[i] === "{") depth++;
        else if (withoutComments[i] === "}") {
            depth--;
            if (depth === 0) return withoutComments.slice(open + 1, i);
        }
    }
    return null; // unbalanced — treat as absent
}

/** A declared CSS value as something `colourOf` can resolve. */
function refOf(value: string): string {
    const v = value.trim();
    const varRef = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
    if (varRef) return varRef[1];
    if (v === "white") return "#ffffff";
    if (v === "black") return "#000000";
    return v; // a literal hex, or something colourOf will reject loudly
}

/** Surfaces a `.message-body` can sit on: timeline, panels, and row hover. */
const MESSAGE_SURFACES = [
    "--discord-bg",
    "--discord-bg-secondary",
    "--discord-bg-hover",
];

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
                const label = `${pair.fg} on ${pair.bg} clears ${AA_NORMAL}:1`;
                it(label, () => {
                    const fg = colourOf(theme.vars, pair.fg);
                    const bg = colourOf(theme.vars, pair.bg);
                    const ratio = contrastRatio(fg, bg);
                    expect(
                        ratio >= AA_NORMAL,
                        `${pair.fg} (${fg}) on ${pair.bg} (${bg}) is ${ratio.toFixed(2)}:1, needs ${AA_NORMAL}:1`,
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

            // A token that clears AA proves nothing if the rule points
            // somewhere else. `.message-body a` is the app's most numerous
            // accent-as-text surface — every hyperlink in every message — and
            // it is written by hand in app.css rather than reached through a
            // Tailwind utility, so nothing above can see which token it uses.
            // Both the resting rule and any :hover rule are covered: a hover
            // shade that does not itself clear AA is the same defect.
            it("gives .message-body links an AA colour on every message surface", () => {
                const rules = rulesStartingWith(".message-body a").filter(
                    (r) => r.props.color,
                );
                expect(
                    rules.length,
                    "no `color:` declaration found for `.message-body a` in app.css — that means this parser stopped matching, not that the palette is fine",
                ).toBeGreaterThan(0);
                for (const { selector, props } of rules) {
                    const ref = refOf(props.color);
                    const fg = colourOf(theme.vars, ref);
                    for (const surface of MESSAGE_SURFACES) {
                        const bg = colourOf(theme.vars, surface);
                        const ratio = contrastRatio(fg, bg);
                        expect(
                            ratio >= AA_NORMAL,
                            `${selector} { color: ${ref} } resolves to ${fg}, which is ${ratio.toFixed(2)}:1 on ${surface} (${bg}) in the ${theme.name} theme — needs ${AA_NORMAL}:1`,
                        ).toBe(true);
                    }
                }
            });

            // Same class of gap, same fix: ::selection paints its own
            // foreground AND background, so it is self-contained and neither
            // half is reached through a Tailwind utility. It shipped
            // `background-color: var(--discord-accent)` under white text —
            // 3.33:1 in the dark theme, i.e. selecting text made it HARDER to
            // read — while PAIRS certified the fill token it was not using.
            it("keeps ::selection readable", () => {
                // Exact, not prefix: `::selection-anything` is a different
                // rule and must not satisfy this assertion.
                const matches = rulesStartingWith("::selection").filter(
                    (r) => r.selector === "::selection",
                );
                expect(
                    matches.length,
                    "expected exactly one `::selection` rule in app.css — 0 means this parser stopped matching, not that the palette is fine",
                ).toBe(1);
                const rule = matches[0];
                const fg = colourOf(theme.vars, refOf(rule.props.color));
                const bg = colourOf(
                    theme.vars,
                    refOf(rule.props["background-color"]),
                );
                const ratio = contrastRatio(fg, bg);
                expect(
                    ratio >= AA_NORMAL,
                    `::selection paints ${fg} on ${bg} — ${ratio.toFixed(2)}:1 in the ${theme.name} theme, needs ${AA_NORMAL}:1`,
                ).toBe(true);
            });

            // Third instance of the same gap, and the one the fill/text split
            // exists FOR: `.btn-primary` is the canonical white-on-accent
            // surface, hand-written in app.css rather than reached through a
            // Tailwind utility. PAIRS certifies `#fff` on the `*-fill` tokens,
            // but nothing saw which token this rule picks — reverting it to
            // `var(--discord-accent)` (3.33:1 under white in the dark theme)
            // kept the whole suite green. Both the declared token and the
            // resolved ratio are pinned: the token name catches a silent
            // re-point even if someone later retunes the brand hue to pass,
            // and the ratio catches a retune of the fill token itself.
            it("keeps .btn-primary's white caption readable", () => {
                const rules = rulesStartingWith(".btn-primary");
                // Exact selectors: `.btn-primary-subtle` is a different rule
                // and must not be able to satisfy this assertion.
                const base = rules.filter((r) => r.selector === ".btn-primary");
                const hover = rules.filter(
                    (r) => r.selector === ".btn-primary:hover",
                );
                expect(
                    base.length,
                    "expected exactly one `.btn-primary` rule in app.css — 0 means this parser stopped matching, not that the button is fine",
                ).toBe(1);
                expect(
                    hover.length,
                    "expected exactly one `.btn-primary:hover` rule in app.css — 0 means this parser stopped matching, not that the button is fine",
                ).toBe(1);

                expect(
                    base[0].props["background-color"],
                    "`.btn-primary` must consume the contrast-split FILL token, not the brand hue",
                ).toBe("var(--discord-accent-fill)");
                expect(
                    hover[0].props["background-color"],
                    "`.btn-primary:hover` must consume the contrast-split FILL token, not the brand hue",
                ).toBe("var(--discord-accent-fill-hover)");

                // `:hover` inherits the caption colour from the base rule.
                const fg = colourOf(theme.vars, refOf(base[0].props.color));
                for (const rule of [base[0], hover[0]]) {
                    const bgRef = refOf(rule.props["background-color"]);
                    const bg = colourOf(theme.vars, bgRef);
                    const ratio = contrastRatio(fg, bg);
                    expect(
                        ratio >= AA_NORMAL,
                        `${rule.selector} paints ${fg} on ${bgRef} (${bg}) — ${ratio.toFixed(2)}:1 in the ${theme.name} theme, needs ${AA_NORMAL}:1`,
                    ).toBe(true);
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

/**
 * Task 2's headline deliverable is a single CSS block, and `motionPreference.ts`
 * only covers the JS half (scroll `behavior`). Deleting the whole media query
 * left all 1844 tests green. These two assertions are what makes that go red.
 *
 * They pin structure and intent, not tuning: that the query exists, that the
 * blanket collapse is still declared on the universal selector, and that the
 * spinner carve-out still opts back out of it. Retuning 1.5s to 2s is allowed;
 * losing the carve-out (a still spinner reads as a hung app — rubric item 5) is
 * not.
 */
describe("app.css reduced motion", () => {
    const REDUCED_MOTION =
        /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/;
    const COLLAPSED_DURATION = "0.01ms !important";

    it("collapses non-essential animation and scrolling", () => {
        const block = atRuleBody(REDUCED_MOTION);
        expect(
            block,
            "no `@media (prefers-reduced-motion: reduce)` block in app.css — the reduced-motion deliverable is gone, or this matcher stopped matching",
        ).not.toBeNull();

        const universal = rulesStartingWith("*", block ?? "").filter((r) =>
            r.selector
                .split(",")
                .map((s) => s.trim())
                .includes("*"),
        );
        expect(
            universal.length,
            "expected exactly one universal-selector rule inside the reduced-motion block — 0 means the blanket override is gone",
        ).toBe(1);

        const props = universal[0].props;
        expect(props["animation-duration"]).toBe(COLLAPSED_DURATION);
        expect(props["transition-duration"]).toBe(COLLAPSED_DURATION);
        expect(props["animation-iteration-count"]).toBe("1 !important");
        expect(props["scroll-behavior"]).toBe("auto !important");
    });

    it("carves .animate-spin out so spinners still convey progress", () => {
        const block = atRuleBody(REDUCED_MOTION);
        expect(block, "no reduced-motion block to carve out of").not.toBeNull();

        const spin = rulesStartingWith(".animate-spin", block ?? "").filter(
            (r) => r.selector === ".animate-spin",
        );
        expect(
            spin.length,
            "expected exactly one `.animate-spin` rule inside the reduced-motion block — 0 means spinners now freeze, which is indistinguishable from a hung app",
        ).toBe(1);

        expect(spin[0].props["animation-iteration-count"]).toBe(
            "infinite !important",
        );
        // A duration is re-declared, and it is NOT the collapsed one — a
        // spinner that completes a turn every 0.01ms is a blur, not progress.
        expect(spin[0].props["animation-duration"]).toMatch(
            /^[\d.]+m?s !important$/,
        );
        expect(spin[0].props["animation-duration"]).not.toBe(
            COLLAPSED_DURATION,
        );
    });
});
