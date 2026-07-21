import { describe, it, expect } from "vitest";
import {
    CREATOR_POWER_LEVEL,
    effectivePowerLevel,
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
});
