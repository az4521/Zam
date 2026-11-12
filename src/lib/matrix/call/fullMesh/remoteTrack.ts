/**
 * A track received over a mesh connection, in the shape the call's audio
 * and video code attaches (transport.ts AttachableTrack, which LiveKit's
 * tracks also have).
 */
import type { AttachableTrack } from "../transport";

export class MeshRemoteTrack implements AttachableTrack {
    private readonly elements = new Set<HTMLMediaElement>();
    /** Set when the browser refused to start playback (autoplay policy). */
    playbackBlocked = false;

    constructor(
        readonly mediaStreamTrack: MediaStreamTrack,
        private readonly onBlockedChange: () => void,
    ) {}

    attach(element: HTMLMediaElement): HTMLMediaElement {
        this.elements.add(element);
        element.autoplay = true;
        if (element instanceof HTMLVideoElement) {
            element.playsInline = true;
            // The sound comes through its own audio track.
            element.muted = true;
        }
        element.srcObject = new MediaStream([this.mediaStreamTrack]);
        this.play(element);
        return element;
    }

    detach(element: HTMLMediaElement): HTMLMediaElement {
        this.elements.delete(element);
        const src = element.srcObject;
        if (
            src instanceof MediaStream &&
            src.getTracks().includes(this.mediaStreamTrack)
        )
            element.srcObject = null;
        return element;
    }

    /** Try playing every element again (from a user gesture). */
    async resume(): Promise<void> {
        await Promise.all(
            [...this.elements].map((el) => el.play().catch(() => {})),
        );
        this.setBlocked(
            [...this.elements].some(
                (el) => el instanceof HTMLAudioElement && el.paused,
            ),
        );
    }

    detachAll(): void {
        for (const el of [...this.elements]) this.detach(el);
    }

    private play(element: HTMLMediaElement): void {
        void element.play().then(
            () => {
                if (element instanceof HTMLAudioElement) this.setBlocked(false);
            },
            (err: unknown) => {
                if (
                    element instanceof HTMLAudioElement &&
                    err instanceof DOMException &&
                    err.name === "NotAllowedError"
                )
                    this.setBlocked(true);
            },
        );
    }

    private setBlocked(blocked: boolean): void {
        if (this.playbackBlocked === blocked) return;
        this.playbackBlocked = blocked;
        this.onBlockedChange();
    }
}
