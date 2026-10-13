import { describe, it, expect } from "vitest";
import { isWebm, probeWebm } from "./webmProbe";

const enc = new TextEncoder();

/** Encode a size as a 1-byte or 8-byte EBML varint; null = unknown size. */
function size(n: number | null): number[] {
    if (n === null) return [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    if (n < 0x7f) return [0x80 | n];
    // 8-byte form
    const out = [0x01, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 7; i >= 1; i--) {
        out[i] = n & 0xff;
        n = Math.floor(n / 256);
    }
    return out;
}

function el(id: number[], payload: number[], unknown = false): number[] {
    return [...id, ...size(unknown ? null : payload.length), ...payload];
}

const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const SEGMENT = [0x18, 0x53, 0x80, 0x67];
const TRACKS = [0x16, 0x54, 0xae, 0x6b];
const TRACK_ENTRY = [0xae];
const TRACK_TYPE = [0x83];
const CODEC_ID = [0x86];
const CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
const VOID = [0xec];
const VIDEO = [0xe0];

function track(type: number, codec: string): number[] {
    return el(TRACK_ENTRY, [
        ...el(TRACK_TYPE, [type]),
        ...el(CODEC_ID, [...enc.encode(codec)]),
        // a Video settings container, to be skipped by size
        ...el(VIDEO, [0xb0, 0x81, 0x10]),
    ]);
}

function webm(tracks: number[][], opts: { unknownSegment?: boolean } = {}) {
    const ebmlHeader = el(EBML, [0x42, 0x82, 0x84, ...enc.encode("webm")]);
    const body = [
        ...el(VOID, [0, 0, 0, 0]),
        ...el(TRACKS, tracks.flat()),
        ...el(CLUSTER, [0xe7, 0x81, 0x00], true),
    ];
    return new Uint8Array([
        ...ebmlHeader,
        ...el(SEGMENT, body, opts.unknownSegment ?? true),
    ]);
}

describe("isWebm", () => {
    it("recognises the EBML magic", () => {
        expect(isWebm(webm([track(1, "V_VP9")]))).toBe(true);
    });
    it("rejects MP4 and short input", () => {
        expect(
            isWebm(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])),
        ).toBe(false);
        expect(isWebm(new Uint8Array([0x1a, 0x45]))).toBe(false);
    });
});

describe("probeWebm", () => {
    it("builds the MIME type from the tracks, video first", () => {
        const probe = probeWebm(webm([track(2, "A_OPUS"), track(1, "V_VP9")]));
        expect(probe).toEqual({
            status: "ok",
            mime: 'video/webm; codecs="vp9,opus"',
        });
    });

    it("handles VP8, AV1 and Vorbis", () => {
        expect(
            probeWebm(webm([track(1, "V_VP8"), track(2, "A_VORBIS")])),
        ).toEqual({ status: "ok", mime: 'video/webm; codecs="vp8,vorbis"' });
        expect(probeWebm(webm([track(1, "V_AV1")]))).toEqual({
            status: "ok",
            mime: 'video/webm; codecs="av01.0.05M.08"',
        });
    });

    it("works with a known-size Segment too", () => {
        expect(
            probeWebm(webm([track(1, "V_VP9")], { unknownSegment: false })),
        ).toMatchObject({ status: "ok" });
    });

    it("asks for more bytes at every truncation point, never guessing", () => {
        const full = webm([track(1, "V_VP9"), track(2, "A_OPUS")]);
        // At every cut the answer is either "need more" or the complete track
        // list: never a partial list, never a wrong "unsupported".
        let sawOk = false;
        for (let n = 1; n < full.length; n++) {
            const probe = probeWebm(full.subarray(0, n));
            if (probe.status === "ok") {
                sawOk = true;
                // only once every codec is readable
                expect(probe.mime).toBe('video/webm; codecs="vp9,opus"');
            } else {
                expect(probe.status).toBe("need-more");
            }
        }
        expect(sawOk).toBe(true);
    });

    it("refuses a codec MediaSource will not take", () => {
        expect(probeWebm(webm([track(1, "V_MPEG4/ISO/AVC")]))).toEqual({
            status: "unsupported",
        });
        expect(probeWebm(webm([track(1, "V_VP9"), track(2, "A_AAC")]))).toEqual(
            { status: "unsupported" },
        );
    });

    it("takes an audio-only file, with the audio/ prefix", () => {
        expect(probeWebm(webm([track(2, "A_OPUS")]))).toEqual({
            status: "ok",
            mime: 'audio/webm; codecs="opus"',
        });
    });

    it("refuses a file with no tracks at all", () => {
        expect(probeWebm(webm([]))).toEqual({ status: "unsupported" });
    });

    it("refuses subtitle and other track types", () => {
        expect(
            probeWebm(webm([track(1, "V_VP9"), track(17, "S_TEXT/WEBVTT")])),
        ).toEqual({ status: "unsupported" });
    });

    it("refuses junk", () => {
        expect(probeWebm(new Uint8Array(64).fill(0))).toEqual({
            status: "unsupported",
        });
    });
});
