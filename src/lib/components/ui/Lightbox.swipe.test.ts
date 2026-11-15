import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import Lightbox from "./Lightbox.svelte";

// Swiping between gallery items on touch, unless zoomed in far enough to
// pan sideways (then the drag pans the image instead).

// jsdom has no Web Animations API, which the viewer's fade-in calls.
if (!Element.prototype.animate) {
    Element.prototype.animate = (() => ({
        cancel() {},
        onfinish: null,
    })) as unknown as Element["animate"];
}

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;
let onPrev: ReturnType<typeof vi.fn<() => void>>;
let onNext: ReturnType<typeof vi.fn<() => void>>;
const realInnerWidth = window.innerWidth;

function render() {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(Lightbox, {
        target: host,
        props: {
            src: "https://example.org/a.png",
            onClose: () => {},
            onPrev,
            onNext,
            position: "2 of 3",
        },
    });
    flushSync();
    return host.querySelector("img")!;
}

let t = 0;
function pointer(
    el: Element,
    type: string,
    x: number,
    y: number,
    pointerType = "touch",
) {
    const e = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(e, "pointerId", { value: 1 });
    Object.defineProperty(e, "pointerType", { value: pointerType });
    Object.defineProperty(e, "timeStamp", { value: t });
    el.dispatchEvent(e);
    flushSync();
}

/** A drag from (x0,y0) to (x1,y1) over `ms`, in steps. */
function drag(
    el: Element,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    ms = 300,
    pointerType = "touch",
) {
    pointer(el, "pointerdown", x0, y0, pointerType);
    for (let i = 1; i <= 5; i++) {
        t += ms / 5;
        pointer(
            el,
            "pointermove",
            x0 + ((x1 - x0) * i) / 5,
            y0 + ((y1 - y0) * i) / 5,
            pointerType,
        );
    }
    pointer(el, "pointerup", x1, y1, pointerType);
}

beforeEach(() => {
    onPrev = vi.fn<() => void>();
    onNext = vi.fn<() => void>();
    Object.defineProperty(window, "innerWidth", {
        value: 375,
        configurable: true,
    });
    // jsdom lays nothing out: give the image a fitted width under the viewport.
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        get: () => 300,
        configurable: true,
    });
});

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    Object.defineProperty(window, "innerWidth", {
        value: realInnerWidth,
        configurable: true,
    });
    delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
});

describe("Lightbox swipe", () => {
    it("steps forward on a leftward swipe", () => {
        const img = render();
        drag(img, 300, 400, 120, 410);
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("steps back on a rightward swipe, also from the backdrop", () => {
        render();
        const backdrop = host!.querySelector("button")!;
        drag(backdrop, 50, 400, 250, 400);
        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).not.toHaveBeenCalled();
    });

    it("moves the image with the finger while swiping", () => {
        const img = render();
        pointer(img, "pointerdown", 300, 400);
        pointer(img, "pointermove", 240, 400);
        expect(img.style.transform).toContain("translate(-60px");
        pointer(img, "pointerup", 240, 400);
    });

    it("steps on a short quick flick, not a short slow drag", () => {
        const img = render();
        drag(img, 200, 400, 150, 400, 600);
        expect(onNext).not.toHaveBeenCalled();
        drag(img, 200, 400, 150, 400, 50);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("ignores a mostly vertical drag", () => {
        const img = render();
        drag(img, 200, 300, 120, 600);
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("leaves a mouse drag alone", () => {
        const img = render();
        drag(img, 300, 400, 100, 400, 300, "mouse");
        expect(onNext).not.toHaveBeenCalled();
    });

    it("pans instead once zoomed wider than the screen", () => {
        const img = render();
        // Two zoom steps: 300px * 1.5625 is wider than the 375px viewport.
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400);
        expect(onNext).not.toHaveBeenCalled();
        expect(img.style.transform).not.toContain("translate(0px");
    });

    it("swipes from an edge the image is already panned to", () => {
        const img = render();
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        // The first drag pans to the image's right edge and stops there...
        drag(img, 300, 400, 100, 400);
        expect(onNext).not.toHaveBeenCalled();
        // ...pulling back the other way still pans...
        drag(img, 100, 400, 140, 400);
        expect(onPrev).not.toHaveBeenCalled();
        // ...and once back at the edge, a drag past it steps.
        drag(img, 300, 400, 100, 400);
        expect(onNext).not.toHaveBeenCalled();
        drag(img, 300, 400, 100, 400);
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("pans, not swipes, towards a side with room to pan", () => {
        const img = render();
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400); // to the right edge
        drag(img, 100, 400, 300, 400); // back, with room to pan that way
        expect(onPrev).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });

    it("still swipes when zoomed but narrower than the screen", () => {
        const img = render();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400);
        expect(onNext).toHaveBeenCalledTimes(1);
    });
});
