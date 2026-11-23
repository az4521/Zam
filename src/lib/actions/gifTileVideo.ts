import { reviveOnReturn } from "./reviveOnReturn";
import { scrollParent } from "./unloadOffscreen";
import {
    onVideoDecodersHeldChange,
    videoDecodersHeld,
} from "$lib/stores/videoDecoderHold";
import { observeShared } from "$lib/utils/sharedIntersection";

/** A quarter of the viewport above and below the scroller: tiles about to
 *  scroll in are already playing, while tiles well out of view hold no
 *  decoder. What plays follows what is visible; there is no count cap, since
 *  the viewport already bounds how many tiles are on screen. */
const MARGIN = "25% 0px";

export interface TileGate {
    /** Re-run the grant: drop the current one and take it again. */
    refresh(): void;
    destroy(): void;
}

/**
 * Decide when a tile may play: it must be in or near the scroller's viewport
 * (or under the pointer), and not held by an open Lightbox. `onActive` is
 * called with true when the tile may play and false when it must stop. Every
 * tile of the picker shares one observer (sharedIntersection).
 */
export function gateTile(
    node: Element,
    onActive: (on: boolean) => void,
): TileGate {
    const hasObserver = typeof IntersectionObserver === "function";
    // Without an observer there is no way to tell, so every tile is near.
    let near = !hasObserver;
    // The tile under the pointer plays at once, ahead of the observer's
    // first report for it.
    let hovered = false;
    let held = videoDecodersHeld();
    let granted = false;

    function set(on: boolean) {
        if (on === granted) return;
        granted = on;
        onActive(on);
    }

    function sync() {
        set((near || hovered) && !held);
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
    // The tile's own box (the video and overlay are pointer-events-none).
    const host = node.parentElement;
    const enter = () => {
        hovered = true;
        sync();
    };
    const leave = () => {
        hovered = false;
        sync();
    };
    host?.addEventListener("pointerenter", enter);
    host?.addEventListener("pointerleave", leave);
    if (!hasObserver) sync();

    return {
        refresh() {
            if (!granted) return;
            set(false);
            sync();
        },
        destroy() {
            unobserve?.();
            stopHolding();
            host?.removeEventListener("pointerenter", enter);
            host?.removeEventListener("pointerleave", leave);
            set(false);
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
 * while it is in or near the scroller's viewport, or hovered.
 *
 * Every page of "load more" stays mounted, so starting every result at once
 * would keep hundreds of decoders alive for tiles nobody can see. Only the
 * tiles in or near view hold one. The `poster`, when there is one,
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
