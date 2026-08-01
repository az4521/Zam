import { describe, it, expect } from "vitest";
import { safeAspectRatio, safeDimension } from "./mediaDimensions";

describe("safeDimension", () => {
    it("accepts plain positive numbers", () => {
        expect(safeDimension(1920)).toBe(1920);
        expect(safeDimension(1)).toBe(1);
    });

    it("accepts numeric strings, which is what most senders put in info.w", () => {
        expect(safeDimension("1920")).toBe(1920);
        expect(safeDimension(" 720 ")).toBe(720);
        expect(safeDimension("1e3")).toBe(1000);
    });

    it("rounds fractional dimensions to integers", () => {
        expect(safeDimension(1280.4)).toBe(1280);
        expect(safeDimension(1280.6)).toBe(1281);
    });

    it("rejects values that round away to nothing", () => {
        expect(safeDimension(0)).toBeNull();
        expect(safeDimension(0.2)).toBeNull();
    });

    it("rejects non-finite values", () => {
        expect(safeDimension(NaN)).toBeNull();
        expect(safeDimension(Infinity)).toBeNull();
        expect(safeDimension(-Infinity)).toBeNull();
    });

    it("rejects negative values", () => {
        expect(safeDimension(-16)).toBeNull();
        expect(safeDimension("-9")).toBeNull();
    });

    it("clamps absurdly large values instead of passing them through", () => {
        expect(safeDimension(1e12)).toBe(100000);
        expect(safeDimension("999999999")).toBe(100000);
    });

    it("rejects strings carrying a CSS payload", () => {
        expect(
            safeDimension("1px;background:url(https://tracker.example/x)"),
        ).toBeNull();
        expect(safeDimension("16/9")).toBeNull();
        expect(safeDimension("1}body{display:none")).toBeNull();
        expect(safeDimension("")).toBeNull();
        expect(safeDimension("   ")).toBeNull();
    });

    it("rejects non-number, non-string input rather than coercing it", () => {
        // Number([16]) is 16 and Number(true) is 1 — coercing these would let a
        // crafted JSON shape smuggle a value past the guard.
        expect(safeDimension([16] as unknown)).toBeNull();
        expect(safeDimension(true as unknown)).toBeNull();
        expect(safeDimension(null)).toBeNull();
        expect(safeDimension(undefined)).toBeNull();
        expect(safeDimension({ valueOf: () => 16 } as unknown)).toBeNull();
    });
});

describe("safeAspectRatio", () => {
    it("builds a ratio from a valid pair", () => {
        expect(safeAspectRatio(1920, 1080)).toBe("1920 / 1080");
        expect(safeAspectRatio("640", "480")).toBe("640 / 480");
    });

    it("falls back when either side is missing or hostile", () => {
        expect(safeAspectRatio(undefined, undefined)).toBe("16 / 9");
        expect(safeAspectRatio(1920, undefined)).toBe("16 / 9");
        expect(safeAspectRatio(undefined, 1080)).toBe("16 / 9");
        expect(safeAspectRatio("1px;background:url(https://x/y)", 1080)).toBe(
            "16 / 9",
        );
        expect(safeAspectRatio(1920, "9;position:fixed;inset:0")).toBe(
            "16 / 9",
        );
    });

    it("only ever emits digits and a separator, whatever it is fed", () => {
        const hostile = [
            "1px;background:url(https://tracker.example/x)",
            "1}body{display:none",
            "16/9",
            "calc(1px)",
            "-1",
            "Infinity",
            "",
            null,
            undefined,
            {},
            [],
        ];
        for (const w of hostile) {
            for (const h of hostile) {
                expect(safeAspectRatio(w, h)).toMatch(/^\d+ \/ \d+$/);
            }
        }
    });

    it("accepts a caller-chosen fallback", () => {
        expect(safeAspectRatio(null, null, "1 / 1")).toBe("1 / 1");
    });
});
