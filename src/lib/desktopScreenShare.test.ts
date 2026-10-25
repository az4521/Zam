import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type AudioInfo = { id: number; kind: string; label?: string };

function installBridge(platform = "win32-x64") {
    let onAudio: ((info: AudioInfo) => void) | null = null;
    const bridge = {
        onRequest: () => () => {},
        onCancel: () => () => {},
        respond: vi.fn(),
        onAudio: (cb: (info: AudioInfo) => void) => {
            onAudio = cb;
            return () => {};
        },
        stopAudio: vi.fn(),
    };
    (window as unknown as { desktop: unknown }).desktop = {
        screenShare: bridge,
        pluginNative: { platform },
    };
    return {
        bridge,
        audio: (info: AudioInfo) => onAudio?.(info),
    };
}

/** What preload does with a capture's port. */
function postPort(id: number): MessagePort {
    const { port1, port2 } = new MessageChannel();
    window.dispatchEvent(
        new MessageEvent("message", {
            data: `zam:share-audio-port:${id}`,
            source: window,
            ports: [port2],
        }),
    );
    return port1;
}

async function load() {
    vi.resetModules();
    return import("./desktopScreenShare");
}

describe("share audio handoff", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        delete (window as unknown as { desktop?: unknown }).desktop;
    });

    it("is offered on Windows and Linux, not macOS or the web", async () => {
        let m = await load();
        expect(m.pickerOffersShareAudio()).toBe(false);
        installBridge("linux-x64");
        expect(m.pickerOffersShareAudio()).toBe(true);
        installBridge("darwin-arm64");
        m = await load();
        expect(m.pickerOffersShareAudio()).toBe(false);
    });

    it("passes the audio choice to main", async () => {
        const { bridge } = installBridge();
        const m = await load();
        m.respondToScreenShare(3, "window:9:0", "Game", "auto");
        expect(bridge.respond).toHaveBeenCalledWith(
            3,
            "window:9:0",
            "Game",
            "auto",
        );
    });

    it("resolves with the PCM port whichever part arrives first", async () => {
        const { audio } = installBridge();
        const m = await load();
        m.respondToScreenShare(1, "screen:0:0", "Screen", "system");
        const taken = m.takeShareAudio();
        audio({ id: 1, kind: "pcm" });
        postPort(1);
        const r = await taken;
        expect(r?.kind).toBe("pcm");
        expect(r?.port).toBeInstanceOf(MessagePort);

        m.respondToScreenShare(2, "screen:0:0", "Screen", "system");
        postPort(2);
        audio({ id: 2, kind: "pcm" });
        const r2 = await m.takeShareAudio();
        expect(r2?.id).toBe(2);
        expect(r2?.port).toBeInstanceOf(MessagePort);
    });

    it("hands over a virtual microphone without waiting for a port", async () => {
        const { audio } = installBridge("linux-x64");
        const m = await load();
        m.respondToScreenShare(4, "screen:0:0", "Screen", "app:pw:mpv");
        audio({ id: 4, kind: "device", label: "vencord-screen-share" });
        expect(await m.takeShareAudio()).toEqual({
            id: 4,
            kind: "device",
            label: "vencord-screen-share",
            port: undefined,
        });
    });

    it("has nothing to take when no audio was picked", async () => {
        installBridge();
        const m = await load();
        m.respondToScreenShare(5, "screen:0:0", "Screen", "none");
        expect(await m.takeShareAudio()).toBeNull();
    });

    it("gives up after a while, and stops a capture that turns up late", async () => {
        const { bridge, audio } = installBridge();
        const m = await load();
        m.respondToScreenShare(6, "screen:0:0", "Screen", "system");
        const taken = m.takeShareAudio(1000);
        vi.advanceTimersByTime(1000);
        expect(await taken).toBeNull();
        audio({ id: 6, kind: "pcm" });
        postPort(6);
        expect(bridge.stopAudio).toHaveBeenCalled();
    });

    it("stops the capture when the share itself failed", async () => {
        const { bridge, audio } = installBridge();
        const m = await load();
        m.respondToScreenShare(7, "screen:0:0", "Screen", "system");
        audio({ id: 7, kind: "device", label: "x" });
        m.cancelShareAudioWait();
        expect(bridge.stopAudio).toHaveBeenCalled();
        expect(await m.takeShareAudio()).toBeNull();
    });

    it("reports a capture that failed to start", async () => {
        const { audio } = installBridge();
        const m = await load();
        m.respondToScreenShare(8, "window:1:0", "App", "auto");
        audio({ id: 8, kind: "failed" });
        expect((await m.takeShareAudio())?.kind).toBe("failed");
    });
});
