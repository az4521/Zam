// Reusable resize grip for the composer pickers (GIF / Emoji / Sticker).
//
// Attach to a small grip element that is a direct child of the panel you want
// to resize. Dragging the grip resizes that parent panel; the size is clamped
// between a minimum and the chat content area (the `[data-chat-area]` ancestor)
// so it can grow to fill the chat but never crosses the sidebar or covers the
// top bar, and is persisted to localStorage under `storageKey`. The panel is
// anchored bottom-right in the composer, so dragging up/left enlarges it. On
// touch the grip is not rendered, so this never runs there.

interface ResizeOpts {
    /** localStorage prefix, e.g. "gifPicker" -> keys "gifPicker:w"/"gifPicker:h". */
    storageKey: string;
    defaultW: number;
    defaultH: number;
    minW?: number;
    minH?: number;
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
    function apply(w: number, h: number) {
        const max = maxSize();
        panel!.style.width = Math.min(max.w, Math.max(minW, w)) + "px";
        panel!.style.height = Math.min(max.h, Math.max(minH, h)) + "px";
    }

    apply(
        readNum(opts.storageKey + ":w") ?? opts.defaultW,
        readNum(opts.storageKey + ":h") ?? opts.defaultH,
    );

    let start: { x: number; y: number; w: number; h: number } | null = null;
    function down(e: PointerEvent) {
        start = {
            x: e.clientX,
            y: e.clientY,
            w: panel!.offsetWidth,
            h: panel!.offsetHeight,
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
        try {
            localStorage.setItem(
                opts.storageKey + ":w",
                String(panel!.offsetWidth),
            );
            localStorage.setItem(
                opts.storageKey + ":h",
                String(panel!.offsetHeight),
            );
        } catch {
            /* ignore (private mode / storage full) */
        }
    }

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);

    return {
        destroy() {
            node.removeEventListener("pointerdown", down);
            node.removeEventListener("pointermove", move);
            node.removeEventListener("pointerup", up);
            node.removeEventListener("pointercancel", up);
        },
    };
}
