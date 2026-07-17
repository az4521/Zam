import type { Track } from "livekit-client";

/**
 * Svelte action: attach a LiveKit video track to a <video> element for the
 * element's lifetime, re-attaching if the track prop changes and detaching on
 * destroy. Video elements live in the component tree (unlike call audio, which
 * is body-appended), so attach/detach is owned here rather than in client.ts.
 */
export function videoTrack(node: HTMLVideoElement, track: Track) {
    let current = track;
    current.attach(node);
    return {
        update(next: Track) {
            if (next === current) return;
            current.detach(node);
            current = next;
            current.attach(node);
        },
        destroy() {
            current.detach(node);
        },
    };
}
