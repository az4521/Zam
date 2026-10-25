// Renderer-side bridge to the Electron screen-share source picker. The real
// work happens in the main process (see electron/main.cjs), which arbitrates
// getDisplayMedia() and pushes the enumerated source list here. This module is
// a thin pass-through that guards on the bridge's presence, so importing or
// calling it is safe on web and Android (where `window.desktop` is undefined)
// — every function no-ops there and no picker ever appears.

import type { DisplaySourceRequest } from "$lib/utils/displaySources";

function bridge() {
    return typeof window !== "undefined"
        ? window.desktop?.screenShare
        : undefined;
}

/** Whether the desktop picker offers the share's audio choices (Windows and
 *  Linux, where it can capture single applications). */
export function pickerOffersShareAudio(): boolean {
    const b = bridge();
    const platform =
        typeof window !== "undefined"
            ? (window.desktop?.pluginNative?.platform ?? "")
            : "";
    return (
        !!b?.onAudio &&
        (platform.startsWith("win32") || platform.startsWith("linux"))
    );
}

/** Subscribe to source-list pushes. Returns an unsubscribe function (a no-op
 *  when no bridge is present). */
export function onScreenShareRequest(
    cb: (req: DisplaySourceRequest) => void,
): () => void {
    return bridge()?.onRequest(cb) ?? (() => {});
}

/** Subscribe to main giving up on a pending pick (its timeout fired). */
export function onScreenShareCancel(
    cb: (requestId: number) => void,
): () => void {
    return bridge()?.onCancel(cb) ?? (() => {});
}

/** How a picked share's audio was set up (electron/appAudio.cjs): a PCM
 *  port (Windows), a virtual microphone to open (Linux), nothing, or a
 *  capture that failed to start. */
export interface ShareAudioResult {
    id: number;
    kind: "pcm" | "device" | "none" | "failed";
    port?: MessagePort;
    label?: string;
}

const PORT_TAG = "zam:share-audio-port:";
/** How long a share waits for its audio after the picker answered. */
const SHARE_AUDIO_TIMEOUT_MS = 8000;

// Results arrive in two parts, the bridge callback and (for PCM) a port
// posted to the window, in either order relative to takeShareAudio().
const parts = new Map<
    number,
    { info?: ShareAudioResult; port?: MessagePort }
>();
const ready = new Map<number, ShareAudioResult>();
const waiters = new Map<number, (r: ShareAudioResult | null) => void>();
let awaitingId: number | null = null;
let listening = false;

function deliver(result: ShareAudioResult) {
    const waiter = waiters.get(result.id);
    if (waiter) {
        waiters.delete(result.id);
        waiter(result);
    } else if (result.id === awaitingId) {
        ready.set(result.id, result);
    } else {
        releaseShareAudio(result); // nobody wants it any more
    }
}

function assemble(id: number) {
    const p = parts.get(id);
    if (!p?.info) return;
    if (p.info.kind === "pcm" && !p.port) return;
    parts.delete(id);
    deliver({ ...p.info, port: p.port });
}

function listen() {
    const b = bridge();
    if (listening || !b?.onAudio) return;
    listening = true;
    b.onAudio((info) => {
        if (!Number.isFinite(info?.id)) return;
        const kind =
            info.kind === "pcm" ||
            info.kind === "device" ||
            info.kind === "failed"
                ? info.kind
                : "none";
        const p = parts.get(info.id) ?? {};
        p.info = { id: info.id, kind, label: info.label };
        parts.set(info.id, p);
        assemble(info.id);
    });
    window.addEventListener("message", (e: MessageEvent) => {
        if (e.source !== window || typeof e.data !== "string") return;
        if (!e.data.startsWith(PORT_TAG) || !e.ports[0]) return;
        const id = Number(e.data.slice(PORT_TAG.length));
        if (!Number.isFinite(id)) return;
        const p = parts.get(id) ?? {};
        p.port = e.ports[0];
        parts.set(id, p);
        assemble(id);
    });
}

/** Answer a pending request. `sourceId === null` means the user cancelled.
 *  `audio` is the picker's audio choice (see shareAudioOptions). */
export function respondToScreenShare(
    requestId: number,
    sourceId: string | null,
    sourceName?: string,
    audio?: string,
): void {
    const b = bridge();
    if (!b) return;
    if (sourceId && audio && audio !== "none") {
        listen();
        // Only the latest share's audio is wanted.
        if (awaitingId !== null) cancelShareAudioWait();
        awaitingId = requestId;
    }
    b.respond(requestId, sourceId, sourceName, audio);
}

/** The audio for the share just picked, once main has set it up; null when
 *  the share has none (no audio picked, capture failed, not desktop). */
export function takeShareAudio(
    timeoutMs = SHARE_AUDIO_TIMEOUT_MS,
): Promise<ShareAudioResult | null> {
    const id = awaitingId;
    if (id === null) return Promise.resolve(null);
    const done = ready.get(id);
    if (done) {
        ready.delete(id);
        awaitingId = null;
        return Promise.resolve(done);
    }
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            waiters.delete(id);
            if (awaitingId === id) awaitingId = null;
            // A capture that turns up later is released by deliver().
            resolve(null);
        }, timeoutMs);
        waiters.set(id, (r) => {
            clearTimeout(timer);
            if (awaitingId === id) awaitingId = null;
            resolve(r);
        });
    });
}

/** Give up on the awaited share's audio (the share itself failed), and stop
 *  a capture that is already running for it. */
export function cancelShareAudioWait(): void {
    const id = awaitingId;
    awaitingId = null;
    if (id === null) return;
    const done = ready.get(id);
    ready.delete(id);
    if (done) releaseShareAudio(done);
    const waiter = waiters.get(id);
    waiters.delete(id);
    waiter?.(null);
    // A capture may still be starting in main; stop that too.
    bridge()?.stopAudio?.();
}

/** Drop a result nobody will use, and stop its capture in main. */
export function releaseShareAudio(result: ShareAudioResult): void {
    result.port?.close();
    if (result.kind === "pcm" || result.kind === "device") {
        bridge()?.stopAudio?.();
    }
}

/** Stop the running share-audio capture in main (the share ended). */
export function stopShareAudioCapture(): void {
    bridge()?.stopAudio?.();
}
