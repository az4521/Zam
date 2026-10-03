import { describe, expect, it } from "vitest";
import { isJxlBytes } from "./jxl";

describe("isJxlBytes", () => {
    it("recognises a bare codestream", () => {
        expect(isJxlBytes(new Uint8Array([0xff, 0x0a, 0x08]))).toBe(true);
    });
    it("recognises the ISO BMFF container", () => {
        const sig = [
            0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87,
            0x0a,
        ];
        expect(isJxlBytes(new Uint8Array(sig))).toBe(true);
    });
    it("rejects other images and short input", () => {
        expect(isJxlBytes(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false); // JPEG
        expect(isJxlBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
            false,
        ); // PNG
        expect(isJxlBytes(new Uint8Array([0xff]))).toBe(false);
    });
});
