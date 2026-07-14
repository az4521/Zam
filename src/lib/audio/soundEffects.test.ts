import { describe, it, expect } from "vitest";
import { SOUND_RECIPES } from "./soundEffects";

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
