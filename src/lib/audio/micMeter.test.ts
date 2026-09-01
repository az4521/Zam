import { describe, it, expect, vi, afterEach } from "vitest";
import { startMicMeter, type MicMeterOptions } from "./micMeter";

/**
 * These cover the one thing about the mic meter that is provable without a
 * real device: that a granted stream is never left running when the meter
 * fails to finish building, and that the returned handle releases everything
 * it opened. Both are the MEDIA-01 failure mode — a live microphone with no
 * reachable handle.
 */

function fakeStream() {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    return { tracks, getTracks: () => tracks };
}

function stubDevices(stream: { getTracks: () => unknown[] }) {
    vi.stubGlobal("navigator", {
        mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    });
}

/** A minimal AudioContext good enough for the analyser graph. */
function stubAudioContext() {
    const close = vi.fn(async () => {});
    const analyser = {
        fftSize: 2048,
        getByteTimeDomainData: vi.fn(),
    };
    vi.stubGlobal(
        "AudioContext",
        class {
            close = close;
            createMediaStreamSource = () => ({ connect: vi.fn() });
            createAnalyser = () => analyser;
        },
    );
    return { close, analyser };
}

const OPTS: MicMeterOptions = {
    deviceId: null,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    onLevel: () => {},
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("startMicMeter", () => {
    it("stops the granted stream when the AudioContext cannot be built", async () => {
        const stream = fakeStream();
        stubDevices(stream);
        // Browsers cap how many AudioContexts a document may hold, and this
        // app builds several; exhausting the cap throws here.
        vi.stubGlobal(
            "AudioContext",
            class {
                constructor() {
                    throw new Error("cap reached");
                }
            },
        );

        await expect(startMicMeter(OPTS)).rejects.toThrow("cap reached");
        // Without the release the mic would stay live with its only handle
        // never constructed.
        for (const t of stream.tracks) expect(t.stop).toHaveBeenCalledTimes(1);
    });

    it("propagates a permission rejection without a stream to release", async () => {
        vi.stubGlobal("navigator", {
            mediaDevices: {
                getUserMedia: vi.fn(async () => {
                    throw new Error("NotAllowedError");
                }),
            },
        });
        stubAudioContext();

        await expect(startMicMeter(OPTS)).rejects.toThrow("NotAllowedError");
    });

    it("returns a handle whose stop() releases the stream and the context", async () => {
        const stream = fakeStream();
        stubDevices(stream);
        const { close } = stubAudioContext();
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1),
        );
        vi.stubGlobal("cancelAnimationFrame", vi.fn());

        const handle = await startMicMeter(OPTS);
        for (const t of stream.tracks) expect(t.stop).not.toHaveBeenCalled();

        handle.stop();
        for (const t of stream.tracks) expect(t.stop).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
        expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it("asks for the requested device as an exact constraint", async () => {
        const stream = fakeStream();
        stubDevices(stream);
        stubAudioContext();
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1),
        );

        await startMicMeter({ ...OPTS, deviceId: "mic-2" });

        // `exact`, not `ideal`: `ideal` is a soft hint the browser ignores, so
        // the meter used to watch the default mic regardless of the selection.
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
                deviceId: { exact: "mic-2" },
            },
        });
    });

    it("retries on the default mic when the chosen device is overconstrained", async () => {
        const stream = fakeStream();
        const overconstrained = Object.assign(new Error("gone"), {
            name: "OverconstrainedError",
        });
        const getUserMedia = vi
            .fn()
            .mockRejectedValueOnce(overconstrained)
            .mockResolvedValueOnce(stream);
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
        stubAudioContext();
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 1),
        );

        await startMicMeter({ ...OPTS, deviceId: "gone-mic" });

        expect(getUserMedia).toHaveBeenCalledTimes(2);
        // First tried the exact device, then fell back with NO deviceId.
        expect(getUserMedia).toHaveBeenNthCalledWith(1, {
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
                deviceId: { exact: "gone-mic" },
            },
        });
        expect(getUserMedia).toHaveBeenNthCalledWith(2, {
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            },
        });
    });

    it("does NOT retry a non-overconstrained rejection", async () => {
        const denied = Object.assign(new Error("denied"), {
            name: "NotAllowedError",
        });
        const getUserMedia = vi.fn().mockRejectedValue(denied);
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
        stubAudioContext();

        await expect(
            startMicMeter({ ...OPTS, deviceId: "mic-2" }),
        ).rejects.toThrow("denied");
        expect(getUserMedia).toHaveBeenCalledTimes(1);
    });
});
