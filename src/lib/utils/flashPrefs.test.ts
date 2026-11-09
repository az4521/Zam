import { describe, it, expect, beforeEach } from "vitest";
import {
    clearSavedFlashSize,
    readSavedFlashSize,
    readSavedFlashVolume,
    writeSavedFlashSize,
    writeSavedFlashVolume,
} from "./flashPrefs";

describe("flashVolume", () => {
    beforeEach(() => localStorage.clear());

    it("reads nothing when no volume was saved", () => {
        expect(readSavedFlashVolume()).toBeNull();
    });

    it("round-trips a volume in [0, 1]", () => {
        writeSavedFlashVolume(0.25);
        expect(readSavedFlashVolume()).toBe(0.25);
        writeSavedFlashVolume(0);
        expect(readSavedFlashVolume()).toBe(0);
        writeSavedFlashVolume(1);
        expect(readSavedFlashVolume()).toBe(1);
    });

    it("refuses to write anything but a number in [0, 1]", () => {
        for (const bad of [-0.1, 1.5, NaN, Infinity, "0.5", null]) {
            writeSavedFlashVolume(bad);
        }
        expect(localStorage.getItem("settings:flashVolume")).toBeNull();
    });

    it("ignores a corrupt or out-of-range saved value", () => {
        for (const bad of ["not json", "7", '"0.5"', "-1", "null", "{}"]) {
            localStorage.setItem("settings:flashVolume", bad);
            expect(readSavedFlashVolume()).toBeNull();
        }
    });
});

describe("flashSize", () => {
    beforeEach(() => localStorage.clear());

    it("reads nothing when no size was saved", () => {
        expect(readSavedFlashSize()).toBeNull();
    });

    it("round-trips a positive size", () => {
        writeSavedFlashSize({ w: 640, h: 360 });
        expect(readSavedFlashSize()).toEqual({ w: 640, h: 360 });
    });

    it("refuses to write a non-positive or non-finite size", () => {
        writeSavedFlashSize({ w: 0, h: 360 });
        writeSavedFlashSize({ w: 640, h: -1 });
        writeSavedFlashSize({ w: NaN, h: 360 });
        expect(localStorage.getItem("settings:flashSize")).toBeNull();
    });

    it("ignores a corrupt or incomplete saved value", () => {
        for (const bad of [
            "not json",
            "null",
            "5",
            '{"w":640}',
            '{"w":"640","h":360}',
            '{"w":0,"h":360}',
        ]) {
            localStorage.setItem("settings:flashSize", bad);
            expect(readSavedFlashSize()).toBeNull();
        }
    });

    it("clears the saved size", () => {
        writeSavedFlashSize({ w: 640, h: 360 });
        clearSavedFlashSize();
        expect(readSavedFlashSize()).toBeNull();
    });
});
