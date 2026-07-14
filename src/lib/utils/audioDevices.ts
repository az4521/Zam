/**
 * Pure device-list logic for the Voice & Audio settings tab. Browser API
 * access (enumerateDevices etc.) lives in $lib/audio/devices; this module
 * stays testable.
 */

export interface DeviceOption {
    id: string;
    label: string;
}

const KIND_LABELS: Record<string, string> = {
    audioinput: "Microphone",
    audiooutput: "Speaker",
    videoinput: "Camera",
};

// Windows Chromium exposes virtual "default"/"communications" entries; the
// UI's explicit "Default" option covers those, so hide them from the list.
const VIRTUAL_IDS = new Set(["default", "communications"]);

export function toDeviceOptions(
    devices: { deviceId: string; kind: string; label: string }[],
    kind: "audioinput" | "audiooutput" | "videoinput",
): DeviceOption[] {
    const result: DeviceOption[] = [];
    for (const d of devices) {
        if (d.kind !== kind) continue;
        if (!d.deviceId || VIRTUAL_IDS.has(d.deviceId)) continue;
        result.push({
            id: d.deviceId,
            label: d.label || `${KIND_LABELS[kind]} ${result.length + 1}`,
        });
    }
    return result;
}

export interface ResolvedDevice {
    id: string | null;
    usedFallback: boolean;
}

/**
 * Saved device ids are preferences, not bindings: a missing device resolves
 * to the default (null) WITHOUT erasing the preference.
 */
export function resolveDeviceId(
    saved: string | null,
    available: DeviceOption[],
): ResolvedDevice {
    if (saved === null) return { id: null, usedFallback: false };
    if (available.some((d) => d.id === saved))
        return { id: saved, usedFallback: false };
    return { id: null, usedFallback: true };
}

export type OutputPickerMode = "picker" | "browser-prompt" | "hidden";

/** Platform gate for the output-device picker (see spec's setSinkId matrix). */
export function outputPickerMode(input: {
    canSetSink: boolean;
    hasOutputs: boolean;
    canSelectAudioOutput: boolean;
}): OutputPickerMode {
    if (!input.canSetSink) return "hidden";
    if (input.hasOutputs) return "picker";
    if (input.canSelectAudioOutput) return "browser-prompt";
    return "hidden";
}
