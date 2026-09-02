import { describe, it, expect } from "vitest";
import {
    toDeviceOptions,
    resolveDeviceId,
    outputPickerMode,
    buildDeviceConstraint,
    isOverconstrainedError,
} from "./audioDevices";

const dev = (deviceId: string, kind: string, label = "") => ({
    deviceId,
    kind,
    label,
});

describe("toDeviceOptions", () => {
    it("filters by kind and skips virtual/empty-id devices", () => {
        const list = [
            dev("default", "audioinput", "Default - Mic"),
            dev("communications", "audioinput", "Communications - Mic"),
            dev("", "audioinput", "blocked"),
            dev("m1", "audioinput", "USB Mic"),
            dev("s1", "audiooutput", "Speakers"),
        ];
        expect(toDeviceOptions(list, "audioinput")).toEqual([
            { id: "m1", label: "USB Mic" },
        ]);
    });
    it("falls back to numbered kind labels when labels are empty", () => {
        const list = [
            dev("a", "audiooutput"),
            dev("b", "audiooutput"),
            dev("c", "videoinput"),
        ];
        expect(toDeviceOptions(list, "audiooutput")).toEqual([
            { id: "a", label: "Speaker 1" },
            { id: "b", label: "Speaker 2" },
        ]);
        expect(toDeviceOptions(list, "videoinput")).toEqual([
            { id: "c", label: "Camera 1" },
        ]);
    });
    it("sorts options alphabetically, case-insensitively", () => {
        const list = [
            dev("z", "audioinput", "Zoom Mic"),
            dev("a", "audioinput", "apple mic"),
            dev("b", "audioinput", "Blue Yeti"),
        ];
        expect(toDeviceOptions(list, "audioinput").map((o) => o.label)).toEqual(
            ["apple mic", "Blue Yeti", "Zoom Mic"],
        );
    });
    it("sorts numerically, not lexically (Device 2 before Device 10)", () => {
        const list = [
            dev("d10", "audioinput", "Device 10"),
            dev("d2", "audioinput", "Device 2"),
            dev("d1", "audioinput", "Device 1"),
        ];
        expect(toDeviceOptions(list, "audioinput").map((o) => o.label)).toEqual(
            ["Device 1", "Device 2", "Device 10"],
        );
    });
    it("is stable for equal labels (keeps enumeration order)", () => {
        const list = [
            dev("first", "audioinput", "Same Mic"),
            dev("second", "audioinput", "Same Mic"),
            dev("third", "audioinput", "Same Mic"),
        ];
        expect(toDeviceOptions(list, "audioinput").map((o) => o.id)).toEqual([
            "first",
            "second",
            "third",
        ]);
    });
    it("sorts generated numbered labels naturally (Microphone 2 before Microphone 10)", () => {
        const list = Array.from({ length: 10 }, (_, i) =>
            dev(`m${i}`, "audioinput"),
        );
        expect(toDeviceOptions(list, "audioinput").map((o) => o.label)).toEqual(
            [
                "Microphone 1",
                "Microphone 2",
                "Microphone 3",
                "Microphone 4",
                "Microphone 5",
                "Microphone 6",
                "Microphone 7",
                "Microphone 8",
                "Microphone 9",
                "Microphone 10",
            ],
        );
    });
});

describe("resolveDeviceId", () => {
    const available = [{ id: "m1", label: "USB Mic" }];
    it("null preference means default, no fallback", () => {
        expect(resolveDeviceId(null, available)).toEqual({
            id: null,
            usedFallback: false,
        });
    });
    it("returns the saved device when present", () => {
        expect(resolveDeviceId("m1", available)).toEqual({
            id: "m1",
            usedFallback: false,
        });
    });
    it("falls back to default when the saved device is gone", () => {
        expect(resolveDeviceId("gone", available)).toEqual({
            id: null,
            usedFallback: true,
        });
    });
});

describe("outputPickerMode", () => {
    it("hidden without setSinkId (Android)", () => {
        expect(
            outputPickerMode({
                canSetSink: false,
                hasOutputs: true,
                canSelectAudioOutput: false,
            }),
        ).toBe("hidden");
    });
    it("full picker when outputs are enumerable (Chromium)", () => {
        expect(
            outputPickerMode({
                canSetSink: true,
                hasOutputs: true,
                canSelectAudioOutput: false,
            }),
        ).toBe("picker");
    });
    it("browser prompt when only selectAudioOutput can reveal outputs (Firefox)", () => {
        expect(
            outputPickerMode({
                canSetSink: true,
                hasOutputs: false,
                canSelectAudioOutput: true,
            }),
        ).toBe("browser-prompt");
    });
    it("hidden when nothing can enumerate outputs", () => {
        expect(
            outputPickerMode({
                canSetSink: true,
                hasOutputs: false,
                canSelectAudioOutput: false,
            }),
        ).toBe("hidden");
    });
});

describe("buildDeviceConstraint", () => {
    it("uses `exact` so the browser honors the chosen device", () => {
        expect(buildDeviceConstraint("mic-1")).toEqual({ exact: "mic-1" });
    });
    it("returns undefined for the default (null) device", () => {
        expect(buildDeviceConstraint(null)).toBeUndefined();
    });
    it("returns undefined for an empty id", () => {
        expect(buildDeviceConstraint("")).toBeUndefined();
    });
    it("returns undefined for an absent id", () => {
        expect(buildDeviceConstraint(undefined)).toBeUndefined();
    });
});

describe("isOverconstrainedError", () => {
    it("true for a getUserMedia OverconstrainedError (device vanished)", () => {
        const e = new Error("device gone");
        e.name = "OverconstrainedError";
        expect(isOverconstrainedError(e)).toBe(true);
    });
    it("false for a permission denial (NotAllowedError)", () => {
        const e = new Error("denied");
        e.name = "NotAllowedError";
        expect(isOverconstrainedError(e)).toBe(false);
    });
    it("false for non-error values", () => {
        expect(isOverconstrainedError(null)).toBe(false);
        expect(isOverconstrainedError(undefined)).toBe(false);
        expect(isOverconstrainedError("OverconstrainedError")).toBe(false);
    });
});
