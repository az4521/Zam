import { describe, it, expect } from "vitest";
import { validateCustomFontFile, CUSTOM_FONT_MAX_BYTES } from "./customFont";

describe("validateCustomFontFile", () => {
    it("accepts .woff2 and derives a display name", () => {
        const r = validateCustomFontFile({
            name: "MyFont-Regular.woff2",
            size: 1000,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ext).toBe("woff2");
            expect(r.displayName).toBe("MyFont-Regular");
        }
    });
    it("accepts .ttf and .otf case-insensitively", () => {
        expect(validateCustomFontFile({ name: "A.TTF", size: 10 }).ok).toBe(
            true,
        );
        expect(validateCustomFontFile({ name: "b.otf", size: 10 }).ok).toBe(
            true,
        );
    });
    it("rejects a wrong extension", () => {
        const r = validateCustomFontFile({ name: "evil.png", size: 10 });
        expect(r.ok).toBe(false);
    });
    it("rejects a name with no extension", () => {
        expect(validateCustomFontFile({ name: "myfont", size: 10 }).ok).toBe(
            false,
        );
    });
    it("rejects an empty (0-byte) file", () => {
        expect(validateCustomFontFile({ name: "a.woff2", size: 0 }).ok).toBe(
            false,
        );
    });
    it("accepts exactly the size cap and rejects one byte over", () => {
        expect(
            validateCustomFontFile({
                name: "a.woff2",
                size: CUSTOM_FONT_MAX_BYTES,
            }).ok,
        ).toBe(true);
        expect(
            validateCustomFontFile({
                name: "a.woff2",
                size: CUSTOM_FONT_MAX_BYTES + 1,
            }).ok,
        ).toBe(false);
    });
    it("strips a path prefix from the display name", () => {
        const r = validateCustomFontFile({
            name: "C:\\fonts\\Cool.otf",
            size: 10,
        });
        expect(r.ok && r.displayName).toBe("Cool");
    });
    it("caps a very long display name at 60 chars", () => {
        const long = "x".repeat(200) + ".woff2";
        const r = validateCustomFontFile({ name: long, size: 10 });
        expect(r.ok && r.displayName.length).toBe(60);
    });
});
