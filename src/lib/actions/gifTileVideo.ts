import { reviveOnReturn } from "./reviveOnReturn";
import { scrollParent } from "./unloadOffscreen";
import {
    onVideoDecodersHeldChange,
    videoDecodersHeld,
} from "$lib/stores/videoDecoderHold";
import { observeShared } from "$lib/utils/sharedIntersection";
import { PlaybackSlots } from "$lib/utils/playbackSlots";

/** One viewport's height above and below the scroller: tiles a screen away
 *  keep playing, so scrolling back shows no blank or reloading tile. Only
 *  tiles well outside this are released. */
const MARGIN = "100% 0px";

/** Most picker tiles playing at once across the app. The hardware decoder
 *  pool is small; past this the driver returns corrupt frames. */
export const MAX_PLAYING_TILES = 12;

const playingTiles = new PlaybackSlots<object>(MAX_PLAYING_TILES);

export interface TileGate {
    /** Re-run the grant: drop the current one and take it again. */
    refresh(): void;
    destroy(): void;
}

/**
 * Decide when a tile may play: it must be near the scroller's viewport, not
 * held by an open Lightbox, and inside the concurrency cap. `onActive` is
 * called with true when the tile is granted playback and false when it is
 * released. Every tile of the picker shares one observer (sharedIntersection)
 * and the one slot budget.
 */
export function gateTile(
    node: Element,
    onActive: (on: boolean) => void,
): TileGate {
    const key = {};
    const hasObserver = typeof IntersectionObserver === "function";
    // Without an observer there is no way to tell, so every tile is near.
    let near = !hasObserver;
    let held = videoDecodersHeld();
    let granted = false;

    function grant() {
        granted = true;
        onActive(true);
    }

    function dropSlot() {
        playingTiles.cancel(key);
        if (!granted) return;
        granted = false;
        onActive(false);
    }

    function sync() {
        if (near && !held) playingTiles.request(key, grant);
        else dropSlot();
    }

    const unobserve = hasObserver
        ? observeShared(node, scrollParent(node), MARGIN, (entry) => {
              near = entry.isIntersecting;
              sync();
          })
        : null;
    const stopHolding = onVideoDecodersHeldChange(() => {
        held = videoDecodersHeld();
        sync();
    });
    if (!hasObserver) sync();

    return {
        refresh() {
            if (!granted) return;
            dropSlot();
            sync();
        },
        destroy() {
            unobserve?.();
            stopHolding();
            dropSlot();
        },
    };
}

/**
 * Svelte action: gate any element (typically an overlay over a tile) with
 * {@link gateTile}. The callback can be replaced by re-binding the action.
 */
export function gifTileSlot(
    node: Element,
    onActive: (on: boolean) => void,
): { update(next: (on: boolean) => void): void; destroy(): void } {
    let callback = onActive;
    const gate = gateTile(node, (on) => callback(on));
    return {
        update(next) {
            callback = next;
        },
        destroy() {
            gate.destroy();
        },
    };
}

/**
 * Svelte action: own a picker tile's looping `<video>`, giving it a source only
 * while it is near the scroller's viewport and under the playing cap.
 *
 * Hardware decoders are a small fixed pool (D3D11VA on Windows, VA-API on
 * Linux). Starting every result at once, plus every page of "load more" on
 * top, exhausts it: the driver then hands back corrupt frames (a green bar) or
 * takes the GPU process down. Only the tiles in or near view hold a decoder,
 * and at most {@link MAX_PLAYING_TILES} do. The `poster`, when there is one,
 * stays up while a tile is unloaded; the caller's aspect ratio sizes its box,
 * so nothing shifts.
 */
export function gifTileVideo(node: HTMLVideoElement, url: string) {
    let current = url;
    let loaded = false;

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

    const gate = gateTile(node, (on) => (on ? load() : unload()));
    // Its player is freed while the window sits hidden (reviveOnReturn).
    const stopReviving = reviveOnReturn(
        node,
        () => loaded,
        () => gate.refresh(),
    );

    return {
        update(next: string) {
            if (next === current) return;
            current = next;
            if (loaded) node.src = next;
        },
        destroy() {
            stopReviving();
            gate.destroy();
            unload();
        },
    };
}
