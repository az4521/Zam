import { describe, it, expect } from "vitest";
import { encodeThemePreset, decodeThemePreset } from "./themeShare";

describe("theme share round-trip", () => {
    it("encodes with the zam-theme: prefix", () => {
        expect(
            encodeThemePreset({
                name: "Sunset",
                base: "dark",
                colors: { accent: "#ff8800" },
            }),
        ).toMatch(/^zam-theme:/);
    });
    it("round-trips name + colors", () => {
        const code = encodeThemePreset({
            name: "Sun 🌅",
            base: "dark",
            colors: { accent: "#ff8800", background: "#101010" },
        });
        expect(decodeThemePreset(code)).toEqual({
            name: "Sun 🌅",
            base: "dark",
            colors: { accent: "#ff8800", background: "#101010" },
        });
    });
    it("round-trips base (dark/light/amoled)", () => {
        const darkCode = encodeThemePreset({
            base: "dark",
            colors: { accent: "#111" },
        });
        expect(decodeThemePreset(darkCode)).toEqual({
            base: "dark",
            colors: { accent: "#111111" },
        });

        const lightCode = encodeThemePreset({
            base: "light",
            colors: { accent: "#fff" },
        });
        expect(decodeThemePreset(lightCode)).toEqual({
            base: "light",
            colors: { accent: "#ffffff" },
        });

        const amoledCode = encodeThemePreset({
            base: "amoled",
            colors: { background: "#000" },
        });
        expect(decodeThemePreset(amoledCode)).toEqual({
            base: "amoled",
            colors: { background: "#000000" },
        });
    });
    it("defaults missing base to dark", () => {
        const code =
            "zam-theme:" +
            btoa(JSON.stringify({ v: 1, colors: { accent: "#abcdef" } }));
        expect(decodeThemePreset(code)).toEqual({
            base: "dark",
            colors: { accent: "#abcdef" },
        });
    });
    it("defaults invalid base to dark", () => {
        const code =
            "zam-theme:" +
            btoa(
                JSON.stringify({
                    v: 1,
                    base: "invalid",
                    colors: { accent: "#123456" },
                }),
            );
        expect(decodeThemePreset(code)).toEqual({
            base: "dark",
            colors: { accent: "#123456" },
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
            base: "dark",
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
            "  " +
            encodeThemePreset({
                base: "light",
                colors: { accent: "#abcdef" },
            }) +
            "\n";
        const decoded = decodeThemePreset(code);
        expect(decoded?.base).toBe("light");
        expect(decoded?.colors).toEqual({ accent: "#abcdef" });
    });
});
