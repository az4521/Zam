import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    FRAME_GRACE_MS,
    MIN_HIDDEN_MS,
    reviveOnReturn,
} from "./reviveOnReturn";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
    visibility = next;
    document.dispatchEvent(new Event("visibilitychange"));
}

function video(withFrameCallback: boolean) {
    const node = document.createElement("video");
    const fake = node as unknown as Record<string, unknown>;
    let frame: (() => void) | null = null;
    if (withFrameCallback) {
        fake.requestVideoFrameCallback = (cb: () => void) => {
            frame = cb;
            return 1;
        };
        fake.cancelVideoFrameCallback = () => {
            frame = null;
        };
    } else {
        fake.requestVideoFrameCallback = undefined;
    }
    return { node, presentFrame: () => frame?.() };
}

describe("reviveOnReturn", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        visibility = "visible";
        vi.spyOn(document, "visibilityState", "get").mockImplementation(
            () => visibility,
        );
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    function hideFor(ms: number) {
        setVisibility("hidden");
        vi.advanceTimersByTime(ms);
        setVisibility("visible");
    }

    it("reloads a video that draws nothing after a long hide", () => {
        const { node } = video(true);
        const reload = vi.fn();
        reviveOnReturn(node, () => true, reload);
        hideFor(MIN_HIDDEN_MS);
        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(FRAME_GRACE_MS);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("leaves alone a video that draws a frame", () => {
        const { node, presentFrame } = video(true);
        const reload = vi.fn();
        reviveOnReturn(node, () => true, reload);
        hideFor(MIN_HIDDEN_MS);
        presentFrame();
        vi.advanceTimersByTime(FRAME_GRACE_MS);
        expect(reload).not.toHaveBeenCalled();
    });

    it("ignores a short hide", () => {
        const { node } = video(true);
        const reload = vi.fn();
        reviveOnReturn(node, () => true, reload);
        hideFor(MIN_HIDDEN_MS - 1);
        vi.advanceTimersByTime(FRAME_GRACE_MS);
        expect(reload).not.toHaveBeenCalled();
    });

    it("skips an unloaded video", () => {
        const { node } = video(true);
        const reload = vi.fn();
        reviveOnReturn(node, () => false, reload);
        hideFor(MIN_HIDDEN_MS);
        vi.advanceTimersByTime(FRAME_GRACE_MS);
        expect(reload).not.toHaveBeenCalled();
    });

    it("reloads at once without requestVideoFrameCallback", () => {
        const { node } = video(false);
        const reload = vi.fn();
        reviveOnReturn(node, () => true, reload);
        hideFor(MIN_HIDDEN_MS);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("stops after teardown", () => {
        const { node } = video(true);
        const reload = vi.fn();
        const stop = reviveOnReturn(node, () => true, reload);
        hideFor(MIN_HIDDEN_MS);
        stop();
        vi.advanceTimersByTime(FRAME_GRACE_MS);
        expect(reload).not.toHaveBeenCalled();
    });
});
