import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PluginSocketsHost } from "./pluginSockets";

// The Android adapter: a stable fake of the PluginSockets plugin. Each test
// sets its implementations (see the Android block), so nothing leaks.
const android = vi.hoisted(() => ({
    platform: "web" as string,
    available: true,
    listeners: [] as Array<(ev: unknown) => void>,
    plugin: {
        tcp: vi.fn(),
        udp: vi.fn(),
        write: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        closePlugin: vi.fn(),
        addListener: vi.fn(),
    },
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: {
        getPlatform: () => android.platform,
        isPluginAvailable: (name: string) =>
            android.available && name === "PluginSockets",
    },
    registerPlugin: () => android.plugin,
}));

type SocketEvent = {
    id: number;
    type: "data" | "message" | "close";
    data?: Uint8Array;
    host?: string;
    port?: number;
    error?: string | null;
};

interface FakeBridge {
    tcp: ReturnType<typeof vi.fn>;
    udp: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    closePlugin: ReturnType<typeof vi.fn>;
    onEvent: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    /** Deliver a main-process event to the page's listener. */
    fire(msg: SocketEvent): void;
}

function makeBridge(): FakeBridge {
    let emit: ((msg: SocketEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    return {
        tcp: vi.fn(async () => ({ ok: true, id: 1 })),
        udp: vi.fn(async () => ({ ok: true, id: 2, localPort: 5353 })),
        write: vi.fn(async () => ({ ok: true })),
        send: vi.fn(async () => ({ ok: true })),
        close: vi.fn(async () => undefined),
        closePlugin: vi.fn(async () => undefined),
        onEvent: vi.fn((cb: (msg: SocketEvent) => void) => {
            emit = cb;
            return unsubscribe;
        }),
        unsubscribe,
        fire(msg) {
            if (!emit) throw new Error("no onEvent listener registered");
            emit(msg);
        },
    };
}

function setDesktop(value: unknown): void {
    (window as unknown as { desktop?: unknown }).desktop = value;
}

const PLUGIN = "com.example.net";
const TCP_RULE = "tcp:127.0.0.1:7656";
const UDP_RULE = "udp:203.0.113.5:7000";

describe("pluginSockets", () => {
    // Module state (routes, the one IPC listener) lives at module scope, so
    // every test loads a fresh copy.
    let mod: typeof import("./pluginSockets");
    let bridge: FakeBridge;

    beforeEach(async () => {
        vi.resetModules();
        mod = await import("./pluginSockets");
        bridge = makeBridge();
        setDesktop({ pluginSockets: bridge });
    });

    afterEach(() => {
        delete (window as unknown as { desktop?: unknown }).desktop;
        vi.restoreAllMocks();
    });

    it("socketsAvailable is false without the bridge and true with it", () => {
        delete (window as unknown as { desktop?: unknown }).desktop;
        expect(mod.socketsAvailable()).toBe(false);
        setDesktop({});
        expect(mod.socketsAvailable()).toBe(false);
        setDesktop({ pluginSockets: bridge });
        expect(mod.socketsAvailable()).toBe(true);
    });

    it("connectTcp rejects an endpoint not in the rules and never calls the bridge", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        await expect(host.connectTcp("example.org", 80)).rejects.toThrow(
            /not in the manifest's "sockets"/,
        );
        await expect(host.connectTcp("127.0.0.1", 7657)).rejects.toThrow(
            /not in the manifest/,
        );
        expect(bridge.tcp).not.toHaveBeenCalled();
    });

    it("connectTcp rejects a bad port or host before the rules check", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        await expect(host.connectTcp("127.0.0.1", 0)).rejects.toThrow(
            RangeError,
        );
        await expect(host.connectTcp("  ", 7656)).rejects.toThrow(TypeError);
        expect(bridge.tcp).not.toHaveBeenCalled();
    });

    it("connectTcp to an allowed endpoint calls bridge.tcp and returns a socket", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        expect(bridge.tcp).toHaveBeenCalledWith({
            pluginId: PLUGIN,
            host: "127.0.0.1",
            port: 7656,
        });
        expect(sock.remoteHost).toBe("127.0.0.1");
        expect(sock.remotePort).toBe(7656);
    });

    it("surfaces a failed connect as an error", async () => {
        bridge.tcp.mockResolvedValueOnce({ ok: false, error: "refused" });
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        await expect(host.connectTcp("127.0.0.1", 7656)).rejects.toThrow(
            "refused",
        );
    });

    it("routes data events to the socket's onData callbacks", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        const got: number[][] = [];
        sock.onData((d) => got.push([...d]));
        bridge.fire({ id: 1, type: "data", data: new Uint8Array([1, 2, 3]) });
        bridge.fire({ id: 99, type: "data", data: new Uint8Array([9]) });
        expect(got).toEqual([[1, 2, 3]]);
    });

    it("encodes string writes as UTF-8 and passes bytes through", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        await sock.write("hi");
        expect(bridge.write).toHaveBeenLastCalledWith(
            1,
            new TextEncoder().encode("hi"),
        );
        const raw = new Uint8Array([7]);
        await sock.write(raw);
        expect(bridge.write).toHaveBeenLastCalledWith(1, raw);
    });

    it("fires onClose exactly once and tears the route down", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        const onClose = vi.fn();
        const onData = vi.fn();
        sock.onClose(onClose);
        sock.onData(onData);
        bridge.fire({ id: 1, type: "close", error: null });
        bridge.fire({ id: 1, type: "close", error: null });
        bridge.fire({ id: 1, type: "data", data: new Uint8Array([1]) });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith(null);
        expect(onData).not.toHaveBeenCalled();
        expect(bridge.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("passes the error of a failed close to onClose", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        const onClose = vi.fn();
        sock.onClose(onClose);
        bridge.fire({ id: 1, type: "close", error: "ECONNRESET" });
        expect(onClose).toHaveBeenCalledWith("ECONNRESET");
    });

    it("drops UDP messages from endpoints not in the rules", async () => {
        const host = mod.createPluginSockets(PLUGIN, [UDP_RULE]);
        const sock = await host.openUdp({ localPort: 0 });
        expect(sock.localPort).toBe(5353);
        const got: Array<{ host: string; port: number; n: number }> = [];
        sock.onMessage((m) =>
            got.push({ host: m.host, port: m.port, n: m.data.length }),
        );
        // Allowed sender.
        bridge.fire({
            id: 2,
            type: "message",
            host: "203.0.113.5",
            port: 7000,
            data: new Uint8Array([1, 2]),
        });
        // Wrong host, wrong port: both dropped.
        bridge.fire({
            id: 2,
            type: "message",
            host: "198.51.100.1",
            port: 7000,
            data: new Uint8Array([3]),
        });
        bridge.fire({
            id: 2,
            type: "message",
            host: "203.0.113.5",
            port: 7001,
            data: new Uint8Array([4]),
        });
        expect(got).toEqual([{ host: "203.0.113.5", port: 7000, n: 2 }]);
    });

    it("refuses to send UDP to an endpoint not in the rules", async () => {
        const host = mod.createPluginSockets(PLUGIN, [UDP_RULE]);
        const sock = await host.openUdp();
        await expect(
            sock.send("198.51.100.1", 7000, new Uint8Array([1])),
        ).rejects.toThrow(/not in the manifest/);
        expect(bridge.send).not.toHaveBeenCalled();
        await sock.send("203.0.113.5", 7000, new Uint8Array([1]));
        expect(bridge.send).toHaveBeenCalledWith(
            2,
            "203.0.113.5",
            7000,
            new Uint8Array([1]),
        );
    });

    it("closeAll closes open sockets and calls closePlugin", async () => {
        const host: PluginSocketsHost = mod.createPluginSockets(PLUGIN, [
            TCP_RULE,
            UDP_RULE,
        ]);
        const tcp = await host.connectTcp("127.0.0.1", 7656);
        const udp = await host.openUdp();
        const tcpClose = vi.fn();
        const udpClose = vi.fn();
        tcp.onClose(tcpClose);
        udp.onClose(udpClose);

        host.closeAll();

        expect(bridge.close).toHaveBeenCalledWith(1);
        expect(bridge.close).toHaveBeenCalledWith(2);
        expect(tcpClose).toHaveBeenCalledWith(null);
        expect(udpClose).toHaveBeenCalledWith(null);
        expect(bridge.closePlugin).toHaveBeenCalledWith(PLUGIN);

        // And nothing new can be opened after unload.
        await expect(host.connectTcp("127.0.0.1", 7656)).rejects.toThrow(
            /unloaded/,
        );
    });
});

