import { describe, expect, it, vi } from "vitest";
import {
    installScriptTransformPolyfill,
    needsScriptTransformPolyfill,
    SCRIPT_TRANSFORM_TAG,
} from "./rtcScriptTransform";

/** A fake WebView: a sender prototype whose createEncodedStreams may run once
 *  per sender (as Chromium enforces), and a PC class that records its config. */
function fakeWebView(withScriptTransform = false) {
    const created = new WeakSet<object>();
    const createEncodedStreams = vi.fn(function (this: object) {
        if (created.has(this)) throw new Error("InvalidStateError");
        created.add(this);
        return {
            readable: new ReadableStream(),
            writable: new WritableStream(),
        };
    });
    const senderProto = { createEncodedStreams };
    const configs: unknown[] = [];
    class RawPC extends EventTarget {
        senders: unknown[] = [];
        constructor(config?: unknown) {
            super();
            configs.push(config);
        }
        getSenders() {
            return this.senders;
        }
    }
    const g: Record<string, unknown> = {
        RTCRtpSender: { prototype: senderProto },
        RTCPeerConnection: RawPC,
    };
    if (withScriptTransform) g.RTCRtpScriptTransform = class {};
    return { g, senderProto, createEncodedStreams, configs };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("needsScriptTransformPolyfill", () => {
    it("applies only when the class is missing and insertable streams exist", () => {
        expect(needsScriptTransformPolyfill(fakeWebView().g)).toBe(true);
        expect(needsScriptTransformPolyfill(fakeWebView(true).g)).toBe(false);
        expect(needsScriptTransformPolyfill({})).toBe(false);
    });

    it("leaves a WebView with the real class untouched", () => {
        const wv = fakeWebView(true);
        const before = wv.g.RTCPeerConnection;
        expect(installScriptTransformPolyfill(wv.g)).toBe(false);
        expect(wv.g.RTCPeerConnection).toBe(before);
        expect(wv.configs).toHaveLength(0);
    });
});

describe("installScriptTransformPolyfill", () => {
    it("sets the transform through the worker and claims the sender's streams", () => {
        const wv = fakeWebView();
        expect(installScriptTransformPolyfill(wv.g)).toBe(true);
        const Transform = wv.g.RTCRtpScriptTransform as new (
            w: unknown,
            o: unknown,
        ) => object;
        const worker = { postMessage: vi.fn() };
        const sender = Object.create(wv.senderProto) as RTCRtpSender;
        const transform = new Transform(worker, { kind: "share" });
        sender.transform = transform as RTCRtpScriptTransform;

        expect(sender.transform).toBe(transform);
        expect(wv.createEncodedStreams).toHaveBeenCalledTimes(1);
        expect(worker.postMessage).toHaveBeenCalledTimes(1);
        const [msg, transfer] = worker.postMessage.mock.calls[0];
        expect(msg.tag).toBe(SCRIPT_TRANSFORM_TAG);
        expect(msg.options).toEqual({ kind: "share" });
        expect(msg.readable).toBeInstanceOf(ReadableStream);
        expect(msg.writable).toBeInstanceOf(WritableStream);
        expect(transfer).toEqual([msg.readable, msg.writable]);
    });

    it("ignores values that are not transforms", () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const sender = Object.create(wv.senderProto) as RTCRtpSender;
        sender.transform = null as unknown as RTCRtpScriptTransform;
        expect(sender.transform).toBeNull();
        expect(wv.createEncodedStreams).not.toHaveBeenCalled();
    });

    it("refuses a second transform on a sender that already has streams", () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const Transform = wv.g.RTCRtpScriptTransform as new (
            w: unknown,
            o: unknown,
        ) => object;
        const worker = { postMessage: vi.fn() };
        const sender = Object.create(wv.senderProto) as RTCRtpSender;
        sender.transform = new Transform(worker, {}) as RTCRtpScriptTransform;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        sender.transform = new Transform(worker, {}) as RTCRtpScriptTransform;
        expect(warn).toHaveBeenCalled();
        expect(worker.postMessage).toHaveBeenCalledTimes(1);
        expect(wv.createEncodedStreams).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("records streams LiveKit takes itself, so the pass-through skips them", async () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const RTC = wv.g.RTCPeerConnection as new (c?: unknown) => {
            senders: unknown[];
            dispatchEvent(e: Event): boolean;
        };
        const pc = new RTC({});
        const e2eeSender = Object.create(wv.senderProto);
        e2eeSender.createEncodedStreams();
        const plainSender = Object.create(wv.senderProto);
        pc.senders = [e2eeSender, plainSender];
        wv.createEncodedStreams.mockClear();
        pc.dispatchEvent(new Event("negotiationneeded"));
        await tick();
        // Only the plain sender is taken by the pass-through.
        expect(wv.createEncodedStreams).toHaveBeenCalledTimes(1);
        expect(wv.createEncodedStreams.mock.contexts[0]).toBe(plainSender);
    });
});

describe("patched RTCPeerConnection", () => {
    it("adds encodedInsertableStreams and keeps the caller's config", () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const RTC = wv.g.RTCPeerConnection as new (c?: unknown) => object;
        new RTC({
            iceServers: [{ urls: "stun:x" }],
            bundlePolicy: "max-bundle",
        });
        expect(wv.configs[0]).toEqual({
            iceServers: [{ urls: "stun:x" }],
            bundlePolicy: "max-bundle",
            encodedInsertableStreams: true,
        });
    });

    it("passes every unclaimed sender through once negotiation starts", async () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const RTC = wv.g.RTCPeerConnection as new (c?: unknown) => {
            senders: unknown[];
            dispatchEvent(e: Event): boolean;
        };
        const pc = new RTC({});
        const mic = Object.create(wv.senderProto);
        const camera = Object.create(wv.senderProto);
        pc.senders = [mic, camera];
        pc.dispatchEvent(new Event("negotiationneeded"));
        await tick();
        expect(wv.createEncodedStreams).toHaveBeenCalledTimes(2);
        // Another negotiation does not take the same senders again.
        pc.dispatchEvent(new Event("negotiationneeded"));
        await tick();
        expect(wv.createEncodedStreams).toHaveBeenCalledTimes(2);
    });

    it("passes received tracks through, or they never decode", () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const RTC = wv.g.RTCPeerConnection as new (c?: unknown) => EventTarget;
        const pc = new RTC({});
        const receiver = {
            createEncodedStreams: vi.fn(() => ({
                readable: new ReadableStream(),
                writable: new WritableStream(),
            })),
        };
        const trackEvent = () =>
            Object.assign(new Event("track"), { receiver });
        pc.dispatchEvent(trackEvent());
        // A second event for the same receiver does not take it again.
        pc.dispatchEvent(trackEvent());
        expect(receiver.createEncodedStreams).toHaveBeenCalledTimes(1);
    });

    it("leaves received tracks to LiveKit when the caller asked for insertable streams", () => {
        const wv = fakeWebView();
        installScriptTransformPolyfill(wv.g);
        const RTC = wv.g.RTCPeerConnection as new (c?: unknown) => EventTarget;
        const pc = new RTC({ encodedInsertableStreams: true });
        const receiver = {
            createEncodedStreams: vi.fn(() => ({
                readable: new ReadableStream(),
                writable: new WritableStream(),
            })),
        };
        pc.dispatchEvent(Object.assign(new Event("track"), { receiver }));
        expect(receiver.createEncodedStreams).not.toHaveBeenCalled();
    });
});
