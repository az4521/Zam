/**
 * zam.network: raw TCP and UDP sockets for a plugin, through the desktop
 * app's main process (electron/pluginSockets.cjs) or the Android app's
 * PluginSockets plugin (PluginSocketsPlugin.java). Every endpoint is checked
 * against the manifest's `sockets` (socketRules.ts) before it is reached.
 * Every socket a plugin opened closes when it unloads (`closeAll`).
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type { Disposable, PluginTcpSocket, PluginUdpSocket } from "./types";
import {
    isValidPort,
    parseSocketRule,
    socketAllowed,
    type SocketProtocol,
    type SocketRule,
} from "./socketRules";

type Bridge = NonNullable<NonNullable<Window["desktop"]>["pluginSockets"]>;
type SocketEvent = Parameters<Parameters<Bridge["onEvent"]>[0]>[0];

/** The Android plugin's wire shape: bytes travel as base64 strings. */
interface AndroidSocketEvent {
    id: number;
    type: "data" | "message" | "close";
    data?: string;
    host?: string;
    port?: number;
    error?: string | null;
}

interface AndroidPluginSockets {
    tcp(o: {
        pluginId: string;
        host: string;
        port: number;
    }): Promise<{ id: number }>;
    udp(o: {
        pluginId: string;
        localHost?: string;
        localPort?: number;
    }): Promise<{ id: number; localPort: number }>;
    write(o: { id: number; data: string }): Promise<void>;
    send(o: {
        id: number;
        host: string;
        port: number;
        data: string;
    }): Promise<void>;
    close(o: { id: number }): Promise<void>;
    closePlugin(o: { pluginId: string }): Promise<void>;
    addListener(
        eventName: "socketEvent",
        listenerFunc: (event: AndroidSocketEvent) => void,
    ): Promise<PluginListenerHandle>;
}
const AndroidSockets = registerPlugin<AndroidPluginSockets>("PluginSockets");

