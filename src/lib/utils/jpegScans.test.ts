import { describe, it, expect } from "vitest";
import { jpegToProgressive } from "./jpegProgressive";
import { FIXTURES } from "./jpegProgressive.fixtures";
import { choosePrefix, progressiveScanEnds } from "./jpegScans";

const bytesOf = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

describe("progressiveScanEnds", () => {
    for (const [name, b64] of Object.entries(FIXTURES)) {
        it(`returns valid scan ends for ${name}`, () => {
            const out = jpegToProgressive(bytesOf(b64));
            expect(out).not.toBeNull();
            const ends = progressiveScanEnds(out!)!;
            expect(ends).not.toBeNull();
            expect(ends.length).toBeGreaterThan(1);
            for (let i = 1; i < ends.length; i++) {
                expect(ends[i]).toBeGreaterThan(ends[i - 1]);
            }
            expect(ends[ends.length - 1] + 2).toBe(out!.length);
            expect(out![out!.length - 2]).toBe(0xff);
            expect(out![out!.length - 1]).toBe(0xd9);
            for (const e of ends) {
                expect(out![e]).toBe(0xff);
                expect(out![e + 1]).not.toBe(0x00);
            }
        });
    }

    it("returns null for baseline input", () => {
        expect(progressiveScanEnds(bytesOf(FIXTURES.ycc420))).toBeNull();
    });

    it("returns null for empty, random and truncated input", () => {
        expect(progressiveScanEnds(new Uint8Array(0))).toBeNull();
        expect(progressiveScanEnds(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
        const out = jpegToProgressive(bytesOf(FIXTURES.ycc420))!;
        expect(progressiveScanEnds(out.subarray(0, out.length - 2))).toBeNull();
        expect(
            progressiveScanEnds(out.subarray(0, Math.floor(out.length / 2))),
        ).toBeNull();
    });
});

describe("choosePrefix", () => {
    for (const name of ["ycc420", "ycc444", "gray", "cmyk"]) {
        it(`respects limits and coverage for ${name}`, () => {
            const out = jpegToProgressive(bytesOf(FIXTURES[name]))!;
            const ends = progressiveScanEnds(out)!;
            expect(choosePrefix(out, out.length)).toEqual({
                length: ends[ends.length - 1],
                scanIndex: ends.length - 1,
            });
            // Smallest scan end whose prefix covers DC of every component plus a luma AC scan.
            let first = -1;
            for (let i = 0; i < ends.length && first < 0; i++) {
                if (choosePrefix(out, ends[i]) !== null) first = i;
            }
            expect(first).toBeGreaterThan(0);
            expect(choosePrefix(out, ends[first])).toEqual({
                length: ends[first],
                scanIndex: first,
            });
            expect(choosePrefix(out, ends[first] - 1)).toBeNull();
            expect(choosePrefix(out, 0)).toBeNull();
            expect(choosePrefix(out, ends[first] + 1)!.length).toBe(
                ends[first],
            );
        });
    }

    it("returns null for non-progressive input", () => {
        expect(choosePrefix(bytesOf(FIXTURES.ycc420), 1e9)).toBeNull();
    });
});
