import { mount, unmount } from "svelte";
import type { Track } from "livekit-client";
import type { PipPlacement } from "$lib/utils/videoTiles";
import { centreOf, dockPlacement, type PipPoint } from "$lib/utils/pipGeometry";

const PLACEMENT_KEY = "call-pip-placement";
const SIDES = ["top", "bottom", "left", "right"];
/** How long a stream gets to produce a frame before asking for the browser's
 *  window. User activation lasts about 5s, so past that the request would
 *  fail anyway. */
const METADATA_TIMEOUT_MS = 3000;

/** Size of the pop-out when the caller gives none: the built-in video at 18rem. */
export const DEFAULT_POP_SIZE = { width: 288, height: 162 };

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
    /** The desktop app's pop-out window is open. */
    windowOpen = $state(false);
    /** The tile the user sent to the pop-out, if they picked one. */
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

// The pop-out is the Electron desktop app's frameless always-on-top window
// (electron/main.cjs lets this one popup through). It renders the same panel
// as the floating video (CallPipPanel), mounted into the window's own
// document. Chromium's own video window prints the page's origin on it, so
// this one is ours. Web and Android have no pop-out at all.
const DESKTOP_PIP_FRAME = "zam-call-pip";
interface PipHost {
    win: Window;
    /** Svelte's handle on the mounted panel. */
    app: Record<string, unknown> | null;
    /** Listeners and timers this window owns. */
    cleanup: Array<() => void>;
}
let host: PipHost | null = null;

type DesktopPipApi = NonNullable<NonNullable<Window["desktop"]>["callPip"]>;
function desktopPipApi(): DesktopPipApi | undefined {
    if (typeof window === "undefined") return undefined;
    return window.desktop?.callPip;
}

// The browser's own picture-in-picture window, on web browsers that have it.
// It plays a <video> of its own, not a call tile's: tiles unmount with the
// call view, which would close the window the moment the user went back to
// the chat, the very time it is wanted.
let video: HTMLVideoElement | null = null;
let attached: Track | null = null;

function nativePipSupported(): boolean {
    return (
        typeof document !== "undefined" &&
        document.pictureInPictureEnabled === true &&
        "requestPictureInPicture" in HTMLVideoElement.prototype
    );
}

/** Whether a call's video can float in a picture-in-picture window: the
 *  desktop app's pop-out, or the browser's own window. Android's WebView and
 *  Firefox have neither. Support is fixed for the session, so callers may
 *  hold the result in a plain const. */
export function pipWindowSupported(): boolean {
    return !!desktopPipApi() || nativePipSupported();
}

/** Whether a video can be dragged out of the page into its own window. Only
 *  the desktop app does that; a browser's window stays clamped to the page. */
