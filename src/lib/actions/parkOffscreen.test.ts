import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parkOffscreen } from "./parkOffscreen";

let fire: (isIntersecting: boolean) => void;

class FakeObserver {
    constructor(cb: IntersectionObserverCallback) {
        fire = (isIntersecting) =>
            cb(
                [{ isIntersecting } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
            );
    }
    observe() {}
    disconnect() {}
}

function video(state: { paused: boolean; ended?: boolean; t?: number }) {
    const node = document.createElement("video");
    Object.defineProperty(node, "paused", { get: () => state.paused });
    Object.defineProperty(node, "ended", { get: () => !!state.ended });
    Object.defineProperty(node, "currentTime", { get: () => state.t ?? 0 });
    return node;
}

describe("parkOffscreen", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("parks a paused video once it is out of view, with its position", () => {
        const onPark = vi.fn();
        parkOffscreen(video({ paused: true, t: 12.5 }), onPark);
        fire(true);
        expect(onPark).not.toHaveBeenCalled();
        fire(false);
        expect(onPark).toHaveBeenCalledWith(12.5);
        fire(true);
        fire(false);
        expect(onPark).toHaveBeenCalledTimes(1);
    });

    it("leaves a playing video alone until it pauses away", () => {
        const state = { paused: false, t: 3 };
        const node = video(state);
        const onPark = vi.fn();
        parkOffscreen(node, onPark);
        fire(false);
        expect(onPark).not.toHaveBeenCalled();
        state.paused = true;
        node.dispatchEvent(new Event("pause"));
        expect(onPark).toHaveBeenCalledWith(3);
    });

    it("resumes an ended video from the start", () => {
        const onPark = vi.fn();
        parkOffscreen(video({ paused: true, ended: true, t: 9 }), onPark);
        fire(false);
        expect(onPark).toHaveBeenCalledWith(0);
    });
});
