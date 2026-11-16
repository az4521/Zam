import { describe, it, expect, afterEach, vi } from "vitest";
import { runInNewContext } from "node:vm";

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

describe("adoptMessageData", () => {
    // A second realm, as a GPU-exit iframe is: its own ArrayBuffer and a
    // MessageEvent whose data getter hands those out.
    function foreignRealm() {
        const ForeignArrayBuffer = runInNewContext(
            "ArrayBuffer",
        ) as ArrayBufferConstructor;
        class ForeignBlob {}
        class ForeignMessageEvent {
            constructor(readonly payload: unknown) {}
        }
        Object.defineProperty(ForeignMessageEvent.prototype, "data", {
            configurable: true,
            enumerable: true,
            get(this: ForeignMessageEvent) {
                return this.payload;
            },
        });
        const win = {
            ArrayBuffer: ForeignArrayBuffer,
            Blob: ForeignBlob,
            MessageEvent: ForeignMessageEvent,
        };
        return { win, ForeignArrayBuffer, ForeignMessageEvent };
    }

    it("returns the frame's binary message data as this window's ArrayBuffer", async () => {
        const realm = await load();
        const { win, ForeignArrayBuffer, ForeignMessageEvent } = foreignRealm();
        const foreign = new ForeignArrayBuffer(3);
        new Uint8Array(foreign).set([1, 2, 3]);
        expect(foreign instanceof ArrayBuffer).toBe(false);

        realm.adoptMessageData(win as unknown as Window & typeof globalThis);
        const event = new ForeignMessageEvent(foreign) as unknown as {
            data: unknown;
        };
        const data = event.data;
        expect(data instanceof ArrayBuffer).toBe(true);
        expect([...new Uint8Array(data as ArrayBuffer)]).toEqual([1, 2, 3]);
        expect(event.data).toBe(data);
    });

    it("leaves strings and this window's objects alone", async () => {
        const realm = await load();
        const { win, ForeignMessageEvent } = foreignRealm();
        realm.adoptMessageData(win as unknown as Window & typeof globalThis);
        const local = new ArrayBuffer(1);
        expect(
            (new ForeignMessageEvent("hi") as unknown as { data: unknown })
                .data,
        ).toBe("hi");
        expect(
            (new ForeignMessageEvent(local) as unknown as { data: unknown })
                .data,
        ).toBe(local);
    });

    it("patches each fresh frame", async () => {
        (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
            MainPc;
        const realm = await load();
        const { win, ForeignArrayBuffer, ForeignMessageEvent } = foreignRealm();
        stubFrameWindow({ ...win, RTCPeerConnection: FramePc });
        realm.markWebrtcRealmStale();
        expect(realm.ensureFreshWebrtcRealm()).toBe(true);
        const event = new ForeignMessageEvent(
            new ForeignArrayBuffer(2),
        ) as unknown as { data: unknown };
        expect(event.data instanceof ArrayBuffer).toBe(true);
    });
});
