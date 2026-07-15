import { describe, it, expect } from "vitest";
import {
    SOUND_RECIPES,
    RING_PATTERN,
    RING_BLIP_PATTERN,
    RING_MAX_MS,
    startRingtone,
    playRingBlip,
    configureRing,
} from "./soundEffects";

const ALL_NAMES = [
    "selfJoin",
    "selfLeave",
    "peerJoin",
    "peerLeave",
    "mute",
    "unmute",
    "deafen",
    "undeafen",
    "error",
] as const;

describe("SOUND_RECIPES", () => {
    it("defines every call sound", () => {
        for (const name of ALL_NAMES) {
            expect(SOUND_RECIPES[name]?.length, name).toBeGreaterThan(0);
        }
    });
    it("keeps segments short, audible, and in range", () => {
        for (const [name, segments] of Object.entries(SOUND_RECIPES)) {
            for (const seg of segments) {
                expect(seg.duration, name).toBeGreaterThan(0);
                expect(seg.at, name).toBeGreaterThanOrEqual(0);
                expect(seg.at + seg.duration, name).toBeLessThanOrEqual(0.5);
                expect(seg.from, name).toBeGreaterThanOrEqual(100);
                expect(seg.from, name).toBeLessThanOrEqual(2000);
                expect(seg.to, name).toBeGreaterThanOrEqual(100);
                expect(seg.to, name).toBeLessThanOrEqual(2000);
                expect(seg.peak, name).toBeGreaterThan(0);
                expect(seg.peak, name).toBeLessThanOrEqual(1);
            }
        }
    });
});

const inRange = (
    segments: typeof RING_PATTERN,
    maxEnd: number,
    label: string,
) => {
    for (const seg of segments) {
        expect(seg.duration, label).toBeGreaterThan(0);
        expect(seg.at, label).toBeGreaterThanOrEqual(0);
        expect(seg.at + seg.duration, label).toBeLessThanOrEqual(maxEnd);
        expect(seg.from, label).toBeGreaterThanOrEqual(100);
        expect(seg.from, label).toBeLessThanOrEqual(2000);
        expect(seg.to, label).toBeGreaterThanOrEqual(100);
        expect(seg.to, label).toBeLessThanOrEqual(2000);
        expect(seg.peak, label).toBeGreaterThan(0);
        expect(seg.peak, label).toBeLessThanOrEqual(1);
    }
};

describe("ring patterns", () => {
    it("defines a ring and a blip", () => {
        expect(RING_PATTERN.length).toBeGreaterThan(0);
        expect(RING_BLIP_PATTERN.length).toBeGreaterThan(0);
    });
    it("keeps the ring cycle inside its 2s slot, audible and in range", () => {
        inRange(RING_PATTERN, 2, "RING_PATTERN");
    });
    it("keeps the blip short, audible and in range", () => {
        inRange(RING_BLIP_PATTERN, 0.5, "RING_BLIP_PATTERN");
    });
    it("caps the ring at ten seconds", () => {
        expect(RING_MAX_MS).toBe(10000);
    });
});

describe("ringtone handle", () => {
    // jsdom has no AudioContext: the engine must degrade silently rather
    // than throw, and the handle contract must hold either way.
    it("returns a stoppable handle without an AudioContext", () => {
        const handle = startRingtone();
        expect(handle).toBeDefined();
        expect(() => handle.stop()).not.toThrow();
    });
    it("tolerates stop() being called twice", () => {
        const handle = startRingtone();
        handle.stop();
        expect(() => handle.stop()).not.toThrow();
    });
    it("does not throw on blip or configure without an AudioContext", () => {
        expect(() => playRingBlip()).not.toThrow();
        expect(() =>
            configureRing({ enabled: false, volume: 0.5 }),
        ).not.toThrow();
        configureRing({ enabled: true, volume: 1 });
    });
});
