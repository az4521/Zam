import { reviveOnReturn } from "./reviveOnReturn";
import { scrollParent } from "./unloadOffscreen";
import {
    onVideoDecodersHeldChange,
    videoDecodersHeld,
} from "$lib/stores/videoDecoderHold";

/** Just past the scroller's edges, so a tile is already playing when it
 *  scrolls in. Far tighter than unloadOffscreen's margin: that one guards a
 *  timeline of a few clips, this one a grid of dozens. */
const MARGIN = "25% 0px";

/**
 * Svelte action: own a picker tile's looping `<video>`, giving it a source only
 * while it is near the scroller's viewport.
 *
 * Hardware decoders are a small fixed pool (D3D11VA on Windows, VA-API on
 * Linux). The picker used to start every result at once, and every page of
 * "load more" on top, which exhausts it: the driver then hands back corrupt
 * frames (a green bar) or takes the GPU process down. Only the tiles in view
 * hold a decoder now. The `poster`, when there is one, stays up while a tile
 * is unloaded; the caller's aspect ratio sizes its box, so nothing shifts.
 */
export function gifTileVideo(node: HTMLVideoElement, url: string) {
    let current = url;
    let loaded = false;
    // Whether the tile is near view, and whether an open Lightbox holds the
    // decoders (see videoDecoderHold). A src is held only when both allow it.
    let near = typeof IntersectionObserver !== "function";
    let held = videoDecodersHeld();

    function load() {
        if (loaded) return;
        loaded = true;
        node.src = current;
    }

    function unload() {
        if (!loaded) return;
        loaded = false;
        node.removeAttribute("src");
        node.load();
    }

    function sync() {
        if (near && !held) load();
        else unload();
    }

    const stopHolding = onVideoDecodersHeldChange(() => {
        held = videoDecodersHeld();
        sync();
    });

    if (typeof IntersectionObserver !== "function") {
        sync();
        return {
            update(next: string) {
                current = next;
                if (loaded) node.src = next;
            },
            destroy() {
                stopHolding();
                unload();
            },
        };
    }

    const observer = new IntersectionObserver(
        ([entry]) => {
            near = entry.isIntersecting;
            sync();
        },
        { root: scrollParent(node), rootMargin: MARGIN, threshold: 0 },
    );
    observer.observe(node);
    // Its player is freed while the window sits hidden (reviveOnReturn).
    const stopReviving = reviveOnReturn(
        node,
        () => loaded,
        () => {
            unload();
            sync();
        },
    );

    return {
        update(next: string) {
            if (next === current) return;
            current = next;
            if (loaded) node.src = next;
        },
        destroy() {
            observer.disconnect();
            stopReviving();
            stopHolding();
            unload();
        },
    };
}
