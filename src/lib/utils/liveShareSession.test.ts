import { describe, it, expect } from "vitest";
import { ownsSession, adoptInheritedStop } from "./liveShareSession";
import { STOP_FAILED_MESSAGE, type StopState } from "./liveShareStop";

describe("ownsSession", () => {
    it("owns the session it started in", () => {
        expect(ownsSession(3, 3)).toBe(true);
    });

    it("loses ownership once a newer session begins", () => {
        expect(ownsSession(3, 4)).toBe(false);
    });

    it("does not own a session older than its own", () => {
        // Cannot happen today (the counter only goes up), but "equal" is the
        // rule — anything else must be refused rather than assumed safe.
        expect(ownsSession(4, 3)).toBe(false);
    });
});

describe("adoptInheritedStop", () => {
    it("leaves a healthy share alone", () => {
        expect(adoptInheritedStop(null)).toBeNull();
    });

    it("demotes an in-flight stop to failed so the next session can retry it", () => {
        // "stopping" disables Stop (decideStop reads it as in-flight). The write
        // it refers to belongs to a client this session cannot watch settle, so
        // leaving the phase alone would strand a dead button until the beacon
        // expired.
        expect(adoptInheritedStop({ phase: "stopping", error: null })).toEqual({
            phase: "failed",
            error: STOP_FAILED_MESSAGE,
        });
    });

    it("keeps an already-failed stop exactly as it was", () => {
        const stop: StopState = { phase: "failed", error: "custom copy" };
        expect(adoptInheritedStop(stop)).toBe(stop);
    });

    it("does not mutate the record it was handed", () => {
        // The inherited object is aliased by the store's $state map and by
        // whatever previous-session continuation still holds a reference to it.
        const stop: StopState = { phase: "stopping", error: null };
        adoptInheritedStop(stop);
        expect(stop).toEqual({ phase: "stopping", error: null });
    });
});
