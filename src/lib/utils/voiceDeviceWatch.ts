/**
 * Pure decision logic for the mid-call "the input device you chose has gone
 * away" notice. Kept free of any DOM/LiveKit import so it stays unit-testable;
 * `client.ts` does the enumerating and the toasting.
 *
 * Only a device the user explicitly PICKED can be detected as missing — when
 * the setting is null we are on the system default, and the browser gives us
 * no id to compare against. The camera is additionally gated on the call
 * actually publishing video, so unplugging a webcam during a voice-only call
 * stays silent.
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
    savedAudioInputId: string | null;
    savedVideoInputId: string | null;
    /** Whether the local participant is publishing camera video right now. */
    cameraOn: boolean;
    /** Already warned about this kind during the current call. */
    audioNotified: boolean;
    videoNotified: boolean;
}

function isMissing(
    devices: EnumeratedDevice[],
    kind: VoiceInputKind,
    savedDeviceId: string | null,
): boolean {
    if (!savedDeviceId) return false;
    return !devices.some(
        (d) => d.kind === kind && d.deviceId === savedDeviceId,
    );
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
        isMissing(devices, "audioinput", input.savedAudioInputId)
    )
        notices.push("audioinput");
    if (
        input.cameraOn &&
        !input.videoNotified &&
        isMissing(devices, "videoinput", input.savedVideoInputId)
    )
        notices.push("videoinput");
    return notices;
}
