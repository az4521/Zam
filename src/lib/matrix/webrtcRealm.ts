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
    adoptMessageData(win);
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

/** Make `MessageEvent.data` from `win` (data-channel messages of peer
 *  connections built from its classes) come back as this window's objects.
 *  livekit-client's decodeDataMessage and the mesh transport test
 *  `data instanceof ArrayBuffer` / `Blob`, which fails for the frame's own
 *  ArrayBuffer, so every incoming data message (soundboard, chat, ...) was
 *  dropped as "unsupported data type" after a GPU exit. */
export function adoptMessageData(win: RealmWindow): void {
    if (win === (window as RealmWindow)) return;
    const proto = win.MessageEvent?.prototype;
    const desc = proto && Object.getOwnPropertyDescriptor(proto, "data");
    const getData = desc?.get;
    if (!getData) return;
    // Keep repeated reads of one event's data identical.
    const copies = new WeakMap<object, unknown>();
    Object.defineProperty(proto, "data", {
        configurable: true,
        enumerable: desc.enumerable,
        get(this: MessageEvent) {
            const data: unknown = getData.call(this);
            if (data === null || typeof data !== "object") return data;
            if (data instanceof ArrayBuffer || data instanceof Blob)
                return data;
            let copy = copies.get(this);
            if (copy !== undefined) return copy;
            if (win.ArrayBuffer && data instanceof win.ArrayBuffer) {
                copy = new Uint8Array(data).slice().buffer;
            } else if (win.Blob && data instanceof win.Blob) {
                copy = new Blob([data as Blob], { type: (data as Blob).type });
            } else {
                return data;
            }
            copies.set(this, copy);
            return copy;
        },
    });
}
