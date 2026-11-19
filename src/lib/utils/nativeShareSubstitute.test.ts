import { describe, expect, it } from "vitest";
import {
    dropsEmptyPlaceholder,
    isH264,
    isNativePlaceholder,
    NATIVE_PLACEHOLDER_FILL,
    NativeSubstitute,
    nativeShareSize,
    PlaceholderClock,
    type NativeAu,
    placeholderI420,
    placeholderLayer,
    LayeredSubstitute,
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

describe("PlaceholderClock", () => {
    it("stamps placeholders with the AU capture times, keeping their spacing", () => {
        const clock = new PlaceholderClock();
        // Capture every 16 667 µs; the AUs arrive with uneven delays.
        const stamps = [0, 1, 2, 3].map((i) =>
            clock.stamp(
                9e9 + i * 16667,
                5e6 + i * 16667 + [0, 9000, 1000, 7000][i],
            ),
        );
        expect(stamps.map((s, i) => (i ? s - stamps[i - 1] : 0))).toEqual([
            0, 16667, 16667, 16667,
        ]);
    });

    it("estimates now in the capture clock for an AU without a newer capture time", () => {
        const clock = new PlaceholderClock();
        expect(clock.stamp(9e9, 5e6)).toBe(9e9);
        // Keep-alive re-encode of the same frame one second later.
        expect(clock.stamp(9e9, 6e6)).toBe(9e9 + 1e6);
    });

    it("puts a catch-up 1 ms after the last, so the queued AUs keep their capture times", () => {
        const clock = new PlaceholderClock();
        expect(clock.stamp(9e9, 5e6)).toBe(9e9);
        // Catch-up written 80 ms later, while AUs captured since are queued.
        expect(clock.stamp(undefined, 5e6 + 80000)).toBe(9e9 + 1000);
        // The queued AUs then keep their real 16.7 ms spacing.
        expect(clock.stamp(9e9 + 16667, 5e6 + 81000)).toBe(9e9 + 16667);
        expect(clock.stamp(9e9 + 33333, 5e6 + 82000)).toBe(9e9 + 33333);
    });

    it("stays strictly increasing, by at least 1 ms", () => {
        const clock = new PlaceholderClock();
        const a = clock.stamp(9e9, 5e6);
        const b = clock.stamp(undefined, 5e6); // catch-up, same instant
        const c = clock.stamp(9e9 - 5000, 5e6); // stale capture time
        expect(b).toBe(a + 1000);
        expect(c).toBe(b + 1000);
    });
});

describe("NativeSubstitute catch-up", () => {
    it("asks for an extra placeholder when AUs queue up behind them, rate-limited", () => {
        const now = { t: 0 };
        let catchUps = 0;
        const sub = new NativeSubstitute({
            requestKey: () => {},
            requestCatchUp: () => catchUps++,
            now: () => now.t,
        });
        sub.push(au(1, true));
        sub.substitute(frame("key"));
        expect(catchUps).toBe(0); // in step
        sub.push(au(2, false));
        sub.push(au(3, false));
        sub.push(au(4, false));
        sub.substitute(frame("delta")); // two still queued: behind
        expect(catchUps).toBe(1);
        sub.substitute(frame("delta"));
        sub.push(au(5, false));
        sub.push(au(6, false));
        sub.substitute(frame("delta"));
        expect(catchUps).toBe(1); // within the gap
        now.t = 300;
        sub.push(au(7, false));
        sub.substitute(frame("delta"));
        expect(catchUps).toBe(2);
    });
});

describe("nativeShareSize", () => {
    it("reads the size from the helper's started and size messages", () => {
        expect(
            nativeShareSize({ event: "started", width: 1920, height: 1080 }),
        ).toEqual({ width: 1920, height: 1080 });
        expect(
            nativeShareSize({ event: "size", width: 1080, height: 2400 }),
        ).toEqual({ width: 1080, height: 2400 });
    });

    it("ignores other messages and missing or zero sizes", () => {
        expect(
            nativeShareSize({ event: "stats", width: 1920, height: 1080 }),
        ).toBeNull();
        expect(nativeShareSize({ event: "started" })).toBeNull();
        expect(
            nativeShareSize({ event: "started", width: 0, height: 1080 }),
        ).toBeNull();
    });
});

describe("placeholderI420", () => {
    it("is a full I420 picture of one grey", () => {
        const p = placeholderI420(64);
        expect(p.length).toBe(64 * 64 * 1.5);
        expect(new Set(p.subarray(0, 64 * 64))).toEqual(new Set([93]));
        expect(new Set(p.subarray(64 * 64))).toEqual(new Set([128]));
    });
});

describe("simulcast placeholders", () => {
    const sized = (w: number, type = "delta", tag = 0) => {
        // 64 = the one-layer placeholder; 352 = the layered one's low layer.
        const h = w === 352 ? 198 : w;
        return {
            type,
            data: new Uint8Array([tag]).buffer as ArrayBuffer,
            getMetadata: () => ({
                width: w,
                height: h,
                mimeType: "video/H264",
            }),
        };
    };

    it("tells the layers apart by the placeholder's encoded size", () => {
        const rect = (w: number, h: number) => ({
            type: "delta",
            data: new ArrayBuffer(1),
            getMetadata: () => ({ width: w, height: h }),
        });
        expect(placeholderLayer(sized(64))).toBe(0);
        expect(placeholderLayer(rect(704, 396))).toBe(0);
        expect(placeholderLayer(rect(352, 198))).toBe(1);
        // Camera layers are never taken for placeholders.
        expect(placeholderLayer(rect(640, 360))).toBeNull();
        expect(placeholderLayer(rect(320, 180))).toBeNull();
        expect(placeholderLayer(sized(32))).toBeNull();
        expect(placeholderLayer(sized(960))).toBeNull();
        expect(placeholderLayer({ data: new ArrayBuffer(1) })).toBeNull();
    });

    it("gives each layer's placeholders that layer's AUs", () => {
        const sub = new LayeredSubstitute({ requestKey: () => {} });
        sub.push({ key: true, data: new Uint8Array([1]).buffer, layer: 0 });
        sub.push({ key: true, data: new Uint8Array([2]).buffer, layer: 1 });
        const low = sized(352, "key");
        const full = sized(64, "key");
        expect(sub.substitute(low)).toBe(true);
        expect(sub.substitute(full)).toBe(true);
        expect(new Uint8Array(low.data)[0]).toBe(2);
        expect(new Uint8Array(full.data)[0]).toBe(1);
    });

    it("treats an AU without a layer as the full layer's", () => {
        const sub = new LayeredSubstitute({ requestKey: () => {} });
        sub.push({ key: true, data: new Uint8Array([7]).buffer });
        const full = sized(64, "key");
        expect(sub.substitute(full)).toBe(true);
        expect(new Uint8Array(full.data)[0]).toBe(7);
        // Nothing queued for the low layer: its H.264 placeholder is dropped.
        expect(sub.substitute(sized(352, "delta"))).toBe(false);
    });

    it("asks for a keyframe on the layer that needs one", () => {
        const asked: number[] = [];
        const sub = new LayeredSubstitute({ requestKey: (l) => asked.push(l) });
        sub.push({ key: false, data: new Uint8Array([3]).buffer, layer: 1 });
        // The low layer's encoder made a keyframe; the queued AU is a delta.
        expect(sub.substitute(sized(352, "key"))).toBe(false);
        expect(asked).toEqual([1]);
    });
});
