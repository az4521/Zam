import type { Track } from "livekit-client";
import { runWithMediaTitle } from "$lib/utils/mediaTitle";

/**
 * Svelte action: attach a LiveKit video track to a <video> element for the
 * element's lifetime, re-attaching if the track prop changes and detaching on
 * destroy. Video elements live in the component tree (unlike call audio, which
 * is body-appended), so attach/detach is owned here rather than in client.ts.
 * A `data-media-title` on the element names its player in DevTools' Media
 * panel (utils/mediaTitle).
 */
export function videoTrack(node: HTMLVideoElement, track: Track) {
    let current = track;
    let alive = true;
    const attach = (t: Track) => {
        const title = node.dataset.mediaTitle;
        // Attaching can wait its turn behind other players being named, so
        // it checks the track is still wanted when it gets there.
        if (title)
            void runWithMediaTitle(node, title, () => {
                if (t === current && alive) t.attach(node);
            });
        else t.attach(node);
    };
    attach(current);
    return {
        update(next: Track) {
            if (next === current) return;
            current.detach(node);
            current = next;
            attach(current);
        },
        destroy() {
            alive = false;
            current.detach(node);
        },
    };
}
