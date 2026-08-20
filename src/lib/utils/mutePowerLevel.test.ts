import { describe, it, expect } from "vitest";
import { MUTE_POWER_LEVEL, parseMutePowerLevelInput } from "./mutePowerLevel";

describe("MUTE_POWER_LEVEL", () => {
    it("is the conventional mute value of -1", () => {
        expect(MUTE_POWER_LEVEL).toBe(-1);
    });
});

describe("parseMutePowerLevelInput", () => {
    describe("accepting valid inputs", () => {
        it("accepts the mute level (-1)", () => {
            expect(parseMutePowerLevelInput("-1", 100)).toEqual({
                ok: true,
                value: -1,
                error: "",
            });
        });

        it("accepts a whole number at or below the ceiling", () => {
            expect(parseMutePowerLevelInput("40", 100)).toEqual({
                ok: true,
                value: 40,
                error: "",
            });
            expect(parseMutePowerLevelInput("0", 50)).toEqual({
                ok: true,
                value: 0,
                error: "",
            });
        });

        it("accepts the ceiling itself (inclusive)", () => {
            expect(parseMutePowerLevelInput("100", 100)).toEqual({
                ok: true,
                value: 100,
                error: "",
            });
        });

        it("trims surrounding whitespace", () => {
            expect(parseMutePowerLevelInput(" 40 ", 100)).toEqual({
                ok: true,
                value: 40,
                error: "",
            });
            expect(parseMutePowerLevelInput(" -1 ", 100)).toEqual({
                ok: true,
                value: -1,
                error: "",
            });
        });
    });

    describe("rejecting invalid inputs", () => {
        it("rejects a value above the ceiling, naming the ceiling", () => {
            const r = parseMutePowerLevelInput("101", 100);
            expect(r.ok).toBe(false);
            expect(r.value).toBeNull();
            expect(r.error).toContain("(100)");

            const r2 = parseMutePowerLevelInput("75", 50);
            expect(r2.ok).toBe(false);
            expect(r2.error).toContain("(50)");
        });

        it("rejects negatives other than -1, suggesting the mute level", () => {
            const r = parseMutePowerLevelInput("-2", 100);
            expect(r.ok).toBe(false);
            expect(r.value).toBeNull();
            expect(r.error).toBe("Use -1 to mute");

            const r2 = parseMutePowerLevelInput("-100", 100);
            expect(r2.ok).toBe(false);
            expect(r2.value).toBeNull();
            expect(r2.error).toBe("Use -1 to mute");

            const r3 = parseMutePowerLevelInput("-5", 50);
            expect(r3.ok).toBe(false);
            expect(r3.error).toBe("Use -1 to mute");
        });

        it("rejects non-integers (float, hex, text)", () => {
            for (const bad of ["3.5", "0x10", "abc", "-1.5"]) {
                const r = parseMutePowerLevelInput(bad, 100);
                expect(r.ok).toBe(false);
                expect(r.value).toBeNull();
                expect(r.error).toBe("Must be a whole number");
            }
        });

        it("rejects blank input", () => {
            for (const blank of ["", "   "]) {
                const r = parseMutePowerLevelInput(blank, 100);
                expect(r.ok).toBe(false);
                expect(r.value).toBeNull();
                expect(r.error).toBe("Enter a power level");
            }
        });
    });

    describe("edge cases", () => {
        it("accepts -1 even when ceiling is 0", () => {
            expect(parseMutePowerLevelInput("-1", 0)).toEqual({
                ok: true,
                value: -1,
                error: "",
            });
        });

        it("accepts -1 regardless of ceiling value", () => {
            for (const ceiling of [0, 1, 50, 100]) {
                expect(parseMutePowerLevelInput("-1", ceiling)).toEqual({
                    ok: true,
                    value: -1,
                    error: "",
                });
            }
        });

        it("rejects 0 when ceiling is negative (edge case - shouldn't happen in practice)", () => {
            const r = parseMutePowerLevelInput("0", -10);
            expect(r.ok).toBe(false);
            expect(r.error).toContain("(-10)");
        });
    });
});
