/**
 * Pure helpers for E2EE Layer 0 render/state decisions: telling an
 * undecryptable event apart from a decrypted one, reading whether a room has
 * encryption switched on from its `m.room.encryption` state content, and the
 * user-facing fallback strings. SDK-free so it can be unit-tested.
 */

/** Body shown in the timeline for an event we hold no keys for. */
import { t } from "$lib/i18n";
export const UTD_PLACEHOLDER_TEXT = t(
    "encryptionState.unableToDecryptYouMayNot",
);

/**
 * Body shown when the sender DELIBERATELY withheld the room key from us
 * (`m.room_key.withheld`). This reads very differently from transient key-lag,
 * so it earns its own line instead of the generic "you may not have the keys".
 */
export const UTD_WITHHELD_TEXT = t("encryptionState.theSenderChoseNotToShare");

/**
 * As {@link UTD_WITHHELD_TEXT}, but specifically because THIS device is
 * unverified. Tells the reader the actionable fix (verify this device).
 */
export const UTD_WITHHELD_UNVERIFIED_TEXT = t(
    "encryptionState.theSenderDidNotShareThe",
);

/**
 * MSC4153 device isolation (on by default): we hold the key, but the sending
 * device is not cross-signed by its owner, so the SDK refuses to show it.
 * Without this the user sees the "missing keys" line and goes hunting for a
 * key-delivery problem that does not exist.
 */
export const UTD_UNSIGNED_SENDER_TEXT = t(
    "encryptionState.senderDeviceNotCrossSigned",
);

/** As above, but the event could not be tied to any known sender device. */
export const UTD_UNKNOWN_SENDER_TEXT = t("encryptionState.senderDeviceUnknown");

/** The sender was verified once and their identity has since changed. */
export const UTD_IDENTITY_CHANGED_TEXT = t(
    "encryptionState.senderIdentityChanged",
);

/** Sent before this device existed, and the account has no key backup. */
export const UTD_HISTORICAL_NO_BACKUP_TEXT = t(
    "encryptionState.historicalNoBackup",
);

/** Sent before this device existed; a backup exists but this device can't use it. */
export const UTD_HISTORICAL_BACKUP_UNCONFIGURED_TEXT = t(
    "encryptionState.historicalBackupUnconfigured",
);

/** Sent before this device existed; the backup is usable but lacks this key (so far). */
export const UTD_HISTORICAL_WORKING_BACKUP_TEXT = t(
    "encryptionState.historicalWorkingBackup",
);

/** Sent while we were not a member of the room. */
export const UTD_NOT_JOINED_TEXT = t("encryptionState.historicalNotJoined");

// matrix-js-sdk `DecryptionFailureCode` values we give distinct copy for. Kept
// as string literals so this module stays SDK-free and unit-testable; the
// values mirror the SDK enum exactly.
const CODE_KEY_WITHHELD = "MEGOLM_KEY_WITHHELD";
const CODE_KEY_WITHHELD_UNVERIFIED =
    "MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE";
const CODE_UNSIGNED_SENDER = "UNSIGNED_SENDER_DEVICE";
const CODE_UNKNOWN_SENDER = "UNKNOWN_SENDER_DEVICE";
const CODE_IDENTITY_CHANGED = "SENDER_IDENTITY_PREVIOUSLY_VERIFIED";
const CODE_HISTORICAL_NO_BACKUP = "HISTORICAL_MESSAGE_NO_KEY_BACKUP";
const CODE_HISTORICAL_BACKUP_UNCONFIGURED =
    "HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED";
const CODE_HISTORICAL_WORKING_BACKUP = "HISTORICAL_MESSAGE_WORKING_BACKUP";
const CODE_NOT_JOINED = "HISTORICAL_MESSAGE_USER_NOT_JOINED";

/**
 * Timeline body for an undecryptable event, refined by WHY decryption failed.
 * A deliberate `m.room_key.withheld` (the sender blocked this device), an
 * MSC4153 isolation refusal, or an expected historical gap each gets copy that
 * says so, rather than the generic "you may not have the keys" line that
 * really means transient key-lag. Any other, unknown, or absent reason keeps
 * the generic text, so a new SDK failure code can never render blank or throw.
 *
 * `failureReason` is the raw `MatrixEvent.decryptionFailureReason` string, or
 * null/undefined when the event decrypted or the reason is not yet known.
 */
export function utdPlaceholderText(
    failureReason: string | null | undefined,
): string {
    switch (failureReason) {
        case CODE_KEY_WITHHELD:
            return UTD_WITHHELD_TEXT;
        case CODE_KEY_WITHHELD_UNVERIFIED:
            return UTD_WITHHELD_UNVERIFIED_TEXT;
        case CODE_UNSIGNED_SENDER:
            return UTD_UNSIGNED_SENDER_TEXT;
        case CODE_UNKNOWN_SENDER:
            return UTD_UNKNOWN_SENDER_TEXT;
        case CODE_IDENTITY_CHANGED:
            return UTD_IDENTITY_CHANGED_TEXT;
        case CODE_HISTORICAL_NO_BACKUP:
            return UTD_HISTORICAL_NO_BACKUP_TEXT;
        case CODE_HISTORICAL_BACKUP_UNCONFIGURED:
            return UTD_HISTORICAL_BACKUP_UNCONFIGURED_TEXT;
        case CODE_HISTORICAL_WORKING_BACKUP:
            return UTD_HISTORICAL_WORKING_BACKUP_TEXT;
        case CODE_NOT_JOINED:
            return UTD_NOT_JOINED_TEXT;
        default:
            return UTD_PLACEHOLDER_TEXT;
    }
}

/** Room-list / notification preview when the last event can't be decrypted. */
export const ENCRYPTED_MESSAGE_PLACEHOLDER = t(
    "encryptionState.encryptedMessage",
);

/**
 * True when an event is still an encrypted envelope (no keys / not yet
 * decrypted). A *successfully* decrypted event reports its cleartext type
 * (e.g. "m.room.message"), so only "m.room.encrypted" means undecrypted.
 */
export function isUndecryptedEvent(eventType: string): boolean {
    return eventType === "m.room.encrypted";
}

/**
 * Whether a room has encryption enabled, given the content of its
 * `m.room.encryption` state event (or null/undefined when the event is
 * absent). Per the Matrix spec a room is encrypted once such an event names an
 * encryption `algorithm`.
 */
export function isEncryptionEnabled(
    encryptionContent: { algorithm?: unknown } | null | undefined,
): boolean {
    const algorithm = encryptionContent?.algorithm;
    return typeof algorithm === "string" && algorithm.length > 0;
}

/**
 * Preview text for the room list / notifications. Falls back to a generic lock
 * line when the event is an undecryptable encrypted envelope; otherwise returns
 * the caller's already-computed cleartext preview.
 */
export function previewForEvent(
    eventType: string,
    decryptedPreview: string | null | undefined,
): string {
    if (isUndecryptedEvent(eventType)) return ENCRYPTED_MESSAGE_PLACEHOLDER;
    return decryptedPreview ?? "";
}
