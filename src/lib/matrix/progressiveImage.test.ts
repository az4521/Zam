import { describe, it, expect, afterEach, vi } from "vitest";

// The download is a queue of chunks the test pushes by hand.
const chunks: {
    push: (c: Uint8Array) => void;
    end: () => void;
    read: () => Promise<{ done: boolean; value?: Uint8Array }>;
} = (() => {
    const queue: (Uint8Array | null)[] = [];
    let waiting: ((v: Uint8Array | null) => void) | null = null;
    const give = (v: Uint8Array | null) => {
        if (waiting) {
            const w = waiting;
            waiting = null;
            w(v);
        } else queue.push(v);
    };
    return {
        push: (c) => give(c),
        end: () => give(null),
        read: async () => {
            const v =
                queue.length > 0
                    ? queue.shift()!
                    : await new Promise<Uint8Array | null>(
                          (r) => (waiting = r),
                      );
            return v ? { done: false, value: v } : { done: true };
        },
    };
})();

vi.mock("./mediaStream", () => ({
    openAuthedReader: async () => ({ read: () => chunks.read() }),
}));

import {
    canPreviewImage,
    frameDelayMs,
    loadImageProgressively,
    PROGRESSIVE_IMAGE_MIN_BYTES,
} from "./progressiveImage";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("canPreviewImage", () => {
    it("is false where the browser has no ImageDecoder", async () => {
        vi.stubGlobal("ImageDecoder", undefined);
        expect(await canPreviewImage("image/jpeg")).toBe(false);
    });

    it("asks the decoder whether it handles the type", async () => {
        vi.stubGlobal("ImageDecoder", {
            isTypeSupported: async (t: string) => t === "image/jpeg",
        });
        expect(await canPreviewImage("image/jpeg")).toBe(true);
        expect(await canPreviewImage("image/jxl")).toBe(false);
    });

    it("is false for a missing MIME type", async () => {
        vi.stubGlobal("ImageDecoder", { isTypeSupported: async () => true });
        expect(await canPreviewImage(null)).toBe(false);
        expect(await canPreviewImage(undefined)).toBe(false);
        expect(await canPreviewImage("")).toBe(false);
    });

    it("treats a throwing decoder as unsupported", async () => {
        vi.stubGlobal("ImageDecoder", {
            isTypeSupported: async () => {
                throw new Error("nope");
            },
        });
        expect(await canPreviewImage("image/png")).toBe(false);
    });
});

describe("PROGRESSIVE_IMAGE_MIN_BYTES", () => {
    it("keeps small images on the verify-before-show path", () => {
        expect(PROGRESSIVE_IMAGE_MIN_BYTES).toBeGreaterThan(64 * 1024);
    });
});

describe("frameDelayMs", () => {
    it("uses the frame's own delay", () => {
        expect(frameDelayMs({ duration: 40_000 })).toBe(40);
    });

    it("shows 0-10 ms frames for 100 ms, like browsers do", () => {
        expect(frameDelayMs({ duration: 0 })).toBe(100);
        expect(frameDelayMs({ duration: 10_000 })).toBe(100);
        expect(frameDelayMs({ duration: null })).toBe(100);
    });
});

/**
 * A fake ImageDecoder for a 3-frame animation where chunk N completes frame N:
 * frame 0 decodes partially before its chunk lands, later frames wait for
 * theirs (as a real decoder does with completeFramesOnly).
 */
class FakeAnimatedDecoder {
    received = 0;
    closed = false;
    waiters: (() => void)[] = [];
    constructor(init: { data: ReadableStream<Uint8Array> }) {
        void (async () => {
            const reader = init.data.getReader();
            for (;;) {
                const { done } = await reader.read();
                if (done) return;
                this.received++;
                this.waiters.splice(0).forEach((w) => w());
            }
        })();
    }
    async decode(o: { frameIndex: number; completeFramesOnly?: boolean }) {
        const frame = (i: number) => ({
            image: { id: i, duration: 20_000, close: () => {} },
            complete: this.received > i,
        });
        if (o.frameIndex === 0 && o.completeFramesOnly === false) {
            return frame(0);
        }
        while (this.received <= o.frameIndex) {
            if (this.closed) throw new DOMException("closed", "AbortError");
            await new Promise<void>((r) => this.waiters.push(r));
        }
        return frame(o.frameIndex);
    }
    close() {
        this.closed = true;
        this.waiters.splice(0).forEach((w) => w());
    }
}

describe("loadImageProgressively", () => {
    it("plays an animation's frames as they arrive, before the download ends", async () => {
        vi.stubGlobal("ImageDecoder", FakeAnimatedDecoder);
        const shown: number[] = [];
        const done = loadImageProgressively("https://hs/x", {
            mimetype: "image/gif",
            onPreview: (f) => shown.push((f as unknown as { id: number }).id),
        });
        chunks.push(new Uint8Array([1]));
        await vi.waitFor(() => expect(shown).toContain(0));
        chunks.push(new Uint8Array([2]));
        await vi.waitFor(() => expect(shown).toContain(1));
        chunks.push(new Uint8Array([3]));
        await vi.waitFor(() => expect(shown).toContain(2));
        // Still downloading: nothing has ended yet, the frames played anyway.
        chunks.end();
        const blob = await done;
        expect(blob.size).toBe(3);
        expect(shown.filter((i) => i > 0)).toEqual([1, 2]);
    });

    it("holds on the last whole frame while the download catches up", async () => {
        vi.stubGlobal("ImageDecoder", FakeAnimatedDecoder);
        const shown: number[] = [];
        const done = loadImageProgressively("https://hs/x", {
            mimetype: "image/gif",
            onPreview: (f) => shown.push((f as unknown as { id: number }).id),
        });
        chunks.push(new Uint8Array([1]));
        await vi.waitFor(() => expect(shown).toContain(0));
        await new Promise((r) => setTimeout(r, 100));
        expect(shown.every((i) => i === 0)).toBe(true);
        chunks.end();
        await done;
    });
});
