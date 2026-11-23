import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { composerVideoPreview } from "./composerVideoPreview";

let fire: (isIntersecting: boolean) => void;

// One shared observer serves every tile (sharedIntersection), so entries
// must name their target.
class FakeObserver {
    private targets = new Set<Element>();
    constructor(cb: IntersectionObserverCallback) {
        fire = (isIntersecting) =>
            cb(
                [...this.targets].map(
                    (target) =>
                        ({
                            isIntersecting,
                            target,
                        }) as IntersectionObserverEntry,
                ),
                this as unknown as IntersectionObserver,
            );
    }
    observe(el: Element) {
        this.targets.add(el);
    }
    unobserve(el: Element) {
        this.targets.delete(el);
    }
    disconnect() {
        this.targets.clear();
    }
}

const live: Array<{ destroy?: () => void }> = [];

function preview(url: string) {
    const node = document.createElement("video");
    node.load = vi.fn();
    const action = composerVideoPreview(node, url);
    live.push(action);
    return { node, action };
}

describe("composerVideoPreview", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        // Ends the shared observer, so the next test builds a fresh one.
        for (const a of live.splice(0)) a.destroy?.();
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
