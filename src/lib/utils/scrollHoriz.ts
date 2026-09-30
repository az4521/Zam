/**
 * True when the touch started inside a horizontally-scrollable element (a
 * wide code block, table, etc.) that can still scroll in the swipe's
 * direction — in which case we let it scroll natively instead of hijacking
 * the gesture to drag the drawer.
 */
export function targetCanScrollHoriz(el: Element | null, dx: number): boolean {
    let node: Element | null = el;
    while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth + 1) {
            const overflowX = getComputedStyle(node).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") {
                const maxScroll = node.scrollWidth - node.clientWidth;
                // RTL scrollers report scrollLeft in [-max, 0] (0 = the right
                // edge); shift it so `left` is always the physical distance
                // scrolled from the left edge.
                const rtl = getComputedStyle(node).direction === "rtl";
                const left = rtl
                    ? node.scrollLeft + maxScroll
                    : node.scrollLeft;
                // Swipe right (dx > 0) reveals content to the left; swipe
                // left (dx < 0) reveals content to the right.
                if (dx > 0 && left > 0) return true;
                if (dx < 0 && left < maxScroll) return true;
            }
        }
        node = node.parentElement;
    }
    return false;
}
