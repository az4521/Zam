import { mount, unmount } from "svelte";
import { Capacitor } from "@capacitor/core";
import { t } from "$lib/i18n";
import { getRoom, getRoomDisplayName } from "$lib/matrix/client";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";
import { adoptAppStyles } from "$lib/stores/callPip.svelte";

// The whole call view (tiles and controls) in its own window. The call keeps
// running in the main client: the pop-out mounts the same Svelte components
// into the other window's document, so it is the same JS realm and mirrors
// and drives the one call. Closes with the call. See ARCHITECTURE.md.

/** window.open name of the call pop-out; electron/main.cjs lets this one popup through. */
const CALL_POPOUT_FRAME = "zam-call-popout";
const POPOUT_SIZE = { width: 960, height: 600 };

/** Extra rules for the pop-out's document, after the app's own style sheets. */
const POPOUT_CSS = `html,body{margin:0;height:100%;overflow:hidden}`;

class CallPopoutState {
    /** The call view is open in a pop-out window. */
    open = $state(false);
    /** The room whose call is in the pop-out. */
    roomId = $state<string | null>(null);
}

export const callPopoutState = new CallPopoutState();

interface PopoutHost {
    win: Window;
    /** Svelte's handle on the mounted view. */
    app: Record<string, unknown> | null;
    /** Listeners, observers and other teardown this window owns. */
    cleanup: Array<() => void>;
}
let host: PopoutHost | null = null;

/** Document Picture-in-Picture (Chromium): a always-on-top window of its own. */
interface DocumentPipApi {
    requestWindow(options?: {
        width?: number;
        height?: number;
    }): Promise<Window>;
}

function documentPipApi(): DocumentPipApi | undefined {
    if (typeof window === "undefined") return undefined;
    const api = (
        window as Window & { documentPictureInPicture?: DocumentPipApi }
    ).documentPictureInPicture;
    return api && typeof api.requestWindow === "function" ? api : undefined;
}

function isDesktopApp(): boolean {
    return typeof window !== "undefined" && !!window.desktop;
}

/** Whether a call can be popped out. Android's WebView has no windows of its
 *  own. Elsewhere the desktop app, Document Picture-in-Picture or a plain
 *  popup window will do. Fixed for the session. */
export function callPopoutSupported(): boolean {
    if (typeof window === "undefined") return false;
    if (Capacitor.isNativePlatform()) return false;
    return true;
}

/** Keep `dst`'s attributes equal to `src`'s, for as long as it lives. Used to
 *  mirror the theme and font attributes of the root element. */
function mirrorAttributes(src: Element, dst: Element): () => void {
    const sync = () => {
        for (const attr of Array.from(dst.attributes)) {
            if (!src.hasAttribute(attr.name)) dst.removeAttribute(attr.name);
        }
        for (const attr of Array.from(src.attributes)) {
            if (dst.getAttribute(attr.name) !== attr.value)
                dst.setAttribute(attr.name, attr.value);
        }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(src, { attributes: true });
    return () => observer.disconnect();
}

function releaseHost(): void {
    callPopoutState.open = false;
    callPopoutState.roomId = null;
    const h = host;
    host = null;
    if (!h) return;
    for (const stop of h.cleanup) stop();
    if (h.app) void unmount(h.app);
    if (!h.win.closed) h.win.close();
}

/** Take over the popup: style it, mirror the root attributes, forward keys
 *  and mount the call view into it. */
async function openHost(win: Window, roomId: string): Promise<void> {
    const doc = win.document;
    const room = getRoom(roomId);
    doc.title = t("callPopout.windowTitle", {
        room: room ? getRoomDisplayName(room) : roomId,
    });
    adoptAppStyles(doc, POPOUT_CSS);

    const h: PopoutHost = { win, app: null, cleanup: [] };
    host = h;
    callPopoutState.open = true;
    callPopoutState.roomId = roomId;

    // Closed by the user or by the app.
    const gone = () => {
        if (host === h) releaseHost();
    };
    win.addEventListener("pagehide", gone);
    h.cleanup.push(() => win.removeEventListener("pagehide", gone));

    // Theme, font and language follow the main document.
    h.cleanup.push(
        mirrorAttributes(document.documentElement, doc.documentElement),
    );
    h.cleanup.push(mirrorAttributes(document.body, doc.body));

    // The popup has focus while the user is in it, so its keys must reach the
    // app's global keybinds (mute, deafen, push-to-talk) in the main window.
    // Escape stays with the popup.
    for (const type of ["keydown", "keyup"] as const) {
        const forward = (e: KeyboardEvent) => {
            if (e.key === "Escape") return;
            window.dispatchEvent(new KeyboardEvent(e.type, e));
        };
        win.addEventListener(type, forward);
        h.cleanup.push(() => win.removeEventListener(type, forward));
    }

    // Loaded on first use, so the store does not pull in the call UI.
    const { default: CallPopoutView } =
        await import("$lib/components/layout/CallPopoutView.svelte");
    if (host !== h) return;
    h.app = mount(CallPopoutView, { target: doc.body });
}

/** Get the popup window. Must run in a click: each source is requested before
 *  the first await. Null when no window results. */
function requestPopoutWindow(): Window | Promise<Window> | null {
    if (isDesktopApp()) {
        return window.open(
            "about:blank",
            CALL_POPOUT_FRAME,
            `popup,width=${POPOUT_SIZE.width},height=${POPOUT_SIZE.height}`,
        );
    }
    const pip = documentPipApi();
    if (pip) return pip.requestWindow({ ...POPOUT_SIZE });
    return window.open(
        "about:blank",
        CALL_POPOUT_FRAME,
        `popup,width=${POPOUT_SIZE.width},height=${POPOUT_SIZE.height}`,
    );
}

/** Open a call's view in its own window. Must run in a click: the window is
 *  requested before the first await. A pop-out already open is replaced. */
export async function openCallPopout(roomId: string): Promise<void> {
    if (!callPopoutSupported()) return;
    if (host) releaseHost();
    let requested: Window | Promise<Window> | null = null;
    try {
        requested = requestPopoutWindow();
    } catch {
        requested = null;
    }
    let win: Window | null = null;
    try {
        win = requested instanceof Promise ? await requested : requested;
    } catch {
        win = null;
    }
    if (!win) {
        showErrorToast(t("callPopout.blocked"));
        return;
    }
    await openHost(win, roomId);
}

/** Bring the pop-out window forward. */
export function focusCallPopout(): void {
    host?.win.focus();
}

/** Close the pop-out window and let the main window show the call again. */
export function closeCallPopout(): void {
    if (host) releaseHost();
}

/** Close the pop-out when the call it shows ends or moves to another room.
 *  Call once from the app shell; returns the cleanup. */
export function watchCallPopout(): () => void {
    return $effect.root(() => {
        $effect(() => {
            if (!callPopoutState.open) return;
            if (voiceCallState.roomId !== callPopoutState.roomId)
                closeCallPopout();
        });
    });
}

// Closing the page closes the pop-out with it.
if (typeof window !== "undefined")
    window.addEventListener("pagehide", () => {
        if (host) releaseHost();
    });
