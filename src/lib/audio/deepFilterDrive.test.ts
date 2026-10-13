import { describe, it, expect } from "vitest";
import {
    nextDriveLevel,
    driveGain,
    DRIVE_TARGET_DB,
    DRIVE_GATE_DB,
    DRIVE_MAX_GAIN,
    DRIVE_STEP_DB,
    nextDrive,
    undriveCurve,
} from "./deepFilterDrive";

describe("nextDriveLevel", () => {
    it("seeds from the first window above the gate", () => {
        expect(nextDriveLevel(null, -48)).toBe(-48);
    });
    it("ignores silence and mic self-noise below the gate", () => {
        expect(nextDriveLevel(null, DRIVE_GATE_DB - 1)).toBeNull();
        expect(nextDriveLevel(-45, -Infinity)).toBe(-45);
        expect(nextDriveLevel(-45, -80)).toBe(-45);
    });
    it("still hears speech too quiet for the normalization gate", () => {
        expect(nextDriveLevel(null, -60)).toBe(-60);
    });
    it("rises quickly and falls slowly", () => {
        const up = nextDriveLevel(-50, -30)! - -50;
        const down = -30 - nextDriveLevel(-30, -50)!;
        expect(up).toBeGreaterThan(down);
    });
});

describe("driveGain", () => {
    it("holds until something has been heard", () => {
        expect(driveGain(null)).toBeNull();
    });
    it("lifts quiet input to the target", () => {
        expect(20 * Math.log10(driveGain(-45)!)).toBeCloseTo(
            DRIVE_TARGET_DB - -45,
        );
    });
    it("never turns input down", () => {
        expect(driveGain(-10)).toBe(1);
        expect(driveGain(DRIVE_TARGET_DB)).toBeCloseTo(1);
    });
    it("caps the boost", () => {
        expect(driveGain(-69)).toBe(DRIVE_MAX_GAIN);
    });
});

describe("nextDrive", () => {
    it("stays put until the wanted drive is a full step away", () => {
        expect(nextDrive(1, null)).toBeNull();
        expect(nextDrive(4, 4 * 10 ** (2 / 20))).toBeNull();
        expect(nextDrive(4, 4 / 10 ** (2.9 / 20))).toBeNull();
    });
    it("moves all the way once it is", () => {
        const up = 4 * 10 ** (DRIVE_STEP_DB / 20);
        expect(nextDrive(4, up)).toBe(up);
        expect(nextDrive(4, 1)).toBe(1);
    });
});

describe("undriveCurve", () => {
    it("is the inverse of the drive ramp at every point", () => {
        const curve = undriveCurve(2, 20, 5);
        const ramp = [2, 6.5, 11, 15.5, 20];
        curve.forEach((v, i) => expect(v * ramp[i]).toBeCloseTo(1));
    });
});
