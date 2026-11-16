// The Android screen share's bridge to the native ScreenShare plugin
// (android/.../ScreenShareService, MediaProjection -> MediaCodec H.264). The
// plugin posts its access units on a WebMessagePort, which this module turns
// into the port shape the native share's worker already takes from the
// Windows helper (matrix/call/nativeShare.ts). Everything here is inert off
// Android.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { androidShare } from "$lib/stores/androidScreenShare.svelte";
import {
    parseAndroidAu,
    parseAndroidText,
} from "$lib/utils/androidScreenShare";

interface ScreenSharePlugin {
    isAvailable(): Promise<{ available: boolean; reason?: string }>;
    start(options: {
        fps: number;
        bitrate: number;
        maxWidth: number;
        maxHeight: number;
    }): Promise<{ started: boolean; width?: number; height?: number }>;
    stop(): Promise<void>;
}

/** The plugin's port announcement, as the native side tags it. */
const PORT_TAG = "zam:native-share-port";
/** How long a started share waits for its port (it is posted first). */
const PORT_WAIT_MS = 3000;

/** What the native side says about the started share. */
export interface AndroidShareInfo {
    platform?: string;
    width?: number;
    height?: number;
    encoder?: string;
    hardware?: boolean;
}

/** A share the plugin started: the info and the helper port (the worker's
 *  end, speaking the Windows helper's message shape). */
export interface AndroidShareStart {
    info: AndroidShareInfo;
    helper: MessagePort;
}

let plugin: ScreenSharePlugin | null = null;

function screenSharePlugin(): ScreenSharePlugin {
    if (!plugin) plugin = registerPlugin<ScreenSharePlugin>("ScreenShare");
    return plugin;
}

/** Ask the plugin whether this device can share. Feeds androidShare, which
 *  the share buttons read. */
export async function probeAndroidScreenShare(): Promise<void> {
    if (!androidShare.native) return;
    try {
        const res = await screenSharePlugin().isAvailable();
        androidShare.available = res.available === true;
    } catch {
        androidShare.available = false;
    }
}

if (androidShare.native && Capacitor.isNativePlatform())
    void probeAndroidScreenShare();

let pending: { info: AndroidShareInfo; port: MessagePort } | null = null;
let waiter:
    ((p: { info: AndroidShareInfo; port: MessagePort } | null) => void) | null =
    null;
let listening = false;

function onWindowMessage(e: MessageEvent): void {
    // Posted by the WebView host, so the source may be null rather than the
    // window. A frame's own postMessage (another window) is refused.
    if (e.source !== window && e.source !== null) return;
    // The Android handshake is a JSON string (WebView messages carry only
    // strings and ArrayBuffers). The Electron one is an object: both work.
    let data: { tag?: unknown; info?: unknown } | null = null;
    if (typeof e.data === "string") {
        try {
            data = JSON.parse(e.data) as { tag?: unknown; info?: unknown };
        } catch {
            return;
        }
    } else if (e.data && typeof e.data === "object") {
        data = e.data as { tag?: unknown; info?: unknown };
    }
    if (!data || typeof data !== "object" || data.tag !== PORT_TAG) return;
    const port = e.ports[0];
    if (!port) return;
    const info = (data.info ?? {}) as AndroidShareInfo;
    // The Windows port uses the same tag; it is not ours.
    if (info.platform !== "android") return;
    const next = { info, port };
    if (waiter) {
        const w = waiter;
        waiter = null;
        w(next);
    } else {
        pending?.port.close();
        pending = next;
    }
}

function listen(): void {
    if (listening || typeof window === "undefined") return;
    listening = true;
    window.addEventListener("message", onWindowMessage);
}

function takePort(timeoutMs: number): Promise<{
    info: AndroidShareInfo;
    port: MessagePort;
} | null> {
    if (pending) {
        const p = pending;
        pending = null;
        return Promise.resolve(p);
    }
    return new Promise((resolve) => {
        const done = (
            p: { info: AndroidShareInfo; port: MessagePort } | null,
        ) => {
            clearTimeout(timer);
            resolve(p);
        };
        const timer = setTimeout(() => {
            if (waiter === done) waiter = null;
            resolve(null);
        }, timeoutMs);
        waiter = done;
    });
}

/** Turn the native port into the worker's: the worker gets port1, and port2
 *  relays both ways, converting native messages to the Windows helper's shape
 *  and the worker's commands to the plugin's JSON. */
function adaptNativePort(native: MessagePort): MessagePort {
    const { port1, port2 } = new MessageChannel();
    // Commands from the worker (key, bitrate, fps, stop) go to the plugin.
    port2.onmessage = (e: MessageEvent<{ cmd?: unknown } | null>) => {
        const msg = e.data;
        if (!msg || typeof msg.cmd !== "string") return;
        native.postMessage(JSON.stringify(msg));
        if (msg.cmd === "stop") native.close();
    };
    native.onmessage = (e: MessageEvent<unknown>) => {
        const data = e.data;
        if (data instanceof ArrayBuffer) {
            const au = parseAndroidAu(data);
            if (au) port2.postMessage(au, [au.data]);
            return;
        }
        if (typeof data !== "string") return;
        const msg = parseAndroidText(data);
        if (!msg) return;
        if (msg.type === "info") {
            // The helper's shape: an error, or a size change on rotation
            // (the next access unit is a keyframe at the new size).
            const info = msg.info;
            if (typeof info.error === "string")
                port2.postMessage({
                    type: "info",
                    info: { event: "error", message: info.error },
                });
            else if (typeof info.width === "number")
                port2.postMessage({
                    type: "info",
                    info: {
                        event: "size",
                        width: info.width,
                        height: info.height,
                    },
                });
            else port2.postMessage(msg);
            return;
        }
        port2.postMessage(msg);
        if (msg.type === "ended") native.close();
    };
    return port1;
}

/** Start a share on the native plugin. Resolves null when the user declined
 *  the system's capture consent. Throws when the share started but its port
 *  never arrived (the share is stopped first). */
export async function startAndroidScreenShare(options: {
    fps: number;
    bitrate: number;
    maxWidth: number;
    maxHeight: number;
}): Promise<AndroidShareStart | null> {
    listen();
    if (pending) {
        pending.port.close();
        pending = null;
    }
    const res = await screenSharePlugin().start(options);
    if (!res.started) return null;
    const got = await takePort(PORT_WAIT_MS);
    if (!got) {
        await stopAndroidScreenShare();
        throw new Error("the native screen share sent no port");
    }
    return { info: got.info, helper: adaptNativePort(got.port) };
}

/** Stop the native share (the notification's stop does the same). Errors are
 *  swallowed: a share that is already gone has nothing left to stop. */
export async function stopAndroidScreenShare(): Promise<void> {
    if (!androidShare.native) return;
    try {
        await screenSharePlugin().stop();
    } catch {
        // Already stopped.
    }
}
