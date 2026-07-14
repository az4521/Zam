import { describe, it, expect } from "vitest";
import {
    INITIAL_SELF_SOUND_STATE,
    flagCallError,
    nextSelfSound,
    diffPeerSounds,
    soundGate,
} from "./callSounds";

describe("nextSelfSound", () => {
    it("plays selfJoin on first connect only", () => {
        const first = nextSelfSound("connected", INITIAL_SELF_SOUND_STATE);
        expect(first.sound).toBe("selfJoin");
        expect(first.state.connectedOnce).toBe(true);
        // reconnect cycle: reconnecting -> connected again is silent
        const re = nextSelfSound("connected", first.state);
        expect(re.sound).toBeNull();
    });
    it("plays selfLeave on teardown after a connected call", () => {
        const { state } = nextSelfSound("connected", INITIAL_SELF_SOUND_STATE);
        const left = nextSelfSound(null, state);
        expect(left.sound).toBe("selfLeave");
        expect(left.state).toEqual(INITIAL_SELF_SOUND_STATE);
    });
    it("plays error instead of selfLeave when the error flag is set", () => {
        let s = nextSelfSound("connected", INITIAL_SELF_SOUND_STATE).state;
        s = flagCallError(s);
        expect(nextSelfSound(null, s).sound).toBe("error");
    });
    it("is silent when a join fails before ever connecting", () => {
        const s = nextSelfSound("connecting", INITIAL_SELF_SOUND_STATE);
        expect(s.sound).toBeNull();
        expect(nextSelfSound(null, s.state).sound).toBeNull();
    });
    it("errors during the connect window still sound", () => {
        let s = nextSelfSound("connecting", INITIAL_SELF_SOUND_STATE).state;
        s = flagCallError(s);
        expect(nextSelfSound(null, s).sound).toBe("error");
    });
});

describe("diffPeerSounds", () => {
    const own = "@me:hs";
    it("initial snapshot (prev null) is silent", () => {
        expect(diffPeerSounds(null, ["@a:hs:D1"], own)).toEqual([]);
    });
    it("coalesces multiple joins into one peerJoin", () => {
        expect(diffPeerSounds([], ["@a:hs:D1", "@b:hs:D1"], own)).toEqual([
            "peerJoin",
        ]);
    });
    it("reports joins and leaves together", () => {
        expect(diffPeerSounds(["@a:hs:D1"], ["@b:hs:D1"], own)).toEqual([
            "peerJoin",
            "peerLeave",
        ]);
    });
    it("ignores own devices", () => {
        expect(diffPeerSounds([], ["@me:hs:D2"], own)).toEqual([]);
        expect(diffPeerSounds(["@me:hs:D2"], [], own)).toEqual([]);
    });
    it("no change, no sound", () => {
        expect(diffPeerSounds(["@a:hs:D1"], ["@a:hs:D1"], own)).toEqual([]);
    });
});

describe("soundGate", () => {
    it("allows the first play and blocks rapid repeats", () => {
        expect(soundGate(null, 1000)).toBe(true);
        expect(soundGate(1000, 1500)).toBe(false);
        expect(soundGate(1000, 2000)).toBe(true);
    });
    it("respects a custom gap", () => {
        expect(soundGate(0, 400, 500)).toBe(false);
        expect(soundGate(0, 500, 500)).toBe(true);
    });
});
