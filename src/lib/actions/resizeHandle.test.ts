import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    resizeKeyDelta,
    clampSize,
    resizeHandle,
    RESIZE_STEP_PX,
    RESIZE_STEP_LARGE_PX,
} from "./resizeHandle";

// Direction convention: the grip sits at the panel's TOP-LEFT and the panel is
// anchored bottom-right in the composer, so the pointer drag uses
// `start.w + (start.x - e.clientX)` — moving the grip left/up GROWS the panel.
// The keyboard must agree with the mouse or the two paths contradict each other.
describe("resizeKeyDelta", () => {
    it("grows the panel when the grip moves up or left", () => {
        expect(resizeKeyDelta("ArrowLeft", false)).toEqual({
            dw: RESIZE_STEP_PX,
            dh: 0,
        });
        expect(resizeKeyDelta("ArrowUp", false)).toEqual({
            dw: 0,
            dh: RESIZE_STEP_PX,
        });
    });

    it("shrinks it when the grip moves down or right", () => {
        expect(resizeKeyDelta("ArrowRight", false)).toEqual({
            dw: -RESIZE_STEP_PX,
            dh: 0,
        });
        expect(resizeKeyDelta("ArrowDown", false)).toEqual({
            dw: 0,
            dh: -RESIZE_STEP_PX,
        });
    });

    it("uses the large step with Shift", () => {
        expect(resizeKeyDelta("ArrowLeft", true)).toEqual({
            dw: RESIZE_STEP_LARGE_PX,
            dh: 0,
        });
        expect(resizeKeyDelta("ArrowDown", true)).toEqual({
            dw: 0,
            dh: -RESIZE_STEP_LARGE_PX,
        });
    });

    it("takes a bigger bite with the large step than without it", () => {
        expect(RESIZE_STEP_LARGE_PX).toBeGreaterThan(RESIZE_STEP_PX);
    });

    it("ignores keys it does not own", () => {
        for (const key of ["Enter", " ", "Escape", "Tab", "a", "Home", "End"]) {
            expect(resizeKeyDelta(key, false)).toBeNull();
            expect(resizeKeyDelta(key, true)).toBeNull();
        }
    });
});

describe("clampSize", () => {
    const b = { minW: 260, minH: 260, maxW: 800, maxH: 600 };

    it("passes a size that is already in range", () => {
        expect(clampSize(400, 400, b)).toEqual({ w: 400, h: 400 });
    });

    it("clamps to the minimum", () => {
        expect(clampSize(10, -5, b)).toEqual({ w: 260, h: 260 });
    });

    it("clamps to the maximum", () => {
        expect(clampSize(9999, 9999, b)).toEqual({ w: 800, h: 600 });
    });

    it("clamps each axis independently", () => {
        expect(clampSize(9999, 10, b)).toEqual({ w: 800, h: 260 });
        expect(clampSize(10, 9999, b)).toEqual({ w: 260, h: 600 });
    });

    it("lets the maximum win when it is below the minimum", () => {
        expect(
            clampSize(500, 500, { minW: 400, minH: 400, maxW: 300, maxH: 300 }),
        ).toEqual({ w: 300, h: 300 });
    });
});

