import type { Track } from "livekit-client";
import type { PipPlacement } from "$lib/utils/videoTiles";
import { t } from "$lib/i18n";

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

// On the desktop app the system window is our own small always-on-top window
// (electron/main.cjs lets this one popup through). Chromium's own video
// window prints the page's origin on it, which for the app is the loopback
// address and port it is served from.
const DESKTOP_PIP_FRAME = "zam-call-pip";
let desktopWin: Window | null = null;
let desktopControls: {
    mic: HTMLButtonElement;
    camera: HTMLButtonElement;
    label: HTMLSpanElement;
} | null = null;
let pipLabel = "";
let pipActions: PipCallActions | null = null;
let pipMicOn = false;
let pipCameraOn = false;

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
    const win = desktopWin;
    desktopWin = null;
    desktopControls = null;
    if (win && !win.closed) win.close();
}

const ICON_MIC =
    '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>';
const ICON_CAMERA =
    '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>';
const ICON_HANG_UP =
    '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/>';
const ICON_BACK =
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';
const ICON_CLOSE = '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>';
const ICON_STRIKE = '<line x1="2" x2="22" y1="2" y2="22"/>';

// Chromium's picture-in-picture look: controls fade in on hover over a
// shade at the top and bottom; everything but a button drags the window.
// A drag region gets no mouse events, so the desktop app marks hovering
// itself (the "hover" class, electron/main.cjs).
const PIP_CSS = `
html,body{margin:0;height:100%;background:#000;overflow:hidden;font:13px system-ui,sans-serif;color:#fff;-webkit-app-region:drag;user-select:none}
video{width:100%;height:100%;object-fit:contain;display:block}
.top,.bottom{position:fixed;left:0;right:0;display:flex;align-items:center;opacity:0;transition:opacity .15s}
html.hover .top,html.hover .bottom{opacity:1}
.top{top:0;height:40px;padding:0 4px 0 10px;gap:8px;background:linear-gradient(rgba(0,0,0,.65),transparent)}
.top img{width:16px;height:16px}
.label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bottom{bottom:0;height:64px;justify-content:center;gap:12px;background:linear-gradient(transparent,rgba(0,0,0,.65))}
button{-webkit-app-region:no-drag;border:0;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
button[hidden]{display:none}
.icon{width:32px;height:32px;border-radius:50%;background:transparent}
.icon:hover{background:rgba(255,255,255,.2)}
.round{width:36px;height:36px;border-radius:50%;background:rgba(60,60,60,.9)}
.round:hover{background:rgba(90,90,90,.95)}
.round.danger{background:#d93025}
.round.danger:hover{background:#e8453c}
`;

function svgIcon(paths: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function pipButton(
    doc: Document,
    className: string,
    onClick: () => void,
): HTMLButtonElement {
    const b = doc.createElement("button");
    b.className = className;
    b.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return b;
}

function paintDesktopControls(): void {
    if (!desktopControls) return;
    const { mic, camera } = desktopControls;
    mic.innerHTML = svgIcon(ICON_MIC + (pipMicOn ? "" : ICON_STRIKE));
    mic.title = pipMicOn ? t("common.mute") : t("callView.unmute");
    mic.classList.toggle("danger", !pipMicOn);
    camera.innerHTML = svgIcon(ICON_CAMERA + (pipCameraOn ? "" : ICON_STRIKE));
    camera.title = pipCameraOn
        ? t("common.turnOffCamera")
        : t("common.turnOnCamera");
    camera.hidden = !pipActions?.toggleCamera;
    desktopControls.label.textContent = pipLabel;
}

/** The desktop app's own floating window, or null where the app refuses
 *  the popup (a desktop build older than this page). Frameless, laid out like
 *  Chromium's picture-in-picture window: hovering shows the stream's name with
 *  back-to-call and close along the top, the call buttons along the bottom,
 *  and the window drags from anywhere else. */
function openDesktopWindow(): HTMLVideoElement | null {
    if (typeof window === "undefined" || !window.desktop) return null;
    const win = window.open("about:blank", DESKTOP_PIP_FRAME, "popup");
    if (!win) return null;
    const doc = win.document;
    doc.title = "Zam";
    const style = doc.createElement("style");
    style.textContent = PIP_CSS;
    doc.head.append(style);
    const el = doc.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;

    const top = doc.createElement("div");
    top.className = "top";
    const icon = doc.createElement("img");
    icon.src = new URL("/favicon.png", location.origin).href;
    icon.alt = "";
    const label = doc.createElement("span");
    label.className = "label";
    label.textContent = pipLabel;
    const back = pipButton(doc, "icon", () => {
        pipActions?.openCall?.();
        window.desktop?.showWindow?.();
        window.focus();
    });
    back.innerHTML = svgIcon(ICON_BACK);
    back.title = t("voiceCallPanel.openCallView");
    const close = pipButton(doc, "icon", () => releaseVideo());
    close.innerHTML = svgIcon(ICON_CLOSE);
    close.title = t("common.close");
    top.append(icon, label, back, close);

    const bar = doc.createElement("div");
    bar.className = "bottom";
    const mic = pipButton(doc, "round", () => pipActions?.toggleMic());
    const camera = pipButton(doc, "round", () => pipActions?.toggleCamera?.());
    const hangUp = pipButton(doc, "round danger", () => pipActions?.hangUp());
    hangUp.innerHTML = svgIcon(ICON_HANG_UP);
    hangUp.title = t("callView.disconnect");
    bar.append(mic, camera, hangUp);

    doc.body.append(el, top, bar);
    desktopWin = win;
    desktopControls = { mic, camera, label };
    paintDesktopControls();
    // Closed by the user or by the app.
    win.addEventListener("pagehide", () => {
        if (desktopWin === win) releaseVideo();
    });
    return el;
}

// A reload of the app must not leave the floating window behind.
if (typeof window !== "undefined")
    window.addEventListener("pagehide", () => {
        if (desktopWin) releaseVideo();
    });

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
/** The name the desktop window shows for its stream ("Alice's screen"). */
export function setPipLabel(label: string): void {
    pipLabel = label;
    paintDesktopControls();
}

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
    const desktopVideo = openDesktopWindow();
    if (desktopVideo) {
        video = desktopVideo;
        callPipState.windowOpen = true;
        showPipTrack(track);
        return;
    }
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
    if (desktopWin) {
        releaseVideo();
    } else if (video && document.pictureInPictureElement === video) {
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
    /** Go back to the call view, from the desktop window's top bar. */
    openCall?: () => void;
}

// Not in TypeScript's MediaSessionAction yet.
const SESSION_ACTIONS = ["togglemicrophone", "togglecamera", "hangup"];

/** Mute, camera and hang-up buttons in the system window. Returns the cleanup. */
export function bindPipCallActions(actions: PipCallActions): () => void {
    pipActions = actions;
    paintDesktopControls();
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
    return () => {
        if (pipActions === actions) pipActions = null;
        handlers.forEach((_, i) => set(i, null));
    };
}

/** Keep those buttons' on/off state honest. */
export function reportPipCallState(micOn: boolean, cameraOn: boolean): void {
    pipMicOn = micOn;
    pipCameraOn = cameraOn;
    paintDesktopControls();
    void navigator.mediaSession?.setMicrophoneActive?.(micOn);
    void navigator.mediaSession?.setCameraActive?.(cameraOn);
}
