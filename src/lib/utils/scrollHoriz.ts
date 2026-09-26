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
                // Swipe right (dx > 0) scrolls content toward the start;
                // swipe left (dx < 0) scrolls toward the end.
                if (dx > 0 && node.scrollLeft > 0) return true;
                if (dx < 0 && node.scrollLeft < maxScroll) return true;
            }
        }
        node = node.parentElement;
    }
    return false;
}
