import { describe, it, expect } from "vitest";
import { createFrameRelay } from "./frameRelay";

function fakeCanvas() {
    const drawn: unknown[] = [];
    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (src: unknown) => drawn.push(src) }),
    };
    return { canvas: canvas as unknown as HTMLCanvasElement, drawn };
}

const frame = (w: number, h: number) =>
    ({ displayWidth: w, displayHeight: h }) as unknown as VideoFrame;

describe("createFrameRelay", () => {
    it("draws each frame on every attached canvas, sized to it", () => {
        const relay = createFrameRelay();
        const a = fakeCanvas();
        const b = fakeCanvas();
        relay.attach(a.canvas);
        relay.attach(b.canvas);
        const f = frame(40, 30);
        relay.draw(f);
        expect(a.drawn).toEqual([f]);
        expect(b.drawn).toEqual([f]);
        expect([b.canvas.width, b.canvas.height]).toEqual([40, 30]);
    });

    it("fills a late canvas from one that already has a frame", () => {
        const relay = createFrameRelay();
        const tile = fakeCanvas();
        relay.attach(tile.canvas);
        relay.draw(frame(40, 30));
        const viewer = fakeCanvas();
        let landed = 0;
        relay.attach(viewer.canvas, () => landed++);
        expect(viewer.drawn).toEqual([tile.canvas]);
        expect([viewer.canvas.width, viewer.canvas.height]).toEqual([40, 30]);
        expect(landed).toBe(1);
    });

    it("leaves a late canvas empty when nothing has been drawn yet", () => {
        const relay = createFrameRelay();
        relay.attach(fakeCanvas().canvas);
        const viewer = fakeCanvas();
        let landed = 0;
        relay.attach(viewer.canvas, () => landed++);
        expect(viewer.drawn).toEqual([]);
        expect(landed).toBe(0);
    });

    it("stops drawing on a detached canvas", () => {
        const relay = createFrameRelay();
        const a = fakeCanvas();
        const detach = relay.attach(a.canvas);
        detach();
        relay.draw(frame(1, 1));
        expect(a.drawn).toEqual([]);
    });
});
