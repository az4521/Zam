/**
 * Pure helpers for E2EE Layer 0 render/state decisions: telling an
 * undecryptable event apart from a decrypted one, reading whether a room has
 * encryption switched on from its `m.room.encryption` state content, and the
 * user-facing fallback strings. SDK-free so it can be unit-tested.
 */

/** Body shown in the timeline for an event we hold no keys for. */
export const UTD_PLACEHOLDER_TEXT =
    "Unable to decrypt - you may not have the keys for this message.";

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
