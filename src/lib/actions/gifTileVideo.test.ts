import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gifTileVideo } from "./gifTileVideo";

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

function tile(url: string) {
    const node = document.createElement("video");
    node.load = vi.fn();
    return { node, action: gifTileVideo(node, url) };
}

describe("gifTileVideo", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("holds no source until the tile is near view", () => {
        const { node } = tile("https://x/a.mp4");
        expect(node.getAttribute("src")).toBeNull();
        fire(true);
        expect(node.getAttribute("src")).toBe("https://x/a.mp4");
    });

    it("releases the decoder on the way out and reloads on the way back", () => {
        const { node } = tile("https://x/a.mp4");
        fire(true);
        fire(false);
        expect(node.getAttribute("src")).toBeNull();
        expect(node.load).toHaveBeenCalledTimes(1);
        fire(true);
        expect(node.getAttribute("src")).toBe("https://x/a.mp4");
    });

    it("releases the decoder when the tile is destroyed", () => {
        const { node, action } = tile("https://x/a.mp4");
        fire(true);
        action.destroy?.();
        expect(node.getAttribute("src")).toBeNull();
    });
});
