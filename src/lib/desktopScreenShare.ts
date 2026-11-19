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

/** What the native capture helper is set up with, before each share. */
export interface NativeShareSetup {
    enabled: boolean;
    fps: number;
    bitrate: number;
    maxWidth: number;
    maxHeight: number;
    /** Also encode a half-size layer for simulcast (Windows helper). */
    simulcast?: boolean;
}

/** What the helper reported when it started (its info JSON, see
 *  electron/ native-share). */
export interface NativeShareStart {
    requestId?: number;
    width?: number;
    height?: number;
    encoder?: string;
    hardware?: boolean;
}

/** A helper started for the picked share: the port to its AUs. */
export interface NativeSharePort {
    info: NativeShareStart;
    port: MessagePort;
}

const NATIVE_PORT_TAG = "zam:native-share-port";
/** Main posts the helper's port to the window with this tag. */
let nativePort: NativeSharePort | null = null;
/** How long a helper port that arrived with nobody waiting is kept for
 *  takeNativeSharePort before its helper is stopped. */
const NATIVE_PORT_PARK_MS = 10_000;

function releaseNativePort(p: NativeSharePort | null): void {
    if (!p) return;
    p.port.postMessage({ cmd: "stop" });
    p.port.close();
}
let nativeWaiter: ((p: NativeSharePort | null) => void) | null = null;
let nativeListening = false;

function listenNative(): void {
    if (nativeListening || typeof window === "undefined") return;
    nativeListening = true;
    window.addEventListener("message", (e: MessageEvent) => {
        if (e.source !== window || !e.data || typeof e.data !== "object")
            return;
        const data = e.data as { tag?: unknown; info?: unknown };
        if (data.tag !== NATIVE_PORT_TAG || !e.ports[0]) return;
        // Android's share has its own port (lib/androidScreenShare.ts).
        if (
            (data.info as { platform?: unknown } | undefined)?.platform ===
            "android"
        )
            return;
        const next: NativeSharePort = {
            info: (data.info as NativeShareStart) ?? {},
            port: e.ports[0],
        };
        const waiter = nativeWaiter;
        if (waiter) {
            nativeWaiter = null;
            waiter(next);
        } else {
            // Kept for takeNativeSharePort; a newer one replaces it. One
            // nobody takes (it came after the share gave up waiting) is
            // stopped, or the helper keeps encoding into a port nobody
            // reads and every AU queues in memory.
            releaseNativePort(nativePort);
            nativePort = next;
            setTimeout(() => {
                if (nativePort !== next) return;
                nativePort = null;
                releaseNativePort(next);
            }, NATIVE_PORT_PARK_MS);
        }
    });
}

/** Whether this is the Windows desktop app and its bridge can run the native
 *  capture helper (the main process decides whether the helper exists). */
export function nativeShareAvailable(): boolean {
    const platform =
        typeof window !== "undefined"
            ? (window.desktop?.pluginNative?.platform ?? "")
            : "";
    return !!bridge()?.configureNative && platform.startsWith("win32");
}

/** Set up the native capture helper for the next share. Any port from an
 *  earlier share that nobody took is stopped. No-op without the bridge. */
export function configureNativeShare(cfg: NativeShareSetup): void {
    discardNativeSharePort();
    listenNative();
    bridge()?.configureNative?.(cfg);
}

/** The helper port for the share just picked: the most recent one received
 *  since the last configureNativeShare, waiting up to timeoutMs for it. Null
 *  when none came (the share then runs on Chromium's capture). */
export function takeNativeSharePort(
    timeoutMs = 1500,
): Promise<NativeSharePort | null> {
    if (nativePort) {
        const p = nativePort;
        nativePort = null;
        return Promise.resolve(p);
    }
    if (!nativeListening) return Promise.resolve(null);
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            if (nativeWaiter === done) nativeWaiter = null;
            resolve(null);
        }, timeoutMs);
        const done = (p: NativeSharePort | null) => {
            clearTimeout(timer);
            resolve(p);
        };
        nativeWaiter = done;
    });
}

/** Stop a helper whose port nobody took (its share never started). */
export function discardNativeSharePort(): void {
    const p = nativePort;
    nativePort = null;
    releaseNativePort(p);
}
