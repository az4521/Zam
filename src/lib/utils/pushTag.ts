/**
 * The opaque per-account tag a pusher puts in its `default_payload`.
 *
 * Several accounts on one device share a push subscription, so every push has
 * to say which account it is for. It used to carry the Matrix user id
 * (`zam_account`), but the homeserver forwards the pusher's whole `data`
 * object to the push gateway (and Sygnal copies `default_payload` into the
 * FCM message), so that put the user id in front of the gateway and Google
 * on every message.
 *
 * The tag is random, generated once per account on this device and kept in
 * the account registry. The service worker and the Android push service map
 * it back to the account through the mirrored account records
 * (`pushTag` in nativeSessionRecord.ts). It says nothing about the account to
 * anyone without that mapping.
 *
 * `static/sw.js`, `MatrixMessagingService.java` and `UnifiedPushService.java`
 * hand-mirror PUSH_TAG_FIELD and LEGACY_PUSH_ACCOUNT_FIELD.
 */

/** The `default_payload` field carrying the tag. */
export const PUSH_TAG_FIELD = "zam_tag";

/**
 * The field older pushers used, carrying the plain user id. Still read, so a
 * pusher registered before this change keeps working until it re-registers
 * (every app start does).
 */
export const LEGACY_PUSH_ACCOUNT_FIELD = "zam_account";

const TAG_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidPushTag(value: unknown): value is string {
    return typeof value === "string" && TAG_PATTERN.test(value);
}

/** 128 random bits, base64url without padding (22 characters). */
export function newPushTag(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** The pusher `default_payload` naming an account, or none without a tag. */
export function pushTagPayload(
    tag: string | null,
): { default_payload: Record<string, string> } | Record<string, never> {
    return isValidPushTag(tag)
        ? { default_payload: { [PUSH_TAG_FIELD]: tag } }
        : {};
}
