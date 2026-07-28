import { describe, it, expect } from "vitest";
import {
    QR_QUIET_ZONE,
    qrViewBoxSize,
    qrModulePath,
    toQrPayloadBytes,
    isMatrixQrPayload,
} from "./qrCode";

describe("qrViewBoxSize", () => {
    it("adds a quiet zone on both sides", () => {
        expect(QR_QUIET_ZONE).toBe(4);
        expect(qrViewBoxSize(21)).toBe(29);
    });

    it("returns 0 for a non-positive size", () => {
        expect(qrViewBoxSize(0)).toBe(0);
        expect(qrViewBoxSize(-3)).toBe(0);
    });
});

describe("qrModulePath", () => {
    it("offsets a single dark module by the quiet zone", () => {
        expect(qrModulePath(1, [1])).toBe("M4 4h1v1h-1z");
    });

    it("coalesces a horizontal run into one rectangle", () => {
        // row 0 = ██·, rows 1-2 blank
        const data = [1, 1, 0, 0, 0, 0, 0, 0, 0];
        expect(qrModulePath(3, data)).toBe("M4 4h2v1h-2z");
    });

    it("closes a run that ends at the last column", () => {
        // row 0 = ·██, rows 1-2 blank
        const data = [0, 1, 1, 0, 0, 0, 0, 0, 0];
        expect(qrModulePath(3, data)).toBe("M5 4h2v1h-2z");
    });

    it("emits every run in a row, not just the first", () => {
        // row 0 = █·█, rows 1-2 blank
        const data = [1, 0, 1, 0, 0, 0, 0, 0, 0];
        expect(qrModulePath(3, data)).toBe("M4 4h1v1h-1zM6 4h1v1h-1z");
    });

    it("places each row's run at its own row offset", () => {
        // 2x2 checkerboard
        expect(qrModulePath(2, [1, 0, 0, 1])).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");
    });

    it("does not merge runs across a row boundary", () => {
        // row 0 = ·█, row 1 = █·  -> two separate 1-module runs
        expect(qrModulePath(2, [0, 1, 1, 0])).toBe("M5 4h1v1h-1zM4 5h1v1h-1z");
    });

    it("returns an empty path for an all-light matrix", () => {
        expect(qrModulePath(2, [0, 0, 0, 0])).toBe("");
    });

    it("returns an empty path when the data is too short for the size", () => {
        expect(qrModulePath(3, [1, 1])).toBe("");
    });

    it("returns an empty path for a non-positive size", () => {
        expect(qrModulePath(0, [])).toBe("");
    });

    it("returns an empty path for a fractional size", () => {
        expect(qrModulePath(2.5, [1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe("");
    });

    it("treats any non-zero value as dark", () => {
        expect(qrModulePath(1, [255])).toBe("M4 4h1v1h-1z");
    });
});

describe("toQrPayloadBytes", () => {
    it("copies a byte array into a Uint8ClampedArray", () => {
        const out = toQrPayloadBytes([0, 77, 255]);
        expect(out).toBeInstanceOf(Uint8ClampedArray);
        expect(Array.from(out!)).toEqual([0, 77, 255]);
    });

    it("rejects nothing to decode", () => {
        expect(toQrPayloadBytes(null)).toBeNull();
        expect(toQrPayloadBytes(undefined)).toBeNull();
        expect(toQrPayloadBytes([])).toBeNull();
    });

    it("rejects values outside a byte so a bad decode never reaches the SDK", () => {
        expect(toQrPayloadBytes([1, -1])).toBeNull();
        expect(toQrPayloadBytes([1, 256])).toBeNull();
        expect(toQrPayloadBytes([1, 1.5])).toBeNull();
        expect(toQrPayloadBytes([1, Number.NaN])).toBeNull();
        expect(toQrPayloadBytes([1, Number.POSITIVE_INFINITY])).toBeNull();
    });
});

describe("isMatrixQrPayload", () => {
    const prefix = [0x4d, 0x41, 0x54, 0x52, 0x49, 0x58]; // "MATRIX"

    it("accepts a payload with the spec prefix and a version byte", () => {
        expect(isMatrixQrPayload([...prefix, 0x02, 0x00])).toBe(true);
    });

    it("rejects a payload with the prefix but no version byte", () => {
        expect(isMatrixQrPayload(prefix)).toBe(false);
    });

    it("rejects some other QR code's payload", () => {
        expect(isMatrixQrPayload([104, 116, 116, 112, 115, 58, 47, 47])).toBe(
            false,
        );
    });

    it("rejects a short payload", () => {
        expect(isMatrixQrPayload([0x4d, 0x41])).toBe(false);
    });
});
