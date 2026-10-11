/**
 * Which automatic gain control evens out the user's own microphone:
 *  - "zam": Zam's leveller ($lib/audio/micChain, run as a LiveKit processor).
 *    Digital gain only; never touches the OS microphone volume.
 *  - "browser": the browser's getUserMedia `autoGainControl` (WebRTC's AGC in
 *    Chromium/Electron/Android, which can also move the OS mic volume).
 *  - "off": neither.
 */
export type MicGainMode = "zam" | "browser" | "off";

/** Stored value, else the legacy `autoGainControl` boolean: on maps to
 *  Zam's leveller, off stays off. */
export function normalizeMicGainMode(
    stored: string | null,
    legacyAutoGainControl: boolean,
): MicGainMode {
    if (stored === "zam" || stored === "browser" || stored === "off")
        return stored;
    return legacyAutoGainControl ? "zam" : "off";
}

/** The getUserMedia `autoGainControl` constraint for a mode. Off for Zam's
 *  leveller too: stacking two AGCs makes them fight. */
export function browserAgcFor(mode: MicGainMode): boolean {
    return mode === "browser";
}
