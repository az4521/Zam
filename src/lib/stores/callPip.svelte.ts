import type { Track } from "livekit-client";
import type { PipPlacement } from "$lib/utils/videoTiles";

const PLACEMENT_KEY = "call-pip-placement";
const SIDES = ["top", "bottom", "left", "right"];
/** How long a stream gets to produce a frame before asking for the window.
 *  User activation lasts about 5s, so past that the request would fail anyway. */
const METADATA_TIMEOUT_MS = 3000;

function loadPlacement(): PipPlacement {
    try {
        const saved = JSON.parse(localStorage.getItem(PLACEMENT_KEY) ?? "null");
        if (
            SIDES.includes(saved?.side) &&
            typeof saved.at === "number" &&
            saved.at >= 0 &&
            saved.at <= 1
        )
            return saved;
    } catch {
        // Storage blocked or garbled: the default spot is fine.
    }
    return { side: "right", at: 0 };
}

class CallPipState {
    /** The system picture-in-picture window is open. */
    windowOpen = $state(false);
    /** The tile the user sent to the system window, if they picked one. */
    pinnedKey = $state<string | null>(null);
    /** The floating video was closed. Holds until the call ends or someone
     *  starts a new share. */
    dismissed = $state(false);
    /** Where the floating video sits. */
    placement = $state<PipPlacement>(loadPlacement());
}

export const callPipState = new CallPipState();

export function setPipPlacement(placement: PipPlacement): void {
    callPipState.placement = placement;
    try {
        localStorage.setItem(PLACEMENT_KEY, JSON.stringify(placement));
    } catch {
        // Storage blocked: the spot lasts for this session.
    }
}

// The system window plays its own <video>, not a call tile's: tiles unmount
// with the call view, which would close the window the moment the user went
// back to the chat, the very time it is wanted.
let video: HTMLVideoElement | null = null;
let attached: Track | null = null;

/** Android's WebView and Firefox have no picture-in-picture API. Support is
 *  fixed for the session, so callers may hold the result in a plain const. */
export function pipWindowSupported(): boolean {
    return (
        typeof document !== "undefined" &&
        document.pictureInPictureEnabled === true &&
        "requestPictureInPicture" in HTMLVideoElement.prototype
    );
}

function releaseVideo(): void {
    attached?.detach(video!);
    attached = null;
    video?.remove();
    video = null;
    callPipState.windowOpen = false;
    callPipState.pinnedKey = null;
}

function ensureVideo(): HTMLVideoElement {
    if (video) return video;
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    // In the document, because Safari won't float a detached video.
    el.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    el.addEventListener("enterpictureinpicture", () => {
        callPipState.windowOpen = true;
    });
    el.addEventListener("leavepictureinpicture", releaseVideo);
    document.body.appendChild(el);
    video = el;
    return el;
}

function metadataReady(el: HTMLVideoElement): Promise<void> {
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA)
        return Promise.resolve();
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, METADATA_TIMEOUT_MS);
        el.addEventListener(
            "loadedmetadata",
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });
}

/** Put a track in the system window, which may already be showing another. */
export function showPipTrack(track: Track): void {
    if (track === attached || !video) return;
    attached?.detach(video);
    attached = track;
    track.attach(video);
}

/** Open the system window on `track`. Must run in a click. A `pinnedKey` keeps
 *  it on that tile; null lets it follow the conversation like the floating
 *  video does. */
export async function openPipWindow(
    pinnedKey: string | null,
    track: Track,
): Promise<void> {
    callPipState.pinnedKey = pinnedKey;
    if (callPipState.windowOpen) return;
    const el = ensureVideo();
    showPipTrack(track);
    try {
        await metadataReady(el);
        await el.requestPictureInPicture();
    } catch {
        releaseVideo();
    }
}

export function closePipWindow(): void {
    if (video && document.pictureInPictureElement === video) {
        void document.exitPictureInPicture().catch(() => {});
    } else if (video) {
        releaseVideo();
    }
}

export interface PipCallActions {
    toggleMic: () => void;
    /** Null leaves the camera button out (camera disabled in settings). */
    toggleCamera: (() => void) | null;
    hangUp: () => void;
}

// Not in TypeScript's MediaSessionAction yet.
const SESSION_ACTIONS = ["togglemicrophone", "togglecamera", "hangup"];

/** Mute, camera and hang-up buttons in the system window. Returns the cleanup. */
export function bindPipCallActions(actions: PipCallActions): () => void {
    const handlers = [actions.toggleMic, actions.toggleCamera, actions.hangUp];
    const set = (i: number, handler: (() => void) | null) => {
        try {
            navigator.mediaSession?.setActionHandler(
                SESSION_ACTIONS[i] as MediaSessionAction,
                handler,
            );
        } catch {
            // Older browsers throw on actions they don't know.
        }
    };
    handlers.forEach((handler, i) => set(i, handler));
    return () => handlers.forEach((_, i) => set(i, null));
}

/** Keep those buttons' on/off state honest. */
export function reportPipCallState(micOn: boolean, cameraOn: boolean): void {
    void navigator.mediaSession?.setMicrophoneActive?.(micOn);
    void navigator.mediaSession?.setCameraActive?.(cameraOn);
}
