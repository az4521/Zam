/**
 * Pure decision logic for the mid-call "the input device you are using has
 * gone away" notice. Kept free of any DOM/LiveKit import so it stays
 * unit-testable; `client.ts` does the enumerating and the toasting.
 *
 * Each kind is identified by the device id actually IN USE, which the caller
 * resolves — null means "nothing to lose": no device was chosen (we are on the
 * system default and the browser gives us no id to compare against), or, for
 * video, no camera is being published at all. A null id therefore never
 * produces a notice.
 */

export type VoiceInputKind = "audioinput" | "videoinput";

/** The two fields we need off a `MediaDeviceInfo`. */
export interface EnumeratedDevice {
    kind: string;
    deviceId: string;
}

export interface VoiceDeviceWatchInput {
    /** `enumerateDevices()` output, or **null** when that call failed. Null is
     *  "we do not know" and never produces a notice — an empty array is the
     *  genuine "nothing is plugged in" answer and does. */
    devices: EnumeratedDevice[] | null;
    /** Device id the call's microphone is using, or null. */
    audioInputId: string | null;
    /** Device id the call's camera is using, or null when it is not on. */
    videoInputId: string | null;
    /** Already warned about this kind during the current call. */
    audioNotified: boolean;
    videoNotified: boolean;
}

function isMissing(
    devices: EnumeratedDevice[],
    kind: VoiceInputKind,
    deviceId: string | null,
): boolean {
    if (!deviceId) return false;
    return !devices.some((d) => d.kind === kind && d.deviceId === deviceId);
}

/** Which kinds should raise a notice right now. Microphone first: it is the
 *  one that breaks the call rather than just the video. */
export function voiceDeviceNotices(
    input: VoiceDeviceWatchInput,
): VoiceInputKind[] {
    const { devices } = input;
    if (devices === null) return [];

    const notices: VoiceInputKind[] = [];
    if (
        !input.audioNotified &&
        isMissing(devices, "audioinput", input.audioInputId)
    )
        notices.push("audioinput");
    if (
        !input.videoNotified &&
        isMissing(devices, "videoinput", input.videoInputId)
    )
        notices.push("videoinput");
    return notices;
}
