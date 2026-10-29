import { describe, it, expect, afterEach, vi } from "vitest";

type Realm = typeof import("./webrtcRealm");

// The module keeps its realm in module state, so each test gets a fresh copy.
async function load(): Promise<Realm> {
    vi.resetModules();
    return import("./webrtcRealm");
}

class MainPc {}
class FramePc {}

function stubFrameWindow(win: object | null) {
    vi.spyOn(
        HTMLIFrameElement.prototype,
        "contentWindow",
        "get",
    ).mockReturnValue(win as Window | null);
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
});

describe("gpuExitAction", async () => {
    const { gpuExitAction, GPU_RECOVERY_WINDOW_MS } = await load();

    it("recovers the first time", () => {
        expect(gpuExitAction(null, 1000)).toBe("recover");
    });

    it("gives up when the GPU exits again while reconnecting", () => {
        expect(gpuExitAction({ doneAt: null }, 1000)).toBe("give-up");
    });

    it("gives up within the window after a recovery, recovers after it", () => {
        expect(
            gpuExitAction({ doneAt: 1000 }, 1000 + GPU_RECOVERY_WINDOW_MS - 1),
        ).toBe("give-up");
        expect(
            gpuExitAction({ doneAt: 1000 }, 1000 + GPU_RECOVERY_WINDOW_MS),
        ).toBe("recover");
    });
});

describe("ensureFreshWebrtcRealm", () => {
    it("does nothing until the GPU process has exited", async () => {
        (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
            MainPc;
        const realm = await load();
        expect(realm.ensureFreshWebrtcRealm()).toBe(false);
        expect(document.querySelector("iframe")).toBeNull();
        expect(window.RTCPeerConnection).toBe(MainPc);
    });

    it("moves RTCPeerConnection to a fresh iframe and reruns hooks", async () => {
        (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
            MainPc;
        const realm = await load();
        const hook = vi.fn();
        realm.onWebrtcRealm(hook);
        expect(hook).toHaveBeenCalledWith(MainPc);

        const frameWin = { RTCPeerConnection: FramePc };
        stubFrameWindow(frameWin);
        realm.markWebrtcRealmStale();
        expect(realm.webrtcRealmStale()).toBe(true);
        expect(realm.ensureFreshWebrtcRealm()).toBe(true);

        expect(window.RTCPeerConnection).toBe(FramePc);
        expect(hook).toHaveBeenLastCalledWith(FramePc);
        expect(realm.webrtcWindow()).toBe(frameWin);
        expect(realm.webrtcRealmStale()).toBe(false);
        expect(document.querySelectorAll("iframe")).toHaveLength(1);
        // Only once per exit.
        expect(realm.ensureFreshWebrtcRealm()).toBe(false);
    });

    it("removes the previous frame only after the call has moved", async () => {
        vi.useFakeTimers();
        (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
            MainPc;
        const realm = await load();
        stubFrameWindow({ RTCPeerConnection: FramePc });
        realm.markWebrtcRealmStale();
        realm.ensureFreshWebrtcRealm();
        realm.markWebrtcRealmStale();
        realm.ensureFreshWebrtcRealm();
        expect(document.querySelectorAll("iframe")).toHaveLength(2);
        vi.advanceTimersByTime(60_000);
        expect(document.querySelectorAll("iframe")).toHaveLength(1);
    });

    it("stays on the current classes when the frame has no WebRTC", async () => {
        (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
            MainPc;
        const realm = await load();
        stubFrameWindow({});
        realm.markWebrtcRealmStale();
        expect(realm.ensureFreshWebrtcRealm()).toBe(false);
        expect(window.RTCPeerConnection).toBe(MainPc);
        expect(document.querySelector("iframe")).toBeNull();
    });
});
