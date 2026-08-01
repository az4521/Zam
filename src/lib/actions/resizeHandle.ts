// Reusable resize grip for the composer pickers (GIF / Emoji / Sticker).
//
// Attach to a small grip element that is a direct child of the panel you want
// to resize. Dragging the grip resizes that parent panel; the size is clamped
// between a minimum and the chat content area (the `[data-chat-area]` ancestor)
// so it can grow to fill the chat but never crosses the sidebar or covers the
// top bar, and is persisted to localStorage under `storageKey`. The panel is
// anchored bottom-right in the composer, so dragging up/left enlarges it. On
// touch the grip is not rendered, so this never runs there.

import { resolvePickerSize, type PickerSizeOpts } from "$lib/utils/pickerSize";

interface ResizeOpts extends PickerSizeOpts {
    minW?: number;
    minH?: number;
}

/** One arrow press. */
export const RESIZE_STEP_PX = 24;
/** One Shift+arrow press, for crossing the range without holding a key down. */
export const RESIZE_STEP_LARGE_PX = 96;

/**
 * Size delta for one keyboard resize press, or null when the key is not ours.
 *
 * The grip is top-left on a bottom-right-anchored panel, and the pointer drag
 * computes `start.w + (start.x - e.clientX)` — moving the grip LEFT grows the
 * width, UP grows the height. The keyboard has to agree with that or the same
 * control means opposite things to a mouse and a keyboard. Pure: no DOM.
 */
export function resizeKeyDelta(
    key: string,
    shiftKey: boolean,
): { dw: number; dh: number } | null {
    const step = shiftKey ? RESIZE_STEP_LARGE_PX : RESIZE_STEP_PX;
    switch (key) {
        case "ArrowLeft":
            return { dw: step, dh: 0 };
        case "ArrowRight":
            return { dw: -step, dh: 0 };
        case "ArrowUp":
            return { dw: 0, dh: step };
        case "ArrowDown":
            return { dw: 0, dh: -step };
        default:
            return null;
    }
}

/**
 * Clamps a size into its bounds. The maximum is applied last so that a maximum
 * below the minimum (a chat area narrower than the picker's floor) still wins —
 * overflowing the visible area would put the grip itself out of reach.
 */
export function clampSize(
    w: number,
    h: number,
    b: { minW: number; minH: number; maxW: number; maxH: number },
): { w: number; h: number } {
    return {
        w: Math.min(b.maxW, Math.max(b.minW, w)),
        h: Math.min(b.maxH, Math.max(b.minH, h)),
    };
}

export function resizeHandle(node: HTMLElement, opts: ResizeOpts) {
    const panel = node.parentElement;
    if (!panel) return;

    const minW = opts.minW ?? 260;
    const minH = opts.minH ?? 260;
    const HEADER_H = 48; // room header (top bar) height (h-12)

    // Max size = the chat content area. The panel may grow to fill it but not
    // cross the sidebar (left) or cover the top bar (top). Its right/bottom are
    // pinned to the composer corner, so those edges are the fixed anchor.
    // Falls back to the viewport when no [data-chat-area] ancestor is found.
    function maxSize(): { w: number; h: number } {
        const pr = panel!.getBoundingClientRect();
        const area = panel!.closest("[data-chat-area]");
        if (area) {
            const ar = area.getBoundingClientRect();
            return {
                w: Math.max(minW, pr.right - ar.left),
                h: Math.max(minH, pr.bottom - ar.top - HEADER_H),
            };
        }
        return {
            w: Math.max(minW, window.innerWidth - 24),
            h: Math.max(minH, window.innerHeight - 24),
        };
    }

    function readNum(key: string): number | null {
        try {
            const v = Number(localStorage.getItem(key));
            return Number.isFinite(v) && v > 0 ? v : null;
        } catch {
            return null;
        }
    }
    // The size we last applied. This — NOT `panel.offsetWidth` — is the single
    // source of truth for the drag origin and for persistence: offsetWidth is a
    // rounded integer (so repeated small steps would drift) and it is 0 in
    // jsdom, which would make every test here silently meaningless.
    const current = { w: 0, h: 0 };

    function apply(w: number, h: number) {
        const max = maxSize();
        const next = clampSize(w, h, {
            minW,
            minH,
            maxW: max.w,
            maxH: max.h,
        });
        current.w = next.w;
        current.h = next.h;
        panel!.style.width = next.w + "px";
        panel!.style.height = next.h + "px";
    }

    function persist() {
        try {
            localStorage.setItem(opts.storageKey + ":w", String(current.w));
            localStorage.setItem(opts.storageKey + ":h", String(current.h));
        } catch {
            /* ignore (private mode / storage full) */
        }
    }

    const initial = resolvePickerSize(readNum, opts);
    apply(initial.w, initial.h);

    let start: { x: number; y: number; w: number; h: number } | null = null;
    function down(e: PointerEvent) {
        start = {
            x: e.clientX,
            y: e.clientY,
            w: current.w,
            h: current.h,
        };
        node.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    }
    function move(e: PointerEvent) {
        if (!start) return;
        apply(start.w + (start.x - e.clientX), start.h + (start.y - e.clientY));
    }
    function up() {
        if (!start) return;
        start = null;
        persist();
    }

    // Keyboard resizing (A11Y-12). Routed through the SAME apply()/persist() as
    // the drag so the two can never clamp or store differently. Only the four
    // arrows are claimed; everything else (Escape, Tab, Enter) bubbles on to the
    // picker panel's own keydown untouched.
    function onKeydown(e: KeyboardEvent) {
        const delta = resizeKeyDelta(e.key, e.shiftKey);
        if (!delta) return;
        e.preventDefault();
        apply(current.w + delta.dw, current.h + delta.dh);
        persist();
    }

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("keydown", onKeydown);

    return {
        destroy() {
            node.removeEventListener("pointerdown", down);
            node.removeEventListener("pointermove", move);
            node.removeEventListener("pointerup", up);
            node.removeEventListener("pointercancel", up);
            node.removeEventListener("keydown", onKeydown);
        },
    };
}
