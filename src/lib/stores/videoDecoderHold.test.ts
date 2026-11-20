import { describe, it, expect, vi } from "vitest";
import {
    holdVideoDecoders,
    onVideoDecodersHeldChange,
    videoDecodersHeld,
} from "./videoDecoderHold";

describe("videoDecoderHold", () => {
    it("counts overlapping holds and releases each once", () => {
        const a = holdVideoDecoders();
        const b = holdVideoDecoders();
        expect(videoDecodersHeld()).toBe(true);
        a();
        a();
        expect(videoDecodersHeld()).toBe(true);
        b();
        expect(videoDecodersHeld()).toBe(false);
    });

    it("notifies listeners on hold and release until unsubscribed", () => {
        const fn = vi.fn();
        const off = onVideoDecodersHeldChange(fn);
        const release = holdVideoDecoders();
        expect(fn).toHaveBeenCalledTimes(1);
        release();
        expect(fn).toHaveBeenCalledTimes(2);
        off();
        const again = holdVideoDecoders();
        again();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
