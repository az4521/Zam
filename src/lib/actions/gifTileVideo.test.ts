import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gifTileVideo, MAX_PLAYING_TILES } from "./gifTileVideo";
import { holdVideoDecoders } from "$lib/stores/videoDecoderHold";

// One fake observer per (root, margin) pool. `fire` reports every target the
// latest observer watches, so each test that observes a single tile is exact.
let last: FakeObserver;

class FakeObserver {
    readonly targets = new Set<Element>();
    readonly cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
        last = this;
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

function fire(isIntersecting: boolean) {
    const entries = [...last.targets].map(
        (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
    );
    last.cb(entries, last as unknown as IntersectionObserver);
}

const actions: Array<{ destroy?: () => void }> = [];

function tile(url: string) {
    const node = document.createElement("video");
    node.load = vi.fn();
    const action = gifTileVideo(node, url);
    actions.push(action);
    return { node, action };
}

describe("gifTileVideo", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
    });
    afterEach(() => {
        for (const a of actions.splice(0)) a.destroy?.();
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

    it("drops its src while a Lightbox holds the decoders, and restores it on release", () => {
        const { node } = tile("https://x/a.mp4");
        fire(true);
        expect(node.getAttribute("src")).toBe("https://x/a.mp4");
        const release = holdVideoDecoders();
        expect(node.getAttribute("src")).toBeNull();
        // Still held: scrolling into view again must not reload it.
        fire(false);
        fire(true);
        expect(node.getAttribute("src")).toBeNull();
        release();
        expect(node.getAttribute("src")).toBe("https://x/a.mp4");
    });

    it("stays unloaded after release if the tile is out of view", () => {
        const { node } = tile("https://x/a.mp4");
        fire(false);
        const release = holdVideoDecoders();
        release();
        expect(node.getAttribute("src")).toBeNull();
    });

    it("caps how many tiles play at once and starts a waiter when one leaves", () => {
        // Tiles stay alive for the whole test, so the cap is what stops them.
        const tiles = Array.from({ length: MAX_PLAYING_TILES + 1 }, (_, i) =>
            tile(`https://x/${i}.mp4`),
        );
        // One observer serves all of them; report each one in view.
        fire(true);
        const playing = tiles.filter((t) => t.node.getAttribute("src"));
        expect(playing).toHaveLength(MAX_PLAYING_TILES);
        // The overflow tile is the one waiting.
        const waiting = tiles[MAX_PLAYING_TILES];
        expect(waiting.node.getAttribute("src")).toBeNull();
        // Destroying a playing tile hands its slot to the waiter.
        tiles[0].action.destroy?.();
        expect(waiting.node.getAttribute("src")).toBe(
            `https://x/${MAX_PLAYING_TILES}.mp4`,
        );
    });
});
