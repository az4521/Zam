import { describe, it, expect } from "vitest";
import {
    compareRoomVersions,
    isRoomVersionAtLeast,
    getRoomUpgradeState,
} from "./roomUpgrade";

describe("compareRoomVersions", () => {
    it("orders newer over older by leading integer", () => {
        expect(compareRoomVersions("12", "11")).toBeGreaterThan(0);
        expect(compareRoomVersions("11", "12")).toBeLessThan(0);
    });
    it("returns 0 for equal versions", () => {
        expect(compareRoomVersions("12", "12")).toBe(0);
        expect(compareRoomVersions("org.x", "org.x")).toBe(0);
    });
    it("compares numerically, not lexically", () => {
        expect(compareRoomVersions("9", "10")).toBeLessThan(0);
    });
    it("returns null for incomparable, unequal versions", () => {
        expect(compareRoomVersions("org.matrix.mscX", "12")).toBeNull();
    });
});

describe("isRoomVersionAtLeast", () => {
    it("is true when equal or newer", () => {
        expect(isRoomVersionAtLeast("12", "12")).toBe(true);
        expect(isRoomVersionAtLeast("12", "11")).toBe(true);
    });
    it("is false when older", () => {
        expect(isRoomVersionAtLeast("11", "12")).toBe(false);
    });
    it("is false when incomparable and unequal", () => {
        expect(isRoomVersionAtLeast("org.x", "12")).toBe(false);
    });
    it("is true when incomparable but equal string", () => {
        expect(isRoomVersionAtLeast("org.x", "org.x")).toBe(true);
    });
});

describe("getRoomUpgradeState", () => {
    const base = { availableVersions: ["1", "11", "12"] };

    it("offers upgrade when below default and powered", () => {
        const s = getRoomUpgradeState({
            ...base,
            currentVersion: "11",
            defaultVersion: "12",
            myPowerLevel: 100,
            tombstonePowerLevel: 50,
        });
        expect(s).toEqual({
            available: true,
            reason: "",
            recommendedVersion: "12",
            isCurrentLatest: false,
        });
    });

    it("reports latest when already on default", () => {
        const s = getRoomUpgradeState({
            ...base,
            currentVersion: "12",
            defaultVersion: "12",
            myPowerLevel: 100,
            tombstonePowerLevel: 50,
        });
        expect(s.available).toBe(false);
        expect(s.isCurrentLatest).toBe(true);
        expect(s.reason).toContain("latest");
        expect(s.reason).toContain("v12");
    });

    it("blocks on insufficient power but still targets the recommended version", () => {
        const s = getRoomUpgradeState({
            ...base,
            currentVersion: "11",
            defaultVersion: "12",
            myPowerLevel: 0,
            tombstonePowerLevel: 50,
        });
        expect(s.available).toBe(false);
        expect(s.isCurrentLatest).toBe(false);
        expect(s.reason).toContain("permission");
        expect(s.recommendedVersion).toBe("12");
    });

    it("never offers a downgrade when the room is newer than the default", () => {
        const s = getRoomUpgradeState({
            ...base,
            currentVersion: "12",
            defaultVersion: "11",
            myPowerLevel: 100,
            tombstonePowerLevel: 50,
        });
        expect(s.isCurrentLatest).toBe(true);
        expect(s.available).toBe(false);
    });

    it("falls back to current version when server advertises no default", () => {
        const s = getRoomUpgradeState({
            availableVersions: [],
            currentVersion: "10",
            defaultVersion: "",
            myPowerLevel: 100,
            tombstonePowerLevel: 50,
        });
        expect(s.recommendedVersion).toBe("10");
        expect(s.isCurrentLatest).toBe(true);
        expect(s.available).toBe(false);
    });

    it("treats equal power as sufficient (inclusive)", () => {
        const s = getRoomUpgradeState({
            ...base,
            currentVersion: "11",
            defaultVersion: "12",
            myPowerLevel: 50,
            tombstonePowerLevel: 50,
        });
        expect(s.available).toBe(true);
    });
});
