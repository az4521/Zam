import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCssVariableBlock, missingLightOverrides } from "./themeTokens";

const FIXTURE = `
@keyframes pulse {
    0% {
        opacity: 1;
    }
    100% {
        opacity: 0.5;
    }
}

:root {
    color-scheme: dark;
    /* a comment: --discord-ignored: #000; */
    --brand-500: #7289da;
    --discord-bg: #36393f;
    --discord-accent: var(--brand-500);
    --discord-danger-rgb: 237 66 69;
    --avatar-color-0: var(--brand-500);
}

:root[data-theme="light"] {
    color-scheme: light;
    --discord-bg: #f2f3f5;
    --discord-accent: #5865c7;
}
`;

describe("parseCssVariableBlock", () => {
    it("returns the custom properties declared in the named block", () => {
        const dark = parseCssVariableBlock(FIXTURE, ":root");
        expect(dark.get("--discord-bg")).toBe("#36393f");
        expect(dark.get("--discord-accent")).toBe("var(--brand-500)");
        expect(dark.size).toBe(5);
    });

    it("does not leak declarations from a different block", () => {
        const light = parseCssVariableBlock(
            FIXTURE,
            ':root[data-theme="light"]',
        );
        expect([...light.keys()].sort()).toEqual([
            "--discord-accent",
            "--discord-bg",
        ]);
    });

    it("ignores declarations inside comments", () => {
        const dark = parseCssVariableBlock(FIXTURE, ":root");
        expect(dark.has("--discord-ignored")).toBe(false);
    });

    it("returns an empty map for a selector that is not present", () => {
        expect(
            parseCssVariableBlock(FIXTURE, ":root[data-theme=oled]").size,
        ).toBe(0);
    });

    it("finds a block that follows nested at-rule sub-blocks", () => {
        // FIXTURE opens with an @keyframes whose percentage sub-blocks nest
        // braces — the shape the real app.css has. A brace scan that stops
        // surviving nesting would return an empty map for :root here, which
        // is precisely what makes the app.css guard below pass vacuously.
        const dark = parseCssVariableBlock(FIXTURE, ":root");
        expect(dark.size).toBe(5);
        expect(dark.get("--discord-bg")).toBe("#36393f");
        // The keyframes' own declarations must not leak in.
        expect(dark.has("opacity")).toBe(false);
    });
});

describe("missingLightOverrides", () => {
    it("reports a themed token the light block never overrides", () => {
        expect(
            missingLightOverrides(FIXTURE, {
                prefixes: ["--discord-"],
                allowMissing: [],
            }),
        ).toEqual(["--discord-danger-rgb"]);
    });

    it("honours the allow-list", () => {
        expect(
            missingLightOverrides(FIXTURE, {
                prefixes: ["--discord-"],
                allowMissing: ["--discord-danger-rgb"],
            }),
        ).toEqual([]);
    });

    it("only considers the prefixes it is given", () => {
        // --brand-500 is theme-invariant by design; --avatar-color-0 is opt-in.
        expect(
            missingLightOverrides(FIXTURE, {
                prefixes: ["--avatar-color-"],
                allowMissing: [],
            }),
        ).toEqual(["--avatar-color-0"]);
    });
});

describe("src/app.css light theme parity (regression guard)", () => {
    // Tokens the light theme deliberately does NOT override.
    //  - --avatar-color-*: identity colours, not chrome. Intentional.
    //  - --discord-danger-rgb / --discord-warning-rgb: a real gap, fixed on
    //    branch fix/contrast-and-colour-bugs (queue item 7). Listed here so
    //    this branch stays green on master; the entries are harmless once
    //    that branch merges (the check is "may be missing", not "must be").
    const ALLOW_MISSING = [
        "--discord-danger-rgb",
        "--discord-warning-rgb",
        "--avatar-color-0",
        "--avatar-color-1",
        "--avatar-color-2",
        "--avatar-color-3",
        "--avatar-color-4",
        "--avatar-color-5",
        "--avatar-color-6",
        "--avatar-color-7",
    ];

    it("declares a light-theme value for every themed token", () => {
        // NB: resolve via dirname(), not `new URL("…", import.meta.url)` —
        // Vite rewrites that literal pattern into an *asset* reference
        // ("http://localhost:3000/src/app.css"), and fileURLToPath then
        // throws "The URL must be of scheme file".
        const cssPath = resolve(
            dirname(fileURLToPath(import.meta.url)),
            "../../app.css",
        );
        const css = readFileSync(cssPath, "utf8");

        // Prove the dark block actually parsed BEFORE trusting the parity
        // assertion below. An unmatched `:root` yields an empty map, so
        // missingLightOverrides returns [] and the parity check goes green
        // while checking nothing at all. Reachable by ordinary edits to
        // app.css: grouping the selector (`:root, :host {`), adding a
        // "system" theme (`:root, :root[data-theme="dark"] {`), or putting a
        // semicolon at-rule immediately before the block. 94 dark props
        // today — 80 is a floor, not a target.
        expect(parseCssVariableBlock(css, ":root").size).toBeGreaterThan(80);

        expect(
            missingLightOverrides(css, {
                prefixes: ["--discord-", "--syntax-", "--avatar-color-"],
                allowMissing: ALLOW_MISSING,
            }),
        ).toEqual([]);
    });
});
