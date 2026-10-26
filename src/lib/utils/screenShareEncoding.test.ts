import { describe, it, expect } from "vitest";
import {
    screenShareEncodingFor,
    applyScreenShareEncoding,
} from "./screenShareEncoding";

describe("screenShareEncodingFor", () => {
    it("passes the picked bitrate through with the picked frame rate", () => {
        expect(screenShareEncodingFor(4_000_000, 30)).toEqual({
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor(750_000, 15)).toEqual({
            maxBitrate: 750_000,
            maxFramerate: 15,
        });
        expect(screenShareEncodingFor(12_345_678.4, 60)).toEqual({
            maxBitrate: 12_345_678,
            maxFramerate: 60,
        });
    });

    it("normalizes a non-preset fps to 30", () => {
        expect(screenShareEncodingFor(2_000_000, 45).maxFramerate).toBe(30);
        expect(screenShareEncodingFor(2_000_000, 0).maxFramerate).toBe(30);
        expect(screenShareEncodingFor(2_000_000, Number.NaN).maxFramerate).toBe(
            30,
        );
    });
});

describe("applyScreenShareEncoding", () => {
    it("sets maxBitrate + maxFramerate on a single encoding and returns true", () => {
        const params = {
            encodings: [{ rid: "h", active: true }],
        } as RTCRtpSendParameters;
        const applied = applyScreenShareEncoding(params, {
            maxBitrate: 8_000_000,
            maxFramerate: 60,
        });
        expect(applied).toBe(true);
        expect(params.encodings![0]).toMatchObject({
            rid: "h",
            active: true,
            maxBitrate: 8_000_000,
            maxFramerate: 60,
        });
    });

    it("caps every encoding when simulcast layers are present", () => {
        const params = {
            encodings: [{ rid: "q" }, { rid: "h" }],
        } as RTCRtpSendParameters;
        applyScreenShareEncoding(params, {
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(
            params.encodings!.every(
                (e) => e.maxBitrate === 4_000_000 && e.maxFramerate === 30,
            ),
        ).toBe(true);
    });

    it("returns false and mutates nothing when encodings is empty", () => {
        const params = { encodings: [] } as unknown as RTCRtpSendParameters;
        expect(
            applyScreenShareEncoding(params, {
                maxBitrate: 4_000_000,
                maxFramerate: 30,
            }),
        ).toBe(false);
    });

    it("returns false when encodings is undefined", () => {
        const params = {} as RTCRtpSendParameters;
        expect(
            applyScreenShareEncoding(params, {
                maxBitrate: 4_000_000,
                maxFramerate: 30,
            }),
        ).toBe(false);
    });

    it("scales maxBitrate per layer by 1/scaleResolutionDownBy^2 with 150k floor", () => {
        const params = {
            encodings: [
                { rid: "q", scaleResolutionDownBy: 2 },
                { rid: "h", scaleResolutionDownBy: 1 },
            ],
        } as RTCRtpSendParameters;
        const applied = applyScreenShareEncoding(params, {
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(applied).toBe(true);
        // Half-res layer: 4M / 2^2 = 1M
        expect(params.encodings![0].maxBitrate).toBe(1_000_000);
        expect(params.encodings![0].maxFramerate).toBe(30);
        // Full-res layer: 4M / 1^2 = 4M
        expect(params.encodings![1].maxBitrate).toBe(4_000_000);
        expect(params.encodings![1].maxFramerate).toBe(30);
    });

    it("scales maxBitrate for undefined scaleResolutionDownBy as 1", () => {
        const params = {
            encodings: [
                { rid: "q", scaleResolutionDownBy: 2 },
                { rid: "h" }, // scaleResolutionDownBy undefined = 1
            ],
        } as RTCRtpSendParameters;
        applyScreenShareEncoding(params, {
            maxBitrate: 8_000_000,
            maxFramerate: 60,
        });
        // Half-res: 8M / 2^2 = 2M
        expect(params.encodings![0].maxBitrate).toBe(2_000_000);
        expect(params.encodings![0].maxFramerate).toBe(60);
        // Top layer (scaleResolutionDownBy undefined = 1): 8M / 1^2 = 8M
        expect(params.encodings![1].maxBitrate).toBe(8_000_000);
        expect(params.encodings![1].maxFramerate).toBe(60);
    });

    it("enforces the 150k floor on low-bitrate scaled layers", () => {
        const params = {
            encodings: [{ rid: "q", scaleResolutionDownBy: 4 }, { rid: "h" }],
        } as RTCRtpSendParameters;
        applyScreenShareEncoding(params, {
            maxBitrate: 1_000_000,
            maxFramerate: 15,
        });
        // 1M / 4^2 = 62.5k, floored to 150k
        expect(params.encodings![0].maxBitrate).toBe(150_000);
        expect(params.encodings![0].maxFramerate).toBe(15);
        // Top layer unchanged
        expect(params.encodings![1].maxBitrate).toBe(1_000_000);
        expect(params.encodings![1].maxFramerate).toBe(15);
    });
});
