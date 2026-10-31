/**
 * Actionable text for a microphone failure at call join (audit IMP-5). The
 * call goes ahead without the mic; this says why and how to get it back.
 * getUserMedia rejects with a DOMException whose raw message ("Permission
 * denied", "Requested device not found") tells the user nothing about what to
 * do. Returns null for anything that is not a recognised microphone failure,
 * so the caller falls back to its generic error text.
 */
import { t } from "$lib/i18n";
export function micErrorMessage(err: unknown): string | null {
    if (!(err instanceof DOMException)) return null;
    switch (err.name) {
        case "NotAllowedError":
        case "SecurityError":
            return t("micErrorMessage.microphoneAccessIsBlockedAllowIt");
        case "NotFoundError":
        case "OverconstrainedError":
            return t("micErrorMessage.noMicrophoneFoundConnectOneOr");
        case "NotReadableError":
            return t("micErrorMessage.couldNotOpenYourMicrophoneAnother");
        default:
            return null;
    }
}