// The grip is a 16x16 corner control that used to be mouse-only (A11Y-12).
// jsdom gives every element `offsetWidth === 0`, so these tests read the applied
// inline style — which is also what the action itself now tracks internally.
describe("resizeHandle keyboard resizing", () => {
    let teardown: (() => void) | null = null;
    const OPTS = { storageKey: "testPicker", defaultW: 400, defaultH: 400 };

    beforeEach(() => localStorage.clear());
    afterEach(() => {
        teardown?.();
        teardown = null;
        localStorage.clear();
    });

    function mount() {
        const panel = document.createElement("div");
        const grip = document.createElement("button");
        panel.appendChild(grip);
        document.body.appendChild(panel);
        const handle = resizeHandle(grip, OPTS);
        teardown = () => {
            handle?.destroy();
            panel.remove();
        };
        return { panel, grip };
    }

    const width = (panel: HTMLElement) => parseInt(panel.style.width, 10);
    const height = (panel: HTMLElement) => parseInt(panel.style.height, 10);

    function press(grip: HTMLElement, key: string, shiftKey = false) {
        const evt = new KeyboardEvent("keydown", {
            key,
            shiftKey,
            bubbles: true,
            cancelable: true,
        });
        grip.dispatchEvent(evt);
        return evt;
    }

    it("grows the panel on ArrowLeft and persists the new width", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        press(grip, "ArrowLeft");
        expect(width(panel)).toBe(before + RESIZE_STEP_PX);
        expect(localStorage.getItem("testPicker:w")).toBe(
            String(before + RESIZE_STEP_PX),
        );
    });

    it("grows the panel on ArrowUp and persists the new height", () => {
        const { panel, grip } = mount();
        const before = height(panel);
        press(grip, "ArrowUp");
        expect(height(panel)).toBe(before + RESIZE_STEP_PX);
        expect(localStorage.getItem("testPicker:h")).toBe(
            String(before + RESIZE_STEP_PX),
        );
    });

    it("shrinks it on ArrowDown", () => {
        const { panel, grip } = mount();
        const before = height(panel);
        press(grip, "ArrowDown");
        expect(height(panel)).toBe(before - RESIZE_STEP_PX);
    });

    it("shrinks it on ArrowRight", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        press(grip, "ArrowRight");
        expect(width(panel)).toBe(before - RESIZE_STEP_PX);
    });

    it("takes the large step with Shift held", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        press(grip, "ArrowLeft", true);
        expect(width(panel)).toBe(before + RESIZE_STEP_LARGE_PX);
    });

    it("accumulates presses instead of restarting from the mounted size", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        press(grip, "ArrowLeft");
        press(grip, "ArrowLeft");
        press(grip, "ArrowLeft");
        expect(width(panel)).toBe(before + 3 * RESIZE_STEP_PX);
    });

    it("never shrinks below the minimum", () => {
        const { panel, grip } = mount();
        for (let i = 0; i < 40; i++) press(grip, "ArrowRight");
        expect(width(panel)).toBe(260);
        expect(height(panel)).toBe(400);
    });

    it("claims the arrow keys so the panel does not scroll behind it", () => {
        const { grip } = mount();
        expect(press(grip, "ArrowLeft").defaultPrevented).toBe(true);
    });

    // The picker panels bind their own keydown (Escape closes, and the search
    // box runs the emoji/sticker grid's arrow navigation). Anything the grip
    // does not own must reach them untouched.
    it("leaves keys it does not own alone", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        for (const key of ["Enter", " ", "Escape", "Tab", "Home"]) {
            expect(press(grip, key).defaultPrevented).toBe(false);
        }
        expect(width(panel)).toBe(before);
    });

    it("lets its keys bubble to the picker panel", () => {
        const { panel, grip } = mount();
        const seen: string[] = [];
        panel.addEventListener("keydown", (e) => seen.push(e.key));
        press(grip, "ArrowLeft");
        press(grip, "Escape");
        expect(seen).toEqual(["ArrowLeft", "Escape"]);
    });

    // Rubric 10: keyboard and pointer must share one clamp/persist path, and the
    // drag must still start from the size the keyboard left behind.
    it("resumes a pointer drag from the keyboard-applied size", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        press(grip, "ArrowLeft");
        grip.setPointerCapture = () => {};
        grip.dispatchEvent(
            new PointerEvent("pointerdown", {
                clientX: 100,
                clientY: 100,
                bubbles: true,
                cancelable: true,
            }),
        );
        grip.dispatchEvent(
            new PointerEvent("pointermove", { clientX: 90, clientY: 100 }),
        );
        grip.dispatchEvent(new PointerEvent("pointerup", {}));
        expect(width(panel)).toBe(before + RESIZE_STEP_PX + 10);
        expect(localStorage.getItem("testPicker:w")).toBe(
            String(before + RESIZE_STEP_PX + 10),
        );
    });

    it("stops resizing after destroy", () => {
        const { panel, grip } = mount();
        const before = width(panel);
        teardown?.();
        teardown = null;
        press(grip, "ArrowLeft");
        expect(width(panel)).toBe(before);
    });
});
