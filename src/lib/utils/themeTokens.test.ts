import { describe, it, expect } from "vitest";
import { extractCssVariables, resolveTokenToHex } from "./themeTokens";

const CSS = `
:root {
    color-scheme: dark;
    --brand-500: #7289da;
    --brand-500-rgb: 114 137 218;
    --zam-bg: #36393f;
    --zam-bg-rgb: 54 57 63;
    --zam-accent: var(--brand-500);
    --zam-accent-rgb: var(--brand-500-rgb);
    --zam-spoiler-revealed-bg: rgba(255, 255, 255, 0.1);
}

:root[data-theme="light"] {
    color-scheme: light;
    --zam-bg: #f2f3f5;
    --zam-bg-rgb: 242 243 245;
}
`;

describe("extractCssVariables", () => {
    it("reads only custom properties from the requested block", () => {
        const dark = extractCssVariables(CSS, ":root");
        expect(dark["--zam-bg"]).toBe("#36393f");
        expect(dark["--brand-500"]).toBe("#7289da");
        // plain properties are not custom properties
        expect(dark["color-scheme"]).toBeUndefined();
    });

    it("does not leak the light block into the :root block", () => {
        const dark = extractCssVariables(CSS, ":root");
        expect(dark["--zam-bg"]).toBe("#36393f");
    });

    it("reads the light block by its full selector", () => {
        const light = extractCssVariables(CSS, ':root[data-theme="light"]');
        expect(light["--zam-bg"]).toBe("#f2f3f5");
        // light only redeclares a subset — the rest is not present here
        expect(light["--brand-500"]).toBeUndefined();
    });

    it("returns an empty map for a selector that is not in the css", () => {
        expect(extractCssVariables(CSS, ".nope")).toEqual({});
    });
});

describe("resolveTokenToHex", () => {
    const dark = extractCssVariables(CSS, ":root");

    it("passes a literal hex through, normalised to lowercase 6-digit", () => {
        expect(resolveTokenToHex(dark, "--zam-bg")).toBe("#36393f");
    });

    it("follows a var() indirection", () => {
        expect(resolveTokenToHex(dark, "--zam-accent")).toBe("#7289da");
    });

    it("converts a bare RGB triplet to hex", () => {
        expect(resolveTokenToHex(dark, "--zam-bg-rgb")).toBe("#36393f");
    });

    it("follows a var() indirection that lands on a triplet", () => {
        expect(resolveTokenToHex(dark, "--zam-accent-rgb")).toBe("#7289da");
    });

    it("returns null for a value that is not a colour we can flatten", () => {
        expect(resolveTokenToHex(dark, "--zam-spoiler-revealed-bg")).toBeNull();
    });

    it("returns null for an undeclared token", () => {
        expect(resolveTokenToHex(dark, "--nope")).toBeNull();
    });

    it("does not loop forever on a self-referential var", () => {
        const looped = { "--a": "var(--b)", "--b": "var(--a)" };
        expect(resolveTokenToHex(looped, "--a")).toBeNull();
    });
});
