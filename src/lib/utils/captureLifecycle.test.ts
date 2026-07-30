import { describe, it, expect, vi } from "vitest";
import {
    newCaptureLifecycle,
    beginCapture,
    cancelCapture,
    disposeCaptures,
    isCaptureCurrent,
    stopTracks,
    stopHandle,
    adoptCapture,
    type Stoppable,
    type TrackSource,
} from "./captureLifecycle";

/** A MediaStream stand-in: structurally compatible, records what was stopped. */
function fakeStream(trackCount = 2): TrackSource & { stopped: number } {
    const self = {
        stopped: 0,
        getTracks: () =>
            Array.from({ length: trackCount }, () => ({
                stop: () => {
                    self.stopped += 1;
                },
            })),
    };
    return self;
}

describe("newCaptureLifecycle", () => {
    it("starts undisposed", () => {
        expect(newCaptureLifecycle().disposed).toBe(false);
    });
});

describe("beginCapture / isCaptureCurrent", () => {
    it("issues a ticket that is current", () => {
        const state = newCaptureLifecycle();
        expect(isCaptureCurrent(state, beginCapture(state))).toBe(true);
    });

    it("supersedes the previous ticket", () => {
        const state = newCaptureLifecycle();
        const first = beginCapture(state);
        const second = beginCapture(state);
        expect(isCaptureCurrent(state, first)).toBe(false);
        expect(isCaptureCurrent(state, second)).toBe(true);
    });

    it("never reissues a generation", () => {
        const state = newCaptureLifecycle();
        const seen = new Set<number>();
        for (let i = 0; i < 5; i++) {
            const g = beginCapture(state).generation;
            expect(seen.has(g)).toBe(false);
            seen.add(g);
        }
        // Monotonic, so a stale ticket can never match again by wrapping.
        expect([...seen]).toEqual([...seen].sort((a, b) => a - b));
    });

    it("keeps two channels independent", () => {
        const mic = newCaptureLifecycle();
        const camera = newCaptureLifecycle();
        const micTicket = beginCapture(mic);
        beginCapture(camera);
        expect(isCaptureCurrent(mic, micTicket)).toBe(true);
    });
});

describe("cancelCapture", () => {
    it("makes an in-flight ticket stale without disposing", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        cancelCapture(state);
        expect(isCaptureCurrent(state, ticket)).toBe(false);
        expect(state.disposed).toBe(false);
    });

    it("still allows a later request", () => {
        const state = newCaptureLifecycle();
        cancelCapture(state);
        expect(isCaptureCurrent(state, beginCapture(state))).toBe(true);
    });
});

describe("disposeCaptures", () => {
    it("makes an in-flight ticket stale", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        disposeCaptures(state);
        expect(isCaptureCurrent(state, ticket)).toBe(false);
    });

    it("poisons the channel: a ticket issued after disposal is never current", () => {
        const state = newCaptureLifecycle();
        disposeCaptures(state);
        expect(isCaptureCurrent(state, beginCapture(state))).toBe(false);
    });

    it("is idempotent", () => {
        const state = newCaptureLifecycle();
        disposeCaptures(state);
        disposeCaptures(state);
        expect(state.disposed).toBe(true);
    });
});

describe("stopTracks", () => {
    it("stops every track and reports the count", () => {
        const stream = fakeStream(3);
        expect(stopTracks(stream)).toBe(3);
        expect(stream.stopped).toBe(3);
    });

    it("tolerates a missing stream", () => {
        expect(stopTracks(null)).toBe(0);
        expect(stopTracks(undefined)).toBe(0);
    });

    it("stops the remaining tracks when one throws", () => {
        let stopped = 0;
        const stream: TrackSource = {
            getTracks: () => [
                {
                    stop: () => {
                        throw new Error("already ended");
                    },
                },
                {
                    stop: () => {
                        stopped += 1;
                    },
                },
            ],
        };
        expect(stopTracks(stream)).toBe(1);
        expect(stopped).toBe(1);
    });

    it("tolerates a stream whose getTracks throws", () => {
        const stream = {
            getTracks: () => {
                throw new Error("detached");
            },
        } as unknown as TrackSource;
        expect(stopTracks(stream)).toBe(0);
    });
});

describe("stopHandle", () => {
    it("stops the handle", () => {
        const stop = vi.fn();
        expect(stopHandle({ stop })).toBe(true);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    it("tolerates a missing handle", () => {
        expect(stopHandle(null)).toBe(false);
        expect(stopHandle(undefined)).toBe(false);
    });

    it("reports false when stop throws", () => {
        expect(
            stopHandle({
                stop: () => {
                    throw new Error("nope");
                },
            }),
        ).toBe(false);
    });
});

describe("adoptCapture", () => {
    it("hands back a capture that is still wanted, without releasing it", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        const stream = fakeStream();
        expect(adoptCapture(state, ticket, stream, stopTracks)).toBe(stream);
        expect(stream.stopped).toBe(0);
    });

    it("releases a capture whose requester was destroyed", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        const stream = fakeStream();
        disposeCaptures(state);
        expect(adoptCapture(state, ticket, stream, stopTracks)).toBe(null);
        expect(stream.stopped).toBe(2);
    });

    it("releases a capture superseded by a newer request", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        beginCapture(state);
        const stream = fakeStream();
        expect(adoptCapture(state, ticket, stream, stopTracks)).toBe(null);
        expect(stream.stopped).toBe(2);
    });

    it("releases a stoppable handle through stopHandle", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        disposeCaptures(state);
        const handle: Stoppable = { stop: vi.fn() };
        expect(adoptCapture(state, ticket, handle, stopHandle)).toBe(null);
        expect(handle.stop).toHaveBeenCalledTimes(1);
    });

    it("returns null for a missing capture without calling release", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        const release = vi.fn();
        expect(adoptCapture(state, ticket, null, release)).toBe(null);
        expect(adoptCapture(state, ticket, undefined, release)).toBe(null);
        expect(release).not.toHaveBeenCalled();
    });

    it("still refuses the capture when release throws", () => {
        const state = newCaptureLifecycle();
        const ticket = beginCapture(state);
        disposeCaptures(state);
        expect(
            adoptCapture(state, ticket, fakeStream(), () => {
                throw new Error("stop failed");
            }),
        ).toBe(null);
    });
});
