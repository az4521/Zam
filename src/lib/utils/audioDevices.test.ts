import { describe, it, expect } from "vitest";
import {
    toDeviceOptions,
    resolveDeviceId,
    outputPickerMode,
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
