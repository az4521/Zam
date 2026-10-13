import { describe, it, expect } from "vitest";
import {
    createDriveState,
    driveTick,
    driveGain,
    DRIVE_TARGET_DB,
    DRIVE_GATE_DB,
    DRIVE_MAX_GAIN,
    DRIVE_STEP_DB,
    nextDrive,
    undriveCurve,
} from "./deepFilterDrive";

// Feed driveTick a sequence of 50 ms window levels; return the drive it
// settles on (moves applied at once, as the chain does after each glide).
function run(windows: number[], start = 1) {
    const state = createDriveState();
    let current = start;
    let moves = 0;
    for (const w of windows) {
        const next = driveTick(state, w, current);
        if (next !== null) {
            current = next;
            moves++;
        }
    }
    return { db: 20 * Math.log10(current), moves, state };
}
const repeat = (pattern: number[], times: number) =>
    Array.from({ length: times }, () => pattern).flat();
// 1 s of speech windows at `speech`, then 1 s of room noise at `noise`.
const talk = (speech: number, noise: number, seconds: number) =>
    repeat([...Array(20).fill(speech), ...Array(20).fill(noise)], seconds);

describe("driveTick", () => {
    it("leaves a normal mic alone", () => {
        expect(run(talk(-30, -55, 30)).db).toBe(0);
    });
    it("lifts a quiet mic towards the target and then holds", () => {
        const { db, moves } = run(talk(-48, -70, 60));
        expect(db).toBeGreaterThan(DRIVE_TARGET_DB - -48 - DRIVE_STEP_DB);
        expect(db).toBeLessThanOrEqual(DRIVE_TARGET_DB - -48 + 0.01);
        expect(moves).toBeLessThanOrEqual(2);
    });
    it("doesn't climb in pauses or long silences filled with room noise", () => {
        const speech = talk(-32, -55, 10);
        const silence = Array(20 * 20).fill(-55);
        expect(run([...speech, ...silence, ...speech]).db).toBe(0);
    });
    it("never treats room noise as speech, however long it lasts", () => {
        const { state, moves } = run(Array(2000).fill(-52));
        expect(state.speech).toBeNull();
        expect(moves).toBe(0);
    });
    it("ignores windows below the gate even in a silent room", () => {
        const { state } = run(talk(DRIVE_GATE_DB - 1, -90, 10));
        expect(state.speech).toBeNull();
    });
    it("pulls straight back when the model's input runs far over target", () => {
        // Driven up for a whisper, then the user talks normally.
        const quiet = run(talk(-55, -80, 20));
        expect(quiet.db).toBeGreaterThan(20);
        const state = quiet.state;
        const next = driveTick(state, -25, 10 ** (quiet.db / 20));
        expect(next).not.toBeNull();
        expect(20 * Math.log10(next!)).toBeLessThan(quiet.db);
    });
    it("is a no-op for silence", () => {
        expect(driveTick(createDriveState(), -Infinity, 1)).toBeNull();
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
