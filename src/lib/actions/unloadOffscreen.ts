/** How far past the scroller's edges a video stays loaded, so a short scroll
 *  back doesn't refetch and a quick flick past doesn't unload. */
export const KEEP_MARGIN = "150% 0px";

/** The nearest ancestor that scrolls vertically, or null for the viewport.
 *  The observer needs it as its root: with the implicit viewport root the
 *  margin can't reach past the timeline's own clipping edge. */
export function scrollParent(node: Element): Element | null {
    for (let el = node.parentElement; el; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === "auto" || overflowY === "scroll") return el;
    }
    return null;
}

/**
 * Svelte action: own a looping `<video>`'s `src`, dropping it while the
 * element is well out of view and putting it back on the way in.
 *
 * A muted autoplay video that has scrolled away may stop painting, but its
 * fetched media, demuxer and decoder all stay resident for as long as the
 * element exists — and the timeline never unmounts rows. Removing `src` and
 * calling `load()` is the spec'd way to release that resource.
 *
 * The box is pinned to its last measured size while unloaded: these videos
 * size from their intrinsic dimensions, so an empty element would collapse
 * and shift every row below it.
 */
export function unloadOffscreen(node: HTMLVideoElement, url: string) {
    let current = url;
    let loaded = false;

    function load() {
        if (loaded) return;
        loaded = true;
        node.src = current;
        // Keep the pinned size until there is a frame to size from.
        node.addEventListener(
            "loadeddata",
            () => {
                if (!loaded) return;
                node.style.width = "";
                node.style.height = "";
            },
            { once: true },
        );
    }

    function unload() {
        if (!loaded) return;
        loaded = false;
        const { width, height } = node.getBoundingClientRect();
        if (width > 0 && height > 0) {
            node.style.width = `${width}px`;
            node.style.height = `${height}px`;
        }
        node.removeAttribute("src");
        node.load();
    }

    if (typeof IntersectionObserver !== "function") {
        load();
        return {
            update(next: string) {
                if (next === current) return;
                current = next;
                node.src = next;
            },
        };
    }

    const observer = new IntersectionObserver(
        ([entry]) => (entry.isIntersecting ? load() : unload()),
        { root: scrollParent(node), rootMargin: KEEP_MARGIN, threshold: 0 },
    );
    observer.observe(node);

    return {
        update(next: string) {
            if (next === current) return;
            current = next;
            if (loaded) node.src = next;
        },
        destroy() {
            observer.disconnect();
            loaded = false;
            node.removeAttribute("src");
            node.load();
        },
    };
}