function toBase64(bytes: Uint8Array): string {
    let s = "";
    // Chunked so a large payload doesn't overflow the argument list.
    for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

function fromBase64(text: string): Uint8Array {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

function errorText(err: unknown): string {
    return String((err as Error)?.message ?? err);
}

/** The Android plugin, in the shape of the desktop bridge. */
const androidBridge: Bridge = {
    tcp: (req) =>
        AndroidSockets.tcp(req).then(
            (r) => ({ ok: true, id: r.id }),
            (err: unknown) => ({ ok: false, error: errorText(err) }),
        ),
    udp: (req) =>
        AndroidSockets.udp(req).then(
            (r) => ({ ok: true, id: r.id, localPort: r.localPort }),
            (err: unknown) => ({ ok: false, error: errorText(err) }),
        ),
    write: (id, data) =>
        AndroidSockets.write({ id, data: toBase64(data) }).then(
            () => ({ ok: true }),
            (err: unknown) => ({ ok: false, error: errorText(err) }),
        ),
    send: (id, host, port, data) =>
        AndroidSockets.send({ id, host, port, data: toBase64(data) }).then(
            () => ({ ok: true }),
            (err: unknown) => ({ ok: false, error: errorText(err) }),
        ),
    // Closing is best effort; the socket is gone on the page either way.
    close: (id) =>
        AndroidSockets.close({ id }).then(
            () => undefined,
            () => undefined,
        ),
    closePlugin: (pluginId) =>
        AndroidSockets.closePlugin({ pluginId }).then(
            () => undefined,
            () => undefined,
        ),
    onEvent: (cb) => {
        const handle = AndroidSockets.addListener("socketEvent", (ev) =>
            cb({
                id: ev.id,
                type: ev.type,
                data: ev.data === undefined ? undefined : fromBase64(ev.data),
                host: ev.host,
                port: ev.port,
                error: ev.error ?? null,
            }),
        );
        // The unsubscribe is synchronous; the listener is removed once the
        // registration has resolved.
        return () => {
            void handle.then(
                (h) => h.remove(),
                () => {},
            );
        };
    },
};

function onAndroid(): boolean {
    return (
        Capacitor.getPlatform() === "android" &&
        Capacitor.isPluginAvailable("PluginSockets")
    );
}

function bridge(): Bridge | undefined {
    if (typeof window === "undefined") return undefined;
    if (window.desktop?.pluginSockets) return window.desktop.pluginSockets;
    return onAndroid() ? androidBridge : undefined;
}

export function socketsAvailable(): boolean {
    return !!bridge();
}

/** Per-socket event routing; one IPC listener for the whole page. */
const routes = new Map<number, (msg: SocketEvent) => void>();
let unlisten: (() => void) | null = null;
function route(id: number, fn: (msg: SocketEvent) => void): void {
    routes.set(id, fn);
    if (!unlisten)
        unlisten =
            bridge()?.onEvent((msg) => routes.get(msg.id)?.(msg)) ?? null;
}
function unroute(id: number): void {
    routes.delete(id);
    if (routes.size === 0 && unlisten) {
        unlisten();
        unlisten = null;
    }
}

/** A set of callbacks; a throwing one doesn't stop the rest. */
function listeners<A extends unknown[]>(what: string) {
    const set = new Set<(...args: A) => void>();
    return {
        add(cb: (...args: A) => void): Disposable {
            set.add(cb);
            return { dispose: () => void set.delete(cb) };
        },
        fire(...args: A): void {
            for (const cb of [...set])
                try {
                    cb(...args);
                } catch (e) {
                    console.error(`[plugin] socket ${what} handler threw`, e);
                }
        },
        clear(): void {
            set.clear();
        },
    };
}

export interface PluginSocketsHost {
    connectTcp(host: string, port: number): Promise<PluginTcpSocket>;
    openUdp(opts?: {
        localHost?: string;
        localPort?: number;
    }): Promise<PluginUdpSocket>;
    /** Close every socket of the plugin (it unloaded). */
    closeAll(): void;
}

export function createPluginSockets(
    pluginId: string,
    declared: readonly string[] | undefined,
): PluginSocketsHost {
    const rules: SocketRule[] = (declared ?? [])
        .map(parseSocketRule)
        .filter((r): r is SocketRule => r !== null);
    const open = new Set<{ close(): void }>();
    let closed = false;

    const need = (protocol: SocketProtocol, host: string, port: number) => {
        if (typeof host !== "string" || !host.trim())
            throw new TypeError("host must be a non-empty string");
        if (!isValidPort(port)) throw new RangeError(`bad port ${port}`);
        if (!socketAllowed(rules, protocol, host, port))
            throw new Error(
                `${protocol}:${host}:${port} is not in the manifest's "sockets"`,
            );
    };
    const live = (): Bridge => {
        const b = bridge();
        if (!b) throw new Error("raw sockets need the desktop or Android app");
        if (closed) throw new Error("the plugin has unloaded");
        return b;
    };

    return {
        async connectTcp(host, port) {
            need("tcp", host, port);
            const b = live();
            const r = await b.tcp({ pluginId, host: host.trim(), port });
            if (!r.ok || r.id === undefined)
                throw new Error(r.error ?? "couldn't connect");
            const id = r.id;
            const data = listeners<[Uint8Array]>("data");
            const close = listeners<[string | null]>("close");
            let ended = false;
            const finish = (error: string | null) => {
                if (ended) return;
                ended = true;
                unroute(id);
                open.delete(sock);
                close.fire(error);
                data.clear();
                close.clear();
            };
            const sock: PluginTcpSocket = {
                remoteHost: host,
                remotePort: port,
                async write(chunk) {
                    if (ended) throw new Error("socket is closed");
                    const bytes =
                        typeof chunk === "string"
                            ? new TextEncoder().encode(chunk)
                            : chunk;
                    const w = await b.write(id, bytes);
                    if (!w.ok) throw new Error(w.error ?? "write failed");
                },
                onData: (cb) => data.add(cb),
                onClose: (cb) => close.add(cb),
                close() {
                    if (ended) return;
                    void b.close(id);
                    finish(null);
                },
            };
            open.add(sock);
            route(id, (msg) => {
                if (msg.type === "data" && msg.data) data.fire(msg.data);
                else if (msg.type === "close") finish(msg.error ?? null);
            });
            if (closed) sock.close();
            return sock;
        },

        async openUdp(opts = {}) {
            const localPort = opts.localPort ?? 0;
            if (!isValidPort(localPort, true))
                throw new RangeError(`bad port ${localPort}`);
            const b = live();
            const r = await b.udp({
                pluginId,
                localHost: opts.localHost ?? "127.0.0.1",
                localPort,
            });
            if (!r.ok || r.id === undefined)
                throw new Error(r.error ?? "couldn't open the socket");
            const id = r.id;
            const messages =
                listeners<[{ host: string; port: number; data: Uint8Array }]>(
                    "message",
                );
            const close = listeners<[string | null]>("close");
            let ended = false;
            const finish = (error: string | null) => {
                if (ended) return;
                ended = true;
                unroute(id);
                open.delete(sock);
                close.fire(error);
                messages.clear();
                close.clear();
            };
            const sock: PluginUdpSocket = {
                localPort: r.localPort ?? localPort,
                async send(host, port, payload) {
                    need("udp", host, port);
                    if (ended) throw new Error("socket is closed");
                    const s = await b.send(id, host.trim(), port, payload);
                    if (!s.ok) throw new Error(s.error ?? "send failed");
                },
                onMessage: (cb) => messages.add(cb),
                onClose: (cb) => close.add(cb),
                close() {
                    if (ended) return;
                    void b.close(id);
                    finish(null);
                },
            };
            open.add(sock);
            route(id, (msg) => {
                if (msg.type === "message" && msg.data) {
                    // Datagrams from endpoints the manifest doesn't list
                    // never reach the plugin.
                    const from = msg.host ?? "";
                    const port = msg.port ?? 0;
                    if (socketAllowed(rules, "udp", from, port))
                        messages.fire({ host: from, port, data: msg.data });
                } else if (msg.type === "close") finish(msg.error ?? null);
            });
            if (closed) sock.close();
            return sock;
        },

        closeAll() {
            closed = true;
            for (const s of [...open]) s.close();
            void bridge()?.closePlugin(pluginId);
        },
    };
}
