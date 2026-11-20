/**
 * Svelte action: free a `<video>`'s player when its owner unmounts it.
 *
 * Removing an element from the DOM does not reliably release the hardware
 * decoder it holds; it lives until the element is garbage-collected, so a
 * gallery stepping through videos or a dialog closing can leave decoders
 * behind. Dropping `src` and calling `load()` is the spec'd release, the same
 * one gifTileVideo and unloadOffscreen use on their way out.
 */
export function releaseDecoder(node: HTMLVideoElement) {
    return {
        destroy() {
            node.pause();
            node.removeAttribute("src");
            node.load();
        },
    };
}
