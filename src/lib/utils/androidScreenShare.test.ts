import { describe, expect, it } from "vitest";
import {
    ANDROID_AU_HEADER_BYTES,
    androidRoomCanShare,
    androidWebViewCanShare,
    parseAndroidAu,
    parseAndroidText,
    type AndroidShareEnv,
} from "./androidScreenShare";

function au(opts: {
    key: boolean;
    ts: number;
    w: number;
    h: number;
    payload: number[];
}): ArrayBuffer {
    const buf = new ArrayBuffer(ANDROID_AU_HEADER_BYTES + opts.payload.length);
    const view = new DataView(buf);
    view.setUint8(0, opts.key ? 1 : 0);
    const lo = opts.ts % 0x100000000;
    const hi = Math.floor(opts.ts / 0x100000000);
    view.setUint32(1, lo, true);
    view.setInt32(5, hi, true);
    view.setUint16(9, opts.w, true);
    view.setUint16(11, opts.h, true);
    new Uint8Array(buf, ANDROID_AU_HEADER_BYTES).set(opts.payload);
    return buf;
}

describe("parseAndroidAu", () => {
    it("reads flags, time, size and the Annex B payload", () => {
        const buf = au({
            key: true,
            ts: 1_234_567_890_123,
            w: 1920,
            h: 1080,
            payload: [0, 0, 0, 1, 0x67],
        });
        const out = parseAndroidAu(buf);
        expect(out).not.toBeNull();
        expect(out!.type).toBe("au");
        expect(out!.key).toBe(true);
        expect(out!.ts).toBe(1_234_567_890_123);
        expect(out!.w).toBe(1920);
        expect(out!.h).toBe(1080);
        expect(Array.from(new Uint8Array(out!.data))).toEqual([
            0, 0, 0, 1, 0x67,
        ]);
    });

    it("treats bit 0 alone as the keyframe flag", () => {
        const delta = new ArrayBuffer(ANDROID_AU_HEADER_BYTES + 1);
        new DataView(delta).setUint8(0, 0b10);
        expect(parseAndroidAu(delta)!.key).toBe(false);
        const key = new ArrayBuffer(ANDROID_AU_HEADER_BYTES + 1);
        new DataView(key).setUint8(0, 0b11);
        expect(parseAndroidAu(key)!.key).toBe(true);
    });

    it("reads a little-endian u16 size and a time above 2^32", () => {
        const buf = au({
            key: false,
            ts: 5_000_000_000,
            w: 0x0102,
            h: 0x0304,
            payload: [9],
        });
        const out = parseAndroidAu(buf)!;
        expect(out.ts).toBe(5_000_000_000);
        expect(out.w).toBe(0x0102);
        expect(out.h).toBe(0x0304);
    });

    it("returns null when there is no payload after the header", () => {
        expect(
            parseAndroidAu(new ArrayBuffer(ANDROID_AU_HEADER_BYTES)),
        ).toBeNull();
        expect(parseAndroidAu(new ArrayBuffer(3))).toBeNull();
    });
});

describe("parseAndroidText", () => {
    it("parses info messages", () => {
        expect(
            parseAndroidText(
                '{"type":"info","info":{"encoder":"c2.avc","hardware":true}}',
            ),
        ).toEqual({
            type: "info",
            info: { encoder: "c2.avc", hardware: true },
        });
    });

    it("parses ended with its reason", () => {
        expect(parseAndroidText('{"type":"ended","reason":"revoked"}')).toEqual(
            {
                type: "ended",
                reason: "revoked",
            },
        );
    });

    it("defaults a missing ended reason to error", () => {
        expect(parseAndroidText('{"type":"ended"}')).toEqual({
            type: "ended",
            reason: "error",
        });
    });

    it("rejects unknown types and bad JSON", () => {
        expect(parseAndroidText('{"type":"other"}')).toBeNull();
        expect(parseAndroidText("not json")).toBeNull();
        expect(parseAndroidText("null")).toBeNull();
    });
});

describe("androidWebViewCanShare and androidRoomCanShare", () => {
    const full: AndroidShareEnv = {
        MediaStreamTrackGenerator: () => {},
        Worker: () => {},
        OffscreenCanvas: () => {},
        RTCRtpScriptTransform: () => {},
        createEncodedStreams: () => {},
    };

    it("needs the generator, worker and OffscreenCanvas", () => {
        expect(androidWebViewCanShare(full)).toBe(true);
        expect(
            androidWebViewCanShare({ ...full, OffscreenCanvas: undefined }),
        ).toBe(false);
        expect(
            androidWebViewCanShare({
                ...full,
                MediaStreamTrackGenerator: undefined,
            }),
        ).toBe(false);
        expect(androidWebViewCanShare({ ...full, Worker: undefined })).toBe(
            false,
        );
    });

    it("serves encrypted rooms through insertable streams", () => {
        expect(
            androidRoomCanShare(
                { ...full, RTCRtpScriptTransform: undefined },
                true,
            ),
        ).toBe(true);
        expect(
            androidRoomCanShare(
                { ...full, createEncodedStreams: undefined },
                true,
            ),
        ).toBe(false);
    });

    it("serves plain rooms through RTCRtpScriptTransform", () => {
        expect(
            androidRoomCanShare(
                { ...full, createEncodedStreams: undefined },
                false,
            ),
        ).toBe(true);
        expect(
            androidRoomCanShare(
                { ...full, RTCRtpScriptTransform: undefined },
                false,
            ),
        ).toBe(false);
    });

    it("refuses every room when the WebView lacks the frame APIs", () => {
        const bare = { ...full, MediaStreamTrackGenerator: undefined };
        expect(androidRoomCanShare(bare, true)).toBe(false);
        expect(androidRoomCanShare(bare, false)).toBe(false);
    });
});
