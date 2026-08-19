import { describe, it, expect } from "vitest";
import { encodeThemePreset, decodeThemePreset } from "./themeShare";

describe("theme share round-trip", () => {
    it("encodes with the zam-theme: prefix", () => {
        expect(
            encodeThemePreset({
                name: "Sunset",
                colors: { accent: "#ff8800" },
            }),
        ).toMatch(/^zam-theme:/);
    });
    it("round-trips name + colors", () => {
        const code = encodeThemePreset({
            name: "Sun 🌅",
            colors: { accent: "#ff8800", background: "#101010" },
        });
        expect(decodeThemePreset(code)).toEqual({
            name: "Sun 🌅",
            colors: { accent: "#ff8800", background: "#101010" },
        });
    });
    it("sanitizes decoded colors (drops junk keys/values)", () => {
        const code =
            "zam-theme:" +
            btoa(
                JSON.stringify({
                    v: 1,
                    colors: { accent: "#FFF", bogus: "#fff", danger: "x" },
                }),
            );
        expect(decodeThemePreset(code)).toEqual({
            colors: { accent: "#ffffff" },
        });
    });
    it("returns null on a missing/wrong prefix", () => {
        expect(decodeThemePreset("nope")).toBeNull();
        expect(decodeThemePreset(btoa("{}"))).toBeNull();
    });
    it("returns null on malformed base64/JSON", () => {
        expect(decodeThemePreset("zam-theme:!!!not-base64!!!")).toBeNull();
        expect(decodeThemePreset("zam-theme:" + btoa("not json"))).toBeNull();
    });
    it("returns null when no valid colors remain", () => {
        expect(
            decodeThemePreset(
                "zam-theme:" +
                    btoa(JSON.stringify({ v: 1, colors: { bogus: "#fff" } })),
            ),
        ).toBeNull();
    });
    it("trims surrounding whitespace before decoding", () => {
        const code =
            "  " + encodeThemePreset({ colors: { accent: "#abcdef" } }) + "\n";
        expect(decodeThemePreset(code)?.colors).toEqual({ accent: "#abcdef" });
    });
});