describe("pluginSockets on Android", () => {
    let mod: typeof import("./pluginSockets");
    let removeListener: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        delete (window as unknown as { desktop?: unknown }).desktop;
        android.platform = "android";
        android.available = true;
        android.listeners.length = 0;
        removeListener = vi.fn(async () => undefined);
        const p = android.plugin;
        for (const fn of Object.values(p)) fn.mockReset();
        p.tcp.mockImplementation(async () => ({ id: 7 }));
        p.udp.mockImplementation(async () => ({ id: 8, localPort: 6000 }));
        p.write.mockImplementation(async () => undefined);
        p.send.mockImplementation(async () => undefined);
        p.close.mockImplementation(async () => undefined);
        p.closePlugin.mockImplementation(async () => undefined);
        p.addListener.mockImplementation(
            async (_name: string, cb: (ev: unknown) => void) => {
                android.listeners.push(cb);
                return { remove: removeListener };
            },
        );
        mod = await import("./pluginSockets");
    });

    afterEach(() => {
        android.platform = "web";
        android.available = true;
        delete (window as unknown as { desktop?: unknown }).desktop;
    });

    /** Deliver a native event to the page's one socketEvent listener. */
    const fire = (ev: Record<string, unknown>) => {
        const cb = android.listeners[0];
        if (!cb) throw new Error("no socketEvent listener registered");
        cb(ev);
    };

    it("is available only on Android with the plugin present", () => {
        expect(mod.socketsAvailable()).toBe(true);
        android.platform = "web";
        expect(mod.socketsAvailable()).toBe(false);
        android.platform = "android";
        android.available = false;
        expect(mod.socketsAvailable()).toBe(false);
    });

    it("prefers the desktop bridge when both are present", async () => {
        const desktop = { tcp: vi.fn(async () => ({ ok: true, id: 1 })) };
        (window as unknown as { desktop?: unknown }).desktop = {
            pluginSockets: {
                ...desktop,
                udp: vi.fn(),
                write: vi.fn(),
                send: vi.fn(),
                close: vi.fn(),
                closePlugin: vi.fn(),
                onEvent: vi.fn(() => () => {}),
            },
        };
        const host = mod.createPluginSockets("p", [TCP_RULE]);
        await host.connectTcp("127.0.0.1", 7656);
        expect(desktop.tcp).toHaveBeenCalled();
        expect(android.plugin.tcp).not.toHaveBeenCalled();
    });

    it("connectTcp goes through the Android plugin with the same arguments", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        expect(android.plugin.tcp).toHaveBeenCalledWith({
            pluginId: PLUGIN,
            host: "127.0.0.1",
            port: 7656,
        });
        expect(sock.remotePort).toBe(7656);
    });

    it("maps a rejected native connect to a failed connect", async () => {
        android.plugin.tcp.mockRejectedValueOnce(new Error("refused"));
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        await expect(host.connectTcp("127.0.0.1", 7656)).rejects.toThrow(
            "refused",
        );
    });

    it("base64-encodes outgoing bytes and UTF-8 strings", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        await sock.write(new Uint8Array([0x00, 0xff, 0x0a]));
        expect(android.plugin.write).toHaveBeenLastCalledWith({
            id: 7,
            data: "AP8K",
        });
        await sock.write("hi");
        expect(android.plugin.write).toHaveBeenLastCalledWith({
            id: 7,
            data: "aGk=",
        });
    });

    it("surfaces a native write failure as a rejected write", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        android.plugin.write.mockRejectedValueOnce(new Error("boom"));
        await expect(sock.write("x")).rejects.toThrow("boom");
    });

    it("decodes base64 data events and routes them to the right socket", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        const got: number[][] = [];
        sock.onData((d) => got.push([...d]));
        fire({ id: 7, type: "data", data: "AP8K" });
        fire({ id: 99, type: "data", data: "AQ==" });
        expect(got).toEqual([[0x00, 0xff, 0x0a]]);
    });

    it("passes the close error through once and removes the native listener", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        const sock = await host.connectTcp("127.0.0.1", 7656);
        const onClose = vi.fn();
        sock.onClose(onClose);
        fire({ id: 7, type: "close", error: "ECONNRESET" });
        fire({ id: 7, type: "close", error: null });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith("ECONNRESET");
        // The listener handle resolves asynchronously; let it settle.
        await new Promise((r) => setTimeout(r, 0));
        expect(removeListener).toHaveBeenCalledTimes(1);
    });

    it("decodes UDP messages and still drops senders outside the rules", async () => {
        const host = mod.createPluginSockets(PLUGIN, [UDP_RULE]);
        const sock = await host.openUdp({ localPort: 0 });
        expect(sock.localPort).toBe(6000);
        const got: Array<{ host: string; port: number; data: number[] }> = [];
        sock.onMessage((m) =>
            got.push({ host: m.host, port: m.port, data: [...m.data] }),
        );
        fire({
            id: 8,
            type: "message",
            host: "203.0.113.5",
            port: 7000,
            data: "AQI=",
        });
        fire({
            id: 8,
            type: "message",
            host: "198.51.100.1",
            port: 7000,
            data: "Aw==",
        });
        expect(got).toEqual([
            { host: "203.0.113.5", port: 7000, data: [1, 2] },
        ]);
    });

    it("sends UDP datagrams base64-encoded through the plugin", async () => {
        const host = mod.createPluginSockets(PLUGIN, [UDP_RULE]);
        const sock = await host.openUdp();
        await sock.send("203.0.113.5", 7000, new Uint8Array([1, 2]));
        expect(android.plugin.send).toHaveBeenCalledWith({
            id: 8,
            host: "203.0.113.5",
            port: 7000,
            data: "AQI=",
        });
    });

    it("closeAll asks the native side to close the plugin's sockets", async () => {
        const host = mod.createPluginSockets(PLUGIN, [TCP_RULE]);
        await host.connectTcp("127.0.0.1", 7656);
        host.closeAll();
        expect(android.plugin.closePlugin).toHaveBeenCalledWith({
            pluginId: PLUGIN,
        });
    });
});
