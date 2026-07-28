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
    savedAudioInputId: MIC,
    savedVideoInputId: CAM,
    cameraOn: true,
    audioNotified: false,
    videoNotified: false,
};

describe("voiceDeviceNotices", () => {
    it("is silent while both chosen devices are still enumerated", () => {
        expect(voiceDeviceNotices(base)).toEqual([]);
    });

    it("reports the microphone when the chosen audioinput is gone", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                devices: devices(["videoinput", CAM]),
            }),
        ).toEqual(["audioinput"]);
    });

    it("reports the camera when the chosen videoinput is gone", () => {
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

    it("ignores a missing camera while the camera is off", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                cameraOn: false,
                devices: devices(["audioinput", MIC]),
            }),
        ).toEqual([]);
    });

    it("still reports the microphone while the camera is off", () => {
        expect(
            voiceDeviceNotices({ ...base, cameraOn: false, devices: [] }),
        ).toEqual(["audioinput"]);
    });

    it("says nothing about a kind the user never chose", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                savedAudioInputId: null,
                savedVideoInputId: null,
                devices: [],
            }),
        ).toEqual([]);
    });

    it("treats an empty-string saved id as no choice", () => {
        expect(
            voiceDeviceNotices({
                ...base,
                savedAudioInputId: "",
                savedVideoInputId: "",
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
                savedVideoInputId: null,
                devices: devices(["audiooutput", MIC]),
            }),
        ).toEqual(["audioinput"]);
    });
});
