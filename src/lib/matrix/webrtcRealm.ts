// Which window's WebRTC classes calls use.
//
// When Chromium's GPU process exits (rgosling80's NVIDIA box has regular
// shader crashes), every RTCPeerConnection the page creates from then on
// encodes and decodes video in software: the window's WebRTC factory keeps
// the GPU channel that died, so re-initialised encoders, setParameters and
// new peer connections all land on OpenH264. Only a reload or a new window
// gets a working factory. A same-origin iframe is a new window, so after a GPU
// exit the next peer connections come from a fresh hidden iframe (verified on
// NVENC: the main window stayed on OpenH264, the iframe's encoder was
// VA-API). Settings > Debug's WebCodecs probe doesn't go through this factory
// and keeps saying "Hardware" throughout.

type PeerConnectionClass = typeof RTCPeerConnection;
type RealmWindow = Window & typeof globalThis;

let stale = false;
let frame: HTMLIFrameElement | null = null;
const hooks = new Set<(pc: PeerConnectionClass) => void>();

/** The GPU process exited: peer connections made from now on need a new
 *  window to get hardware video. */
export function markWebrtcRealmStale(): void {
    stale = true;
}

/** Whether a GPU exit happened since the WebRTC classes were last replaced. */
export function webrtcRealmStale(): boolean {
    return stale;
}

/** The window whose WebRTC classes (RTCRtpSender capabilities,
 *  mediaCapabilities) describe what calls can use right now. */
export function webrtcWindow(): RealmWindow {
    return (frame?.contentWindow as RealmWindow | null) ?? window;
}

/** Run `hook` on the RTCPeerConnection class in use now and on every one
 *  that replaces it, for patches to its prototype. */
export function onWebrtcRealm(hook: (pc: PeerConnectionClass) => void): void {
    hooks.add(hook);
    if (typeof RTCPeerConnection !== "undefined") hook(RTCPeerConnection);
}

/** After a GPU exit, point the global RTCPeerConnection (what LiveKit
 *  constructs) at a fresh iframe's. Returns whether it did. */
export function ensureFreshWebrtcRealm(): boolean {
    if (!stale || typeof document === "undefined") return false;
    const next = document.createElement("iframe");
    next.hidden = true;
    next.setAttribute("aria-hidden", "true");
    next.tabIndex = -1;
    document.body.appendChild(next);
    const win = next.contentWindow as RealmWindow | null;
    if (!win?.RTCPeerConnection) {
        next.remove();
        return false;
    }
    const previous = frame;
    frame = next;
    stale = false;
    (window as RealmWindow).RTCPeerConnection = win.RTCPeerConnection;
    for (const hook of hooks) hook(win.RTCPeerConnection);
    // Removing a frame closes the peer connections it made; the call is
    // replacing them now, so give that time to finish first.
    if (previous) setTimeout(() => previous.remove(), 60_000);
    return true;
}

/** How long after a recovery another GPU exit counts as the recovery
 *  failing, so the call stops reconnecting and offers a reload instead. */
export const GPU_RECOVERY_WINDOW_MS = 5000;

/** What to do about a GPU exit during a call, given the last recovery in
 *  it (null if none; `doneAt` null while its reconnect is still running). */
export function gpuExitAction(
    last: { doneAt: number | null } | null,
    now: number,
): "recover" | "give-up" {
    if (!last) return "recover";
    if (last.doneAt === null) return "give-up";
    return now - last.doneAt < GPU_RECOVERY_WINDOW_MS ? "give-up" : "recover";
}
