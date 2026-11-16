import { describe, expect, it } from "vitest";
import {
    dropsEmptyPlaceholder,
    isH264,
    isNativePlaceholder,
    NATIVE_PLACEHOLDER_FILL,
    NativeSubstitute,
    type NativeAu,
} from "./nativeShareSubstitute";

function au(tag: number, key: boolean): NativeAu {
    return { key, data: new Uint8Array([tag]).buffer };
}

function frame(type: string, tag = 0) {
    return { type, data: new Uint8Array([tag]).buffer as ArrayBuffer };
}

function tagOf(f: { data: ArrayBuffer }): number {
    return new Uint8Array(f.data)[0];
}

function make(now = { t: 0 }) {
    const requests: number[] = [];
    const sub = new NativeSubstitute({
        requestKey: () => requests.push(now.t),
        now: () => now.t,
    });
    return { sub, requests, now };
}

describe("NativeSubstitute", () => {
    it("gives placeholders the queued AUs in order", () => {
        const { sub } = make();
        sub.push(au(1, true));
        sub.push(au(2, false));
        sub.push(au(3, false));
        const a = frame("key", 9);
        const b = frame("delta", 9);
        const c = frame("delta", 9);
        expect(sub.substitute(a)).toBe(true);
        expect(sub.substitute(b)).toBe(true);
        expect(sub.substitute(c)).toBe(true);
        expect([tagOf(a), tagOf(b), tagOf(c)]).toEqual([1, 2, 3]);
        expect(sub.stats.substituted).toBe(3);
    });

    it("drops a placeholder when no AU is queued", () => {
        const { sub } = make();
        const f = frame("delta", 9);
        expect(sub.substitute(f)).toBe(false);
        expect(tagOf(f)).toBe(9); // untouched
        expect(sub.stats.fifoEmpty).toBe(1);
    });

    it("waits for a key when a keyframe placeholder meets a delta AU", () => {
        const { sub, requests } = make();
        sub.push(au(1, true));
        sub.push(au(2, false));
        sub.push(au(3, false));
        sub.push(au(4, true));
        sub.push(au(5, false));
        expect(sub.substitute(frame("delta"))).toBe(true);
        expect(sub.substitute(frame("key"))).toBe(false);
        expect(requests).toHaveLength(1);
        expect(sub.substitute(frame("delta"))).toBe(false);
        expect(sub.stats.keyMismatch).toBe(1);
        expect(sub.stats.waitKeyDropped).toBe(2);
        const k = frame("delta", 9);
        expect(sub.substitute(k)).toBe(true);
        expect(tagOf(k)).toBe(4);
        const d = frame("delta", 9);
        expect(sub.substitute(d)).toBe(true);
        expect(tagOf(d)).toBe(5);
    });

    it("leaves a key placeholder alone when the AU is a key", () => {
        const { sub, requests } = make();
        sub.push(au(7, true));
        const f = frame("key", 9);
        expect(sub.substitute(f)).toBe(true);
        expect(tagOf(f)).toBe(7);
        expect(requests).toHaveLength(0);
        expect(sub.stats.keyMismatch).toBe(0);
    });

    it("drops the oldest AUs when the queue overflows", () => {
        const { sub } = make();
        for (let i = 0; i < 61; i++) sub.push(au(i, false));
        expect(sub.pending).toBe(60);
        expect(sub.stats.overflowed).toBe(1);
        const f = frame("delta", 9);
        sub.substitute(f);
        expect(tagOf(f)).toBe(1);
    });
});

describe("isNativePlaceholder", () => {
    const withSize = (type: string | undefined, w?: number, h?: number) => ({
        type,
        data: new ArrayBuffer(0),
        getMetadata: () => ({ width: w, height: h }),
    });

    it("matches 64x64 video frames only", () => {
        expect(isNativePlaceholder(withSize("delta", 64, 64))).toBe(true);
        expect(isNativePlaceholder(withSize("key", 64, 64))).toBe(true);
        expect(isNativePlaceholder(withSize("key", 1280, 720))).toBe(false);
        expect(isNativePlaceholder(withSize("key", 64, 720))).toBe(false);
    });

    it("never matches audio frames", () => {
        expect(isNativePlaceholder(withSize(undefined, 64, 64))).toBe(false);
    });

    it("is false without metadata", () => {
        expect(
            isNativePlaceholder({ type: "key", data: new ArrayBuffer(0) }),
        ).toBe(false);
    });
});

describe("NativeSubstitute backlog", () => {
    it("skips a deep backlog to the next keyframe AU", () => {
        const { sub } = make();
        for (let i = 0; i < 12; i++) sub.push(au(i, false));
        sub.push(au(99, true)); // keyframe at the tail of a deep queue
        expect(sub.pending).toBe(1);
        expect(sub.stats.skipped).toBe(12);
        const f = frame("key", 9);
        expect(sub.substitute(f)).toBe(true);
        expect(tagOf(f)).toBe(99);
    });

    it("asks for a keyframe, once per gap, while a delta backlog builds", () => {
        const { sub, requests, now } = make();
        for (let i = 0; i < 12; i++) sub.push(au(i, false));
        expect(requests.length).toBe(1);
        now.t = 500;
        sub.push(au(50, false));
        expect(requests.length).toBe(1);
        now.t = 1500;
        sub.push(au(51, false));
        expect(requests.length).toBe(2);
    });
});

describe("NATIVE_PLACEHOLDER_FILL", () => {
    it("is one fixed colour for every placeholder frame (see the constant's note)", () => {
        expect(NATIVE_PLACEHOLDER_FILL).toMatch(
            /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/,
        );
    });
});

describe("H.264-only drop of empty placeholders", () => {
    function codecFrame(mimeType: string | undefined, tag = 9) {
        return {
            type: "delta",
            data: new Uint8Array([tag]).buffer as ArrayBuffer,
            getMetadata: () => ({ width: 64, height: 64, mimeType }),
        };
    }

    it("treats H.264 and an unknown codec as H.264", () => {
        expect(isH264("video/H264")).toBe(true);
        expect(isH264("video/h264")).toBe(true);
        expect(isH264(undefined)).toBe(true);
        expect(isH264("video/VP8")).toBe(false);
        expect(isH264("video/AV1")).toBe(false);
        expect(isH264("video/VP9")).toBe(false);
    });

    it("drops an empty H.264 placeholder, keeps an empty VP8 one", () => {
        expect(dropsEmptyPlaceholder(codecFrame("video/H264"))).toBe(true);
        expect(dropsEmptyPlaceholder(codecFrame("video/VP8"))).toBe(false);
        expect(dropsEmptyPlaceholder(codecFrame(undefined))).toBe(true);
    });

    it("passes an empty VP8 placeholder on unchanged", () => {
        const { sub } = make();
        const f = codecFrame("video/VP8", 9);
        expect(sub.substitute(f)).toBe(true);
        expect(new Uint8Array(f.data)[0]).toBe(9);
        expect(sub.stats.fifoEmpty).toBe(1);
        expect(sub.stats.substituted).toBe(0);
    });

    it("still drops an empty H.264 placeholder through substitute", () => {
        const { sub } = make();
        expect(sub.substitute(codecFrame("video/H264"))).toBe(false);
        expect(sub.stats.fifoEmpty).toBe(1);
    });
});
