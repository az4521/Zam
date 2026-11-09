import { describe, expect, it } from "vitest";
import { decodeBankOpusSamples, type BankSampleLike } from "./opusSample";

/** A stand-in bank sample; `raw` is what getRawData hands back. */
function sample(
    raw: number[],
    compressed = true,
    sampleRate = 48000,
): BankSampleLike {
    return {
        isCompressed: compressed,
        sampleRate,
        getRawData: () => Uint8Array.from(raw),
    };
}

/** ZOP1 magic followed by enough bytes to pass the header check. */
const ZOP1 = [0x5a, 0x4f, 0x50, 0x31, 0, 0, 0, 0, 0, 0];

describe("decodeBankOpusSamples", () => {
    it("decodes only compressed ZOP1 samples, keeping their bank index", async () => {
        const seen: number[][] = [];
        const decoded = await decodeBankOpusSamples(
            [
                sample([1, 2, 3], false),
                sample([9, 9, 9, 9, 9, 9, 9, 9, 9, 9]),
                sample(ZOP1, true, 22050),
            ],
            async (data) => {
                seen.push([...data]);
                return new Float32Array([0.5]);
            },
        );
        expect(seen).toEqual([ZOP1]);
        expect(decoded).toHaveLength(1);
        expect(decoded[0].index).toBe(2);
        expect(decoded[0].sampleRate).toBe(22050);
        expect([...decoded[0].pcm]).toEqual([0.5]);
    });

    it("returns an empty list for a bank without Opus samples", async () => {
        const decoded = await decodeBankOpusSamples([sample([0, 1, 2])]);
        expect(decoded).toEqual([]);
    });
});
