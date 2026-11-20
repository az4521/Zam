import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { composerVideoPreview } from "./composerVideoPreview";

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

function preview(url: string) {
    const node = document.createElement("video");
    node.load = vi.fn();
    return { node, action: composerVideoPreview(node, url) };
}

describe("composerVideoPreview", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("holds no decoder until the tile is in the strip's view", () => {
        const { node } = preview("blob:a#t=0.001");
        expect(node.getAttribute("src")).toBeNull();
        fire(true);
        expect(node.getAttribute("src")).toBe("blob:a#t=0.001");
    });

    it("releases the decoder when the tile scrolls out", () => {
        const { node } = preview("blob:a#t=0.001");
        fire(true);
        fire(false);
        expect(node.getAttribute("src")).toBeNull();
        expect(node.load).toHaveBeenCalledTimes(1);
    });

    it("moves to the new file's source on update", () => {
        const { node, action } = preview("blob:a#t=0.001");
        fire(true);
        action.update("blob:b#t=0.001");
        expect(node.getAttribute("src")).toBe("blob:b#t=0.001");
    });

    it("releases the decoder when the tile is destroyed", () => {
        const { node, action } = preview("blob:a#t=0.001");
        fire(true);
        action.destroy();
        expect(node.getAttribute("src")).toBeNull();
    });
});
