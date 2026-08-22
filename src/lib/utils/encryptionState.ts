/**
 * Pure helpers for E2EE Layer 0 render/state decisions: telling an
 * undecryptable event apart from a decrypted one, reading whether a room has
 * encryption switched on from its `m.room.encryption` state content, and the
 * user-facing fallback strings. SDK-free so it can be unit-tested.
 */

/** Body shown in the timeline for an event we hold no keys for. */
export const UTD_PLACEHOLDER_TEXT =
    "Unable to decrypt - you may not have the keys for this message.";

/**
 * Body shown when the sender DELIBERATELY withheld the room key from us
 * (`m.room_key.withheld`). This reads very differently from transient key-lag,
 * so it earns its own line instead of the generic "you may not have the keys".
 */
export const UTD_WITHHELD_TEXT =
    "The sender chose not to share the keys for this message.";

/**
 * As {@link UTD_WITHHELD_TEXT}, but specifically because THIS device is
 * unverified. Tells the reader the actionable fix (verify this device).
 */
export const UTD_WITHHELD_UNVERIFIED_TEXT =
    "The sender did not share the keys because this device is unverified. Verify this device to read messages like this.";

// matrix-js-sdk `DecryptionFailureCode` values we give distinct copy for. Kept
// as string literals so this module stays SDK-free and unit-testable; the
// values mirror the SDK enum exactly.
const CODE_KEY_WITHHELD = "MEGOLM_KEY_WITHHELD";
const CODE_KEY_WITHHELD_UNVERIFIED =
    "MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE";

/**
 * Timeline body for an undecryptable event, refined by WHY decryption failed.
 * A deliberate `m.room_key.withheld` (the sender blocked this device) gets copy
 * that says so, rather than the generic "you may not have the keys" line that
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
        default:
            return UTD_PLACEHOLDER_TEXT;
    }
}

/** Room-list / notification preview when the last event can't be decrypted. */
export const ENCRYPTED_MESSAGE_PLACEHOLDER = "🔒 Encrypted message";

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
