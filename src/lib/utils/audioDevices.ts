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
    // Numbered fallback labels are assigned above in enumeration order (so the
    // Nth unlabeled device stays "Microphone N"); sorting afterwards is a stable
    // sort keyed on the final label. numeric-aware so "Device 2" precedes
    // "Device 10"; base sensitivity so case never reorders siblings.
    return result.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
            numeric: true,
            sensitivity: "base",
        }),
    );
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

/**
 * Build the `deviceId` fragment for a getUserMedia track constraint. Uses
 * `exact`, NOT `ideal`: `ideal` is a soft hint the browser is free to ignore,
 * so a selected mic/camera silently falls back to the default device (the
 * meter watches the wrong mic, the camera preview never switches). `exact`
 * makes the browser honor the choice — at the cost of rejecting with
 * OverconstrainedError if the device vanished, so callers retry with default.
 * Returns undefined for the default device (null/empty id) → no deviceId added.
 */
export function buildDeviceConstraint(
    deviceId: string | null | undefined,
): { exact: string } | undefined {
    return deviceId ? { exact: deviceId } : undefined;
}

/**
 * True when a getUserMedia rejection is an OverconstrainedError — the browser
 * signalling that an `exact` deviceId could not be satisfied (the chosen device
 * vanished mid-session). Callers use this to retry once with the default device
 * rather than surfacing a misleading "permission" error. Any other rejection
 * (NotAllowedError, NotReadableError…) is NOT overconstrained and propagates.
 */
export function isOverconstrainedError(e: unknown): boolean {
    return (
        typeof e === "object" &&
        e !== null &&
        (e as { name?: string }).name === "OverconstrainedError"
    );
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
