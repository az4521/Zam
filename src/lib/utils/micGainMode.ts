/**
 * Which automatic gain control evens out the user's own microphone:
 *  - "normalize": the normalization incoming voices get, applied to your own
 *    mic in Zam's mic chain. The default.
 *  - "zam": WebRTC's AGC2 in Zam's mic chain ($lib/audio/agc2, run as a
 *    LiveKit processor). Digital gain only; never touches the OS microphone
 *    volume.
 *  - "browser": the browser's getUserMedia `autoGainControl` (WebRTC's AGC in
 *    Chromium/Electron/Android, which can also move the OS mic volume).
 *  - "off": neither.
 */
export type MicGainMode = "normalize" | "zam" | "browser" | "off";

/** Stored value, else the legacy `autoGainControl` boolean: on maps to
 *  normalization, off stays off. */
export function normalizeMicGainMode(
    stored: string | null,
    legacyAutoGainControl: boolean,
): MicGainMode {
    if (
        stored === "normalize" ||
        stored === "zam" ||
        stored === "browser" ||
        stored === "off"
    )
        return stored;
    return legacyAutoGainControl ? "normalize" : "off";
}

/** The getUserMedia `autoGainControl` constraint for a mode. Off for Zam's
 *  AGC too: stacking two AGCs makes them fight. */
export function browserAgcFor(mode: MicGainMode): boolean {
    return mode === "browser";
}
