import { gifTileVideo } from "./gifTileVideo";

/** Longest side of the captured still. The strip tiles are 80px, so this is
 *  plenty and keeps the data URL small. */
const POSTER_SIZE = 160;

/**
 * Svelte action: a composer attachment's video preview. It holds a decoder
 * only while the tile is in the strip's visible area (gifTileVideo), so a
 * queue of many videos can't exhaust the hardware decoder pool. The first
 * frame is captured once as a still `poster`, which stays up while the tile
 * is unloaded, so every tile shows a picture rather than a blank box.
 */
export function composerVideoPreview(node: HTMLVideoElement, url: string) {
    let current = url;
    let captured = false;
    const tile = gifTileVideo(node, url);

    function capture() {
        if (captured) return;
        const { videoWidth: w, videoHeight: h } = node;
        if (!w || !h) return;
        const scale = Math.min(1, POSTER_SIZE / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        try {
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(node, 0, 0, canvas.width, canvas.height);
            node.poster = canvas.toDataURL("image/jpeg", 0.7);
            captured = true;
        } catch {
            // A frame that can't be read back just leaves the tile without a
            // poster; the video itself still plays when in view.
        }
    }

    node.addEventListener("loadeddata", capture);

    return {
        update(next: string) {
            if (next !== current) {
                current = next;
                // The still belongs to the old file.
                node.removeAttribute("poster");
                captured = false;
            }
            tile.update(next);
        },
        destroy() {
            node.removeEventListener("loadeddata", capture);
            tile.destroy?.();
        },
    };
}
