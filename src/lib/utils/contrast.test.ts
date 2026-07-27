import { describe, it, expect } from "vitest";
import {
    parseHexColor,
    relativeLuminance,
    contrastRatio,
    meetsAA,
} from "./contrast";

describe("parseHexColor", () => {
    it("parses 6-digit hex", () => {
        expect(parseHexColor("#36393f")).toEqual([54, 57, 63]);
    });

    it("parses 3-digit shorthand", () => {
        expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    });

    it("is case-insensitive and tolerates surrounding whitespace", () => {
        expect(parseHexColor("  #ED4245 ")).toEqual([237, 66, 69]);
    });

    it("returns null for junk", () => {
        expect(parseHexColor("rgba(0,0,0,0.5)")).toBeNull();
        expect(parseHexColor("#12345")).toBeNull();
        expect(parseHexColor("")).toBeNull();
    });
});

describe("relativeLuminance", () => {
    it("is 0 for black and 1 for white", () => {
        expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
        expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    });

    it("throws on an unparseable colour rather than returning NaN", () => {
        expect(() => relativeLuminance("nope")).toThrow();
    });
});

describe("contrastRatio", () => {
    it("gives the WCAG maximum of 21:1 for black on white", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    });

    it("gives 1:1 for a colour against itself", () => {
        expect(contrastRatio("#7289da", "#7289da")).toBeCloseTo(1, 5);
    });

    it("matches the canonical #777 on white value", () => {
        expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    });

    it("is symmetric — argument order does not matter", () => {
        expect(contrastRatio("#36393f", "#dcddde")).toBeCloseTo(
            contrastRatio("#dcddde", "#36393f"),
            10,
        );
    });

    it("scores the app's historic worst pair around 1.5:1", () => {
        // The pre-fix --discord-text-muted on --discord-bg. Kept as literals so
        // this stays true after the token values change.
        const ratio = contrastRatio("#4f545c", "#36393f");
        expect(ratio).toBeGreaterThan(1.4);
        expect(ratio).toBeLessThan(1.7);
    });
});

describe("meetsAA", () => {
    it("requires 4.5:1 for normal text", () => {
        expect(meetsAA({ ratio: 4.5 })).toBe(true);
        expect(meetsAA({ ratio: 4.49 })).toBe(false);
    });

    it("requires only 3:1 for large text", () => {
        expect(meetsAA({ ratio: 3, large: true })).toBe(true);
        expect(meetsAA({ ratio: 2.99, large: true })).toBe(false);
    });
});
