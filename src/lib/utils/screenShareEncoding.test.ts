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
});
