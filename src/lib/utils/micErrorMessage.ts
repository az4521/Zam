/**
 * Actionable text for a microphone failure at call join (audit IMP-5).
 * getUserMedia rejects with a DOMException whose raw message ("Permission
 * denied", "Requested device not found") tells the user nothing about what to
 * do. Returns null for anything that is not a recognised microphone failure,
 * so the caller falls back to its generic error text.
 */
export function micErrorMessage(err: unknown): string | null {
    if (!(err instanceof DOMException)) return null;
    switch (err.name) {
        case "NotAllowedError":
        case "SecurityError":
            return "Microphone access is blocked - allow it in your browser or system settings to join the call";
        case "NotFoundError":
        case "OverconstrainedError":
            return "No microphone found - connect one or pick another input device to join the call";
        case "NotReadableError":
            return "Could not open your microphone - another app may be using it";
        default:
            return null;
    }
}
