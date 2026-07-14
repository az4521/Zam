/**
 * Thin browser glue over navigator.mediaDevices. Pure decisions about the
 * resulting lists live in $lib/utils/audioDevices.
 */

export interface RawDevice {
    deviceId: string;
    kind: MediaDeviceKind;
    label: string;
}

export async function listMediaDevices(): Promise<RawDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.map((d) => ({
            deviceId: d.deviceId,
            kind: d.kind,
            label: d.label,
        }));
    } catch {
        return [];
    }
}

export function onDevicesChanged(cb: () => void): () => void {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return () => {};
    md.addEventListener("devicechange", cb);
    return () => md.removeEventListener("devicechange", cb);
}

export function canSetAudioSink(): boolean {
    return (
        typeof HTMLMediaElement !== "undefined" &&
        "setSinkId" in HTMLMediaElement.prototype
    );
}

export function canSelectAudioOutput(): boolean {
    const md = navigator.mediaDevices as MediaDevices & {
        selectAudioOutput?: unknown;
    };
    return typeof md?.selectAudioOutput === "function";
}

/** Firefox path: the browser-native output picker. Null when dismissed. */
export async function promptSelectAudioOutput(): Promise<RawDevice | null> {
    const md = navigator.mediaDevices as MediaDevices & {
        selectAudioOutput?: () => Promise<MediaDeviceInfo>;
    };
    if (typeof md?.selectAudioOutput !== "function") return null;
    try {
        const d = await md.selectAudioOutput();
        return { deviceId: d.deviceId, kind: d.kind, label: d.label };
    } catch {
        return null;
    }
}
