// A local video or audio file the sharer plays and publishes as their screen
// share (livekitCall startFileShare). This store owns the playback element and
// its controls; the publish and its ownership checks live in livekitCall.

/** The sharer's own monitor level at the start. Not sent to the call. */
export const FILE_SHARE_DEFAULT_MONITOR_VOLUME = 0.5;

class FileShareState {
    /** A file share's element is loaded (it may still be publishing). */
    active = $state(false);
    fileName = $state("");
    playing = $state(false);
    currentTime = $state(0);
    /** Seconds, or 0 until the metadata is known. */
    duration = $state(0);
    /** The sharer's own listening level (0..1). Changing it never changes the
     *  captured sound: the spec says element volume and mute do not affect
     *  captureStream audio. */
    monitorVolume = $state(FILE_SHARE_DEFAULT_MONITOR_VOLUME);
}

export const fileShareState = new FileShareState();

let element: HTMLVideoElement | null = null;
let objectUrl: string | null = null;
let listeners: [string, EventListener][] = [];
/** Settles the pending waitForFileShareReady, if any. */
let settleReady: ((ready: boolean) => void) | null = null;

function syncFromElement(el: HTMLVideoElement): void {
    if (element !== el) return;
    fileShareState.playing = !el.paused && !el.ended;
    fileShareState.currentTime = Number.isFinite(el.currentTime)
        ? el.currentTime
        : 0;
    fileShareState.duration = Number.isFinite(el.duration) ? el.duration : 0;
}

/** Load the file into a new, detached video element and start following it.
 *  `onError` runs when the file fails to decode or play. */
export function openFileShareElement(
    file: File,
    onError: () => void,
): HTMLVideoElement {
    releaseFileShareElement();
    const el = document.createElement("video");
    el.playsInline = true;
    el.preload = "auto";
    // Not muted: the captured sound follows the file, the monitor level is
    // only what the sharer hears.
    el.muted = false;
    el.volume = fileShareState.monitorVolume;
    objectUrl = URL.createObjectURL(file);
    el.src = objectUrl;
    element = el;
    const sync = () => syncFromElement(el);
    const onErr = () => {
        if (element === el) onError();
    };
    listeners = [
        ["loadedmetadata", sync],
        ["durationchange", sync],
        ["timeupdate", sync],
        ["play", sync],
        ["pause", sync],
        ["ended", sync],
        ["seeked", sync],
        ["error", onErr],
    ];
    for (const [type, fn] of listeners) el.addEventListener(type, fn);
    fileShareState.active = true;
    fileShareState.fileName = file.name;
    fileShareState.playing = false;
    fileShareState.currentTime = 0;
    fileShareState.duration = 0;
    return el;
}

/** Resolves true once the element knows its frame size and length, false on
 *  an error or when the element is released first. */
export function waitForFileShareReady(el: HTMLVideoElement): Promise<boolean> {
    return new Promise((resolve) => {
        if (element !== el) {
            resolve(false);
            return;
        }
        if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
            resolve(true);
            return;
        }
        settleReady = resolve;
        const ok = () => settle(true);
        const bad = () => settle(false);
        const settle = (ready: boolean) => {
            el.removeEventListener("loadedmetadata", ok);
            el.removeEventListener("error", bad);
            if (settleReady === resolve) settleReady = null;
            resolve(ready);
        };
        el.addEventListener("loadedmetadata", ok);
        el.addEventListener("error", bad);
    });
}

/** The element's captured stream, or null when the element can't be captured
 *  (not loaded, or an engine without captureStream). */
export function captureFileShareStream(
    el: HTMLVideoElement,
): MediaStream | null {
    const capture = (
        el as HTMLVideoElement & { captureStream?: () => MediaStream }
    ).captureStream;
    if (typeof capture !== "function") return null;
    try {
        return capture.call(el);
    } catch {
        return null;
    }
}

/** Start or resume playback. A refused play (no user gesture) leaves it paused. */
export function playFileShare(): void {
    const el = element;
    if (!el) return;
    void el.play().catch(() => syncFromElement(el));
}

export function pauseFileShare(): void {
    element?.pause();
}

export function toggleFileSharePlay(): void {
    if (!element) return;
    if (element.paused) playFileShare();
    else pauseFileShare();
}

/** Seek to a time in seconds. Works while playing or paused. */
export function seekFileShare(seconds: number): void {
    const el = element;
    if (!el || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(el.duration) ? el.duration : seconds;
    const target = Math.min(Math.max(0, seconds), max);
    el.currentTime = target;
    fileShareState.currentTime = target;
}

/** The sharer's own monitor level, 0..1. */
export function setFileShareMonitorVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
    fileShareState.monitorVolume = v;
    if (element) element.volume = v;
}

/** Let the sharer pick a file to share. `onPick` runs on a choice; a cancel
 *  does nothing. The input is created and removed here. */
export function pickShareFile(onPick: (file: File) => void): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,audio/*";
    input.style.display = "none";
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        input.remove();
        if (file) onPick(file);
    });
    // A cancelled dialog fires `cancel` where supported; the input is removed
    // either way so none is left behind.
    input.addEventListener("cancel", () => input.remove());
    document.body.appendChild(input);
    input.click();
}

/** Stop following the element: pause it, drop its listeners, revoke its
 *  object URL and reset the state. Safe to call when nothing is loaded. */
export function releaseFileShareElement(): void {
    const el = element;
    element = null;
    settleReady?.(false);
    settleReady = null;
    if (el) {
        for (const [type, fn] of listeners) el.removeEventListener(type, fn);
        el.pause();
        el.removeAttribute("src");
        el.load();
    }
    listeners = [];
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    fileShareState.active = false;
    fileShareState.fileName = "";
    fileShareState.playing = false;
    fileShareState.currentTime = 0;
    fileShareState.duration = 0;
}

/** This engine can publish a playing file (iOS Safari has no captureStream
 *  on media elements). */
export const fileShareSupported =
    typeof HTMLMediaElement !== "undefined" &&
    "captureStream" in HTMLMediaElement.prototype;
