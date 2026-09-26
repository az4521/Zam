import { describe, it, expect } from "vitest";
import {
    screenShareEncodingFor,
    applyScreenShareEncoding,
} from "./screenShareEncoding";

describe("screenShareEncodingFor", () => {
    it("maps every resolution row at 30 fps", () => {
        expect(screenShareEncodingFor("720", 30)).toEqual({
            maxBitrate: 2_500_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("1080", 30)).toEqual({
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("1440", 30)).toEqual({
            maxBitrate: 6_000_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("2160", 30)).toEqual({
            maxBitrate: 10_000_000,
            maxFramerate: 30,
        });
    });

    it("maps the fps columns for 1080p", () => {
        expect(screenShareEncodingFor("1080", 15)).toEqual({
            maxBitrate: 2_500_000,
            maxFramerate: 15,
        });
        expect(screenShareEncodingFor("1080", 60)).toEqual({
            maxBitrate: 8_000_000,
            maxFramerate: 60,
        });
    });

    it("maps the fps columns for 720p and 4K", () => {
        expect(screenShareEncodingFor("720", 15)).toEqual({
            maxBitrate: 1_500_000,
            maxFramerate: 15,
        });
        expect(screenShareEncodingFor("720", 60)).toEqual({
            maxBitrate: 4_000_000,
            maxFramerate: 60,
        });
        expect(screenShareEncodingFor("2160", 15)).toEqual({
            maxBitrate: 8_000_000,
            maxFramerate: 15,
        });
        expect(screenShareEncodingFor("2160", 60)).toEqual({
            maxBitrate: 16_000_000,
            maxFramerate: 60,
        });
    });

    it("falls back to the 1080p row for an unknown resolution key", () => {
        expect(screenShareEncodingFor("999", 30)).toEqual({
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("", 60)).toEqual({
            maxBitrate: 8_000_000,
            maxFramerate: 60,
        });
    });

    it("normalizes a non-preset fps to the 30 column", () => {
        expect(screenShareEncodingFor("1080", 45)).toEqual({
            maxBitrate: 4_000_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("720", 0)).toEqual({
            maxBitrate: 2_500_000,
            maxFramerate: 30,
        });
        expect(screenShareEncodingFor("1440", Number.NaN)).toEqual({
            maxBitrate: 6_000_000,
            maxFramerate: 30,
        });
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
            encodings: [
                { rid: "q", scaleResolutionDownBy: 4 },
                { rid: "h" },
            ],
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
