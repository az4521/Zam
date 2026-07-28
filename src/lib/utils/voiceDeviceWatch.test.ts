import { describe, it, expect } from "vitest";
import { voiceDeviceNotices } from "./voiceDeviceWatch";
import type { EnumeratedDevice } from "./voiceDeviceWatch";

const MIC = "mic-a";
const CAM = "cam-a";

const devices = (...ids: Array<[string, string]>): EnumeratedDevice[] =>
    ids.map(([kind, deviceId]) => ({ kind, deviceId }));

const bothPresent = devices(
    ["audioinput", MIC],
    ["videoinput", CAM],
    ["audiooutput", "spk-a"],
);

const base = {
    devices: bothPresent,
    audioInputId: MIC,
    videoInputId: CAM,
    audioNotified: false,
    videoNotified: false,
};

describe("voiceDeviceNotices", () => {
    it("is silent while both devices in use are still enumerated", () => {
        expect(voiceDeviceNotices(base)).toEqual([]);
    });

    it("reports the microphone when its audioinput is gone", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                devices: devices(["videoinput", CAM]),
            }),
        ).toEqual(["audioinput"]);
    });

    it("reports the camera when its videoinput is gone", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                devices: devices(["audioinput", MIC]),
            }),
        ).toEqual(["videoinput"]);
    });

    it("reports both, microphone first, when the whole dock is unplugged", () => {
        expect(voiceDeviceNotices({ ...base, devices: [] })).toEqual([
            "audioinput",
            "videoinput",
        ]);
    });

    it("stays silent when enumeration itself failed (devices === null)", () => {
        // The old code caught enumerateDevices() into [] and then read that as
        // "the device is gone", so a permissions/transient failure toasted a
        // phantom unplug. null means "we do not know" and must never notify.
        expect(voiceDeviceNotices({ ...base, devices: null })).toEqual([]);
    });

    it("ignores video when the camera is off (null id)", () => {
        expect(
            voiceDeviceNotices({ ...base, videoInputId: null, devices: [] }),
        ).toEqual(["audioinput"]);
    });

    it("says nothing about a kind with no id to compare (system default)", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                audioInputId: null,
                videoInputId: null,
                devices: [],
            }),
        ).toEqual([]);
    });

    it("treats an empty-string id as no id", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                audioInputId: "",
                videoInputId: "",
                devices: [],
            }),
        ).toEqual([]);
    });

    it("suppresses a kind that already notified this call", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                devices: [],
                audioNotified: true,
            }),
        ).toEqual(["videoinput"]);
        expect(
            voiceDeviceNotices({
                ...base,
                devices: [],
                videoNotified: true,
            }),
        ).toEqual(["audioinput"]);
        expect(
            voiceDeviceNotices({
                ...base,
                devices: [],
                audioNotified: true,
                videoNotified: true,
            }),
        ).toEqual([]);
    });

    it("matches on kind as well as id, so a same-id output is not a mic", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                videoInputId: null,
                devices: devices(["audiooutput", MIC]),
            }),
        ).toEqual(["audioinput"]);
    });

    it("is silent when the camera substituted a different, present device", () => {
        // setCameraEnabled passes deviceId as a NON-exact constraint, so the
        // browser may hand back another camera. The caller resolves the id off
        // the live publication for exactly this reason — comparing the saved
        // setting instead would toast a phantom unplug here.
        expect(
            voiceDeviceNotices({
                ...base,
                videoInputId: "cam-substituted",
                devices: devices(
                    ["audioinput", MIC],
                    ["videoinput", "cam-substituted"],
                ),
            }),
        ).toEqual([]);
    });
});
