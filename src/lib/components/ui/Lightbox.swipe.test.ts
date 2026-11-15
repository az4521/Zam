import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import Lightbox from "./Lightbox.svelte";

// Swiping between gallery items on touch, unless zoomed in far enough to
// pan sideways (then the drag pans the image instead). A release that steps
// calls onNext/onPrev only once its animation has ended.

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

function render(extra: Record<string, unknown> = {}) {
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
            ...extra,
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

/** Let the release animation run out (its fallback timer). */
function settle() {
    vi.advanceTimersByTime(400);
    flushSync();
}

const NEXT = { src: "https://example.org/b.png", dims: { w: 100, h: 100 } };

beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
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
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("steps back on a rightward swipe, also from the backdrop", () => {
        render();
        const backdrop = host!.querySelector("button")!;
        drag(backdrop, 50, 400, 250, 400);
        settle();
        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).not.toHaveBeenCalled();
    });

    it("moves the image with the finger while swiping", () => {
        const img = render();
        pointer(img, "pointerdown", 300, 400);
        pointer(img, "pointermove", 240, 400);
        expect(img.style.transform).toContain("translate(-60px");
        pointer(img, "pointerup", 240, 400);
        settle();
    });

    it("does not step until the release animation has run", () => {
        const img = render();
        drag(img, 300, 400, 120, 410);
        expect(onNext).not.toHaveBeenCalled();
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("steps on a short quick flick, not a short slow drag", () => {
        const img = render();
        drag(img, 200, 400, 150, 400, 600);
        settle();
        expect(onNext).not.toHaveBeenCalled();
        drag(img, 200, 400, 150, 400, 50);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("ignores a mostly vertical drag", () => {
        const img = render();
        drag(img, 200, 300, 120, 600);
        settle();
        expect(onNext).not.toHaveBeenCalled();
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("leaves a mouse drag alone", () => {
        const img = render();
        drag(img, 300, 400, 100, 400, 300, "mouse");
        settle();
        expect(onNext).not.toHaveBeenCalled();
    });

    it("pans instead once zoomed wider than the screen", () => {
        const img = render();
        // Two zoom steps: 300px * 1.5625 is wider than the 375px viewport.
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400);
        settle();
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
        settle();
        expect(onNext).not.toHaveBeenCalled();
        // ...pulling back the other way still pans...
        drag(img, 100, 400, 140, 400);
        settle();
        expect(onPrev).not.toHaveBeenCalled();
        // ...and once back at the edge, a drag past it steps.
        drag(img, 300, 400, 100, 400);
        settle();
        expect(onNext).not.toHaveBeenCalled();
        drag(img, 300, 400, 100, 400);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrev).not.toHaveBeenCalled();
    });

    it("pans, not swipes, towards a side with room to pan", () => {
        const img = render();
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400); // to the right edge
        settle();
        drag(img, 100, 400, 300, 400); // back, with room to pan that way
        settle();
        expect(onPrev).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });

    it("still swipes when zoomed but narrower than the screen", () => {
        const img = render();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        drag(img, 300, 400, 100, 400);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("slides the neighbour in beside the finger", () => {
        const img = render({ neighbours: { next: NEXT } });
        pointer(img, "pointerdown", 300, 400);
        pointer(img, "pointermove", 240, 400);
        const neighbour = host!.querySelector(
            `img[src="${NEXT.src}"]`,
        ) as HTMLImageElement;
        expect(neighbour).not.toBeNull();
        // One viewport (375px) to the right of the image's own position.
        expect(neighbour.parentElement!.style.transform).toContain(
            "translateX(315px)",
        );
        pointer(img, "pointerup", 240, 400);
        settle();
    });

    it("brings the neighbour in from off-screen when zoomed and panned to an edge", () => {
        const img = render({ neighbours: { next: NEXT } });
        for (let i = 0; i < 2; i++)
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
        flushSync();
        // Pan all the way to the image's right edge (slack included).
        drag(img, 360, 400, 0, 400);
        settle();
        drag(img, 360, 400, 0, 400);
        settle();
        pointer(img, "pointerdown", 300, 400);
        pointer(img, "pointermove", 240, 400);
        const neighbour = host!.querySelector(
            `img[src="${NEXT.src}"]`,
        ) as HTMLImageElement;
        expect(neighbour).not.toBeNull();
        // One viewport off the screen's edge, whatever the image's pan: placed
        // beside the zoomed image's centre, it showed up on screen at once.
        expect(neighbour.parentElement!.style.transform).toContain(
            "translateX(315px)",
        );
        pointer(img, "pointerup", 240, 400);
        settle();
    });

    it("removes the neighbour when the swipe is cancelled", () => {
        const img = render({ neighbours: { next: NEXT } });
        drag(img, 300, 400, 280, 400); // too short to step
        settle();
        expect(onNext).not.toHaveBeenCalled();
        expect(host!.querySelector(`img[src="${NEXT.src}"]`)).toBeNull();
    });

    it("keeps the neighbour in place until the stepped-to image loads", () => {
        const img = render({ neighbours: { next: NEXT } });
        drag(img, 300, 400, 120, 410);
        settle();
        expect(onNext).toHaveBeenCalledTimes(1);
        // The parent has not swapped the src in this test, so the handoff
        // overlay stays up over the image.
        expect(host!.querySelector(`img[src="${NEXT.src}"]`)).not.toBeNull();
        img.dispatchEvent(new Event("load"));
        flushSync();
        expect(host!.querySelector(`img[src="${NEXT.src}"]`)).toBeNull();
    });
});