export function pipDetachSupported(): boolean {
    return !!desktopPipApi();
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

function releaseVideo(): void {
    if (video && attached) attached.detach(video);
    attached = null;
    video?.remove();
    video = null;
    callPipState.windowOpen = false;
    callPipState.pinnedKey = null;
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

/** Put a track in the browser's picture-in-picture window, which may already
 *  be showing another. Does nothing while that window is closed. */
export function showPipTrack(track: Track): void {
    if (track === attached || !video) return;
    attached?.detach(video);
    attached = track;
    track.attach(video);
}

function rootRem(): number {
    return (
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    );
}

function releaseHost(): void {
    callPipState.windowOpen = false;
    callPipState.pinnedKey = null;
    const h = host;
    host = null;
    if (!h) return;
    for (const stop of h.cleanup) stop();
    if (h.app) void unmount(h.app);
    if (!h.win.closed) h.win.close();
}

// The pop-out window's own style sheet. The panel's Tailwind classes come
// from the app's stylesheets, copied in by adoptStyles; these rules are the
// window-only parts: the Chromium-style chrome that fades in on hover, and
// the drag region of the window (everything but a button drags it).
const PIP_WINDOW_CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:#000;color:#fff;user-select:none}
.pip-root{position:relative;width:100%;height:100%;overflow:hidden;background:#000}
.pip-chrome{transition:opacity .15s;opacity:0}
html.hover .pip-chrome,.pip-root:hover .pip-chrome,.pip-root:focus-within .pip-chrome{opacity:1}
html.pip-desktop,html.pip-desktop body{-webkit-app-region:drag}
html.pip-desktop button{-webkit-app-region:no-drag}
`;

/** Copy the app's style sheets into another window's document, then add
 *  `extraCss` after them. Shared by the call pop-out (callPopout.svelte.ts). */
export function adoptAppStyles(doc: Document, extraCss: string): void {
    for (const node of document.querySelectorAll(
        'style, link[rel="stylesheet"]',
    )) {
        if (node instanceof HTMLLinkElement) {
            const link = doc.createElement("link");
            link.rel = "stylesheet";
            link.href = node.href;
            doc.head.append(link);
        } else {
            doc.head.append(node.cloneNode(true));
        }
    }
    const style = doc.createElement("style");
    style.textContent = extraCss;
    doc.head.append(style);
}

/** Where the pop-out's centre is on screen. */
function popupCentre(h: PipHost): PipPoint | undefined {
    try {
        const c = centreOf({
            x: h.win.screenX,
            y: h.win.screenY,
            width: h.win.outerWidth,
            height: h.win.outerHeight,
        });
        return Number.isFinite(c.x) && Number.isFinite(c.y) ? c : undefined;
    } catch {
        return undefined;
    }
}

/** Put the built-in video back in the Zam window, at `centre` (screen
 *  coordinates) when given, and close the pop-out. Without a centre the
 *  built-in video keeps its last spot. */
export function dockPipWindow(
    centre: PipPoint | undefined,
    size: { width: number; height: number } = DEFAULT_POP_SIZE,
): void {
    if (!host) return;
    if (centre) {
        const { width, height } = size;
        setPipPlacement(
            dockPlacement(
                centre.x - width / 2 - window.screenX,
                centre.y - height / 2 - window.screenY,
                width,
                height,
                window.innerWidth,
                window.innerHeight,
                rootRem(),
            ),
        );
    }
    releaseHost();
}

/** Take over the pop-out window: mount the panel in it and watch for its
 *  closing and for a drop back over the Zam window. */
async function openHost(
    win: Window,
    size: { width: number; height: number },
): Promise<void> {
    const doc = win.document;
    doc.title = "Zam";
    adoptAppStyles(doc, PIP_WINDOW_CSS);
    doc.documentElement.classList.add("pip-desktop");
    const h: PipHost = { win, app: null, cleanup: [] };
    host = h;
    callPipState.windowOpen = true;

    // Closed by the user or by the app.
    const gone = () => {
        if (host === h) releaseHost();
    };
    win.addEventListener("pagehide", gone);
    h.cleanup.push(() => win.removeEventListener("pagehide", gone));

    const off = desktopPipApi()?.onDocked((centre) => {
        if (host === h) dockPipWindow(centre, size);
    });
    if (off) h.cleanup.push(off);

    // Loaded on first use, so the store (and its tests) don't pull in the
    // call's UI and SDK modules.
    const { default: CallPipPanel } =
        await import("$lib/components/layout/CallPipPanel.svelte");
    if (host !== h) return;
    h.app = mount(CallPipPanel, {
        target: doc.body,
        props: {
            mode: "window",
            onReturn: () => dockPipWindow(popupCentre(h), size),
            onClose: () => {
                if (host === h) releaseHost();
            },
        },
    });
}

/** The desktop app's own floating window, or null where the app refuses
 *  the popup (a desktop build older than this page). Must run in a click. */
function openDesktopWindow(size: {
    width: number;
    height: number;
}): Window | null {
    const api = desktopPipApi();
    if (!api) return null;
    api.spawnSize(size);
    return window.open("about:blank", DESKTOP_PIP_FRAME, "popup");
}

/** Open the window on a call's video. Must run in a click: the window is
 *  requested before the first await. A `pinnedKey` keeps it on that tile; null
 *  lets it follow the conversation like the floating video does. In the
 *  desktop app this is the pop-out (`size` sizes it, `track` is unused). In a
 *  browser with picture-in-picture it is the browser's own window, which shows
 *  `track`. Does nothing elsewhere. */
export async function openPipWindow(
    pinnedKey: string | null,
    track: Track | null = null,
    size: { width: number; height: number } = DEFAULT_POP_SIZE,
): Promise<void> {
    callPipState.pinnedKey = pinnedKey;
    if (callPipState.windowOpen) return;
    if (desktopPipApi()) {
        const win = openDesktopWindow(size);
        if (!win) {
            callPipState.pinnedKey = null;
            return;
        }
        await openHost(win, size);
        return;
    }
    if (!track || !nativePipSupported()) {
        callPipState.pinnedKey = null;
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

/** A drag of the built-in video has left the Zam window. Opens the pop-out at
 *  the same size, and it then follows the cursor (`grab` is where the pointer
 *  held the video) until `endPipFollow`. Returns false outside the desktop
 *  app. */
export function detachPipWindow(
    pinnedKey: string | null,
    size: { width: number; height: number },
    grab: PipPoint,
): boolean {
    const api = desktopPipApi();
    if (!api) return false;
    api.follow(grab);
    void openPipWindow(pinnedKey, null, size);
    return true;
}

/** The pointer let go while the pop-out followed it. */
export function endPipFollow(): void {
    desktopPipApi()?.follow(null);
}

export function closePipWindow(): void {
    if (host) releaseHost();
    else if (video && document.pictureInPictureElement === video)
        void document.exitPictureInPicture().catch(() => {});
    else if (video) releaseVideo();
}

export interface PipCallActions {
    toggleMic: () => void;
    /** Null leaves the camera button out (camera disabled in settings). */
    toggleCamera: (() => void) | null;
    hangUp: () => void;
}

// Not in TypeScript's MediaSessionAction yet.
const SESSION_ACTIONS = ["togglemicrophone", "togglecamera", "hangup"];

/** Mute, camera and hang-up as the OS media controls. Returns the cleanup.
 *  The pop-out's own buttons call the same store actions directly. */
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
    return () => {
        handlers.forEach((_, i) => set(i, null));
    };
}

/** Keep the OS media controls' on/off state honest. */
export function reportPipCallState(micOn: boolean, cameraOn: boolean): void {
    void navigator.mediaSession?.setMicrophoneActive?.(micOn);
    void navigator.mediaSession?.setCameraActive?.(cameraOn);
}

// Closing the page closes the pop-out with it.
if (typeof window !== "undefined")
    window.addEventListener("pagehide", () => {
        if (host) releaseHost();
        if (video) releaseVideo();
    });
