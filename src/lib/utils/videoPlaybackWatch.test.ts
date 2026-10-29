import { describe, it, expect, afterEach, vi } from "vitest";
import { anyVideoPlaying, watchVideoPlayback } from "./videoPlaybackWatch";

// jsdom doesn't play media; drive `paused` by hand and fire the events.
function video(): HTMLVideoElement {
    const v = document.createElement("video");
    let paused = true;
    Object.defineProperty(v, "paused", { get: () => paused });
    Object.defineProperty(v, "ended", { get: () => false });
    (v as unknown as { setPaused: (p: boolean) => void }).setPaused = (
        p: boolean,
    ) => {
        paused = p;
        v.dispatchEvent(new Event(p ? "pause" : "playing"));
    };
    document.body.appendChild(v);
    return v;
}

const setPaused = (v: HTMLVideoElement, p: boolean) =>
    (v as unknown as { setPaused: (p: boolean) => void }).setPaused(p);

afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
});

describe("videoPlaybackWatch", () => {
    it("reports when some video starts and stops playing", () => {
        const onChange = vi.fn();
        const stop = watchVideoPlayback(onChange);
        const a = video();
        const b = video();
        setPaused(a, false);
        setPaused(b, false);
        setPaused(a, true);
        expect(onChange.mock.calls).toEqual([[true]]);
        setPaused(b, true);
        expect(onChange.mock.calls).toEqual([[true], [false]]);
        stop();
    });

    it("notices a playing video removed from the page", () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        const stop = watchVideoPlayback(onChange);
        const v = video();
        setPaused(v, false);
        v.remove();
        expect(onChange).toHaveBeenLastCalledWith(true);
        vi.advanceTimersByTime(5000);
        expect(onChange).toHaveBeenLastCalledWith(false);
        stop();
    });

    it("stops listening when stopped", () => {
        const onChange = vi.fn();
        watchVideoPlayback(onChange)();
        setPaused(video(), false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("anyVideoPlaying ignores paused videos", () => {
        const v = video();
        expect(anyVideoPlaying(document)).toBe(false);
        setPaused(v, false);
        expect(anyVideoPlaying(document)).toBe(true);
    });
});
