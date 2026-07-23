import { describe, it, expect } from "vitest";
import {
    CREATOR_POWER_LEVEL,
    coercePl,
    effectivePowerLevel,
    normalizePowerLevels,
    parsePowerLevelInput,
    roomVersionHasImmutableCreators,
} from "./powerLevels";

describe("CREATOR_POWER_LEVEL", () => {
    it("is the admin ceiling of 100", () => {
        expect(CREATOR_POWER_LEVEL).toBe(100);
    });
});

describe("roomVersionHasImmutableCreators", () => {
    it("is true for room version 12", () => {
        expect(roomVersionHasImmutableCreators("12")).toBe(true);
    });
    it("is false for older versions and empty input", () => {
        expect(roomVersionHasImmutableCreators("11")).toBe(false);
        expect(roomVersionHasImmutableCreators("10")).toBe(false);
        expect(roomVersionHasImmutableCreators("")).toBe(false);
    });
});

describe("effectivePowerLevel", () => {
    it("lifts an immutable-room creator to the sentinel when their raw level is lower", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: 0,
                isCreator: true,
                immutableCreators: true,
            }),
        ).toBe(100);
    });

    it("preserves a raw level already above the sentinel for a creator", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: 150,
                isCreator: true,
                immutableCreators: true,
            }),
        ).toBe(150);
    });

    it("does not lift a creator when the room version is not immutable-creator", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: 0,
                isCreator: true,
                immutableCreators: false,
            }),
        ).toBe(0);
    });

    it("does not lift a non-creator in an immutable-creator room", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: 50,
                isCreator: false,
                immutableCreators: true,
            }),
        ).toBe(50);
    });

    // matrix-js-sdk 41 reports a v12 creator's RoomMember.powerLevel as NaN.
    // NaN is not caught by `?? 0` and Math.max(NaN, 100) === NaN, which would
    // fail every gate — the exact bug live testing surfaced.
    it("lifts a creator whose raw level is NaN (the live SDK case)", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: NaN,
                isCreator: true,
                immutableCreators: true,
            }),
        ).toBe(100);
    });

    it("treats a non-finite raw level as 0 for a non-creator", () => {
        expect(
            effectivePowerLevel({
                rawPowerLevel: NaN,
                isCreator: false,
                immutableCreators: true,
            }),
        ).toBe(0);
    });
});

describe("coercePl — spec-tolerant power-level read", () => {
    it("coerces numeric strings (pre-v10 rooms), rejects junk to default", () => {
        expect(coercePl(50, 0)).toBe(50);
        expect(coercePl("75", 0)).toBe(75);
        expect(coercePl("abc", 25)).toBe(25);
        expect(coercePl(undefined, 0)).toBe(0);
        expect(coercePl(null, 50)).toBe(50);
    });

    it("passes finite numbers (including 0 and negatives) through", () => {
        expect(coercePl(0, 50)).toBe(0);
        expect(coercePl(-1, 50)).toBe(-1);
        expect(coercePl(100, 0)).toBe(100);
    });

    it("rejects non-finite numbers and blank/whitespace strings to the default", () => {
        expect(coercePl(NaN, 42)).toBe(42);
        expect(coercePl(Infinity, 42)).toBe(42);
        expect(coercePl("", 42)).toBe(42);
        expect(coercePl("   ", 42)).toBe(42);
        expect(coercePl({}, 42)).toBe(42);
        expect(coercePl([], 42)).toBe(42);
    });
});

describe("normalizePowerLevels", () => {
    it("returns the no-event defaults when content is absent: creator 100, everyone else 0, all action levels 0", () => {
        expect(normalizePowerLevels(null, "@creator:hs")).toEqual({
            ban: 0,
            kick: 0,
            redact: 0,
            invite: 0,
            events_default: 0,
            state_default: 0,
            users_default: 0,
            events: {},
            users: { "@creator:hs": 100 },
        });
    });

    it("omits the creator entry when there is no creator id and no event", () => {
        expect(normalizePowerLevels(null, null).users).toEqual({});
    });

    it("applies the per-field spec defaults for an empty-but-present event", () => {
        // An event that exists but sets no fields: spec per-field defaults apply
        // (ban/kick/redact/state_default 50, events_default/users_default/invite 0).
        expect(normalizePowerLevels({}, "@creator:hs")).toEqual({
            ban: 50,
            kick: 50,
            redact: 50,
            invite: 0,
            events_default: 0,
            state_default: 50,
            users_default: 0,
            events: {},
            users: {},
        });
    });

    it("defaults invite to 0 (spec v1.4), not 50, when the event omits it", () => {
        expect(normalizePowerLevels({ ban: 60 }, null).invite).toBe(0);
    });

    it("coerces pre-v10 numeric-string scalar levels", () => {
        const pl = normalizePowerLevels(
            { ban: "60", kick: "40", invite: "10" },
            null,
        );
        expect(pl.ban).toBe(60);
        expect(pl.kick).toBe(40);
        expect(pl.invite).toBe(10);
    });

    it("passes through explicit numeric levels and preserves the users/events maps", () => {
        const pl = normalizePowerLevels(
            {
                ban: 70,
                events_default: 5,
                users: { "@admin:hs": 100 },
                events: { "m.room.name": 50 },
            },
            "@creator:hs",
        );
        expect(pl.ban).toBe(70);
        expect(pl.events_default).toBe(5);
        expect(pl.users).toEqual({ "@admin:hs": 100 });
        expect(pl.events).toEqual({ "m.room.name": 50 });
    });
});

describe("parsePowerLevelInput", () => {
    it("accepts a whole number at or below the ceiling", () => {
        expect(parsePowerLevelInput("40", 100)).toEqual({
            ok: true,
            value: 40,
            error: "",
        });
        expect(parsePowerLevelInput("0", 50)).toEqual({
            ok: true,
            value: 0,
            error: "",
        });
    });
    it("accepts the ceiling itself (inclusive)", () => {
        expect(parsePowerLevelInput("100", 100)).toEqual({
            ok: true,
            value: 100,
            error: "",
        });
    });
    it("trims surrounding whitespace", () => {
        expect(parsePowerLevelInput(" 40 ", 100)).toEqual({
            ok: true,
            value: 40,
            error: "",
        });
    });
    it("rejects a value above the ceiling, naming the ceiling", () => {
        const r = parsePowerLevelInput("101", 100);
        expect(r.ok).toBe(false);
        expect(r.value).toBeNull();
        expect(r.error).toContain("(100)");
        const r2 = parsePowerLevelInput("75", 50);
        expect(r2.ok).toBe(false);
        expect(r2.error).toContain("(50)");
    });
    it("rejects negatives", () => {
        const r = parsePowerLevelInput("-1", 100);
        expect(r.ok).toBe(false);
        expect(r.value).toBeNull();
        expect(r.error).toBe("Must be 0 or higher");
    });
    it("rejects non-integers (float, hex, text)", () => {
        for (const bad of ["3.5", "0x10", "abc"]) {
            const r = parsePowerLevelInput(bad, 100);
            expect(r.ok).toBe(false);
            expect(r.value).toBeNull();
            expect(r.error).toBe("Must be a whole number");
        }
    });
    it("rejects blank input", () => {
        for (const blank of ["", "   "]) {
            const r = parsePowerLevelInput(blank, 100);
            expect(r.ok).toBe(false);
            expect(r.value).toBeNull();
            expect(r.error).toBe("Enter a power level");
        }
    });
});
