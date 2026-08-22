/**
 * Pin a decrypted attachment's blob MIME type to a safe allowlist (audit
 * SEC-L9). The `mimetype` on an `m.room.encrypted` attachment is
 * sender-controlled, and `fetchDecryptedAttachmentBlob` wraps the plaintext in
 * a `Blob` with that type before handing out an object URL. Today those object
 * URLs are only consumed by `<img>/<video>/<audio>` or `<a download>` — all
 * inert — but the moment any "open in a new tab" / iframe sink appears, a blob
 * typed `text/html` or `image/svg+xml` would execute the sender's script in our
 * origin. Forcing every non-media type to `application/octet-stream` closes
 * that in advance; a downloaded blob is MIME-agnostic (the filename drives the
 * app association), so nothing legitimate regresses.
 */

const OCTET_STREAM = "application/octet-stream";

/**
 * The safe blob MIME for a decrypted attachment: the sender's type when it is an
 * inert media type this app renders in `<img>/<video>/<audio>`, otherwise
 * `application/octet-stream`.
 *
 * `image/svg+xml` is deliberately EXCLUDED even though it is `image/*`: an SVG
 * can run script if its blob URL is ever navigated to or iframed. Types are
 * validated case-insensitively and with any `; parameters` stripped, but an
 * allowed value is returned verbatim (trimmed) so a legitimate
 * `video/mp4; codecs="…"` keeps its playback hint.
 */
export function safeAttachmentMimeType(
    mimetype: string | null | undefined,
): string {
    if (!mimetype) return OCTET_STREAM;
    const trimmed = mimetype.trim();
    if (!trimmed) return OCTET_STREAM;
    // Validate on the bare type: lower-cased, parameters removed.
    const base = trimmed.toLowerCase().split(";")[0].trim();
    if (base === "image/svg+xml") return OCTET_STREAM;
    if (
        base.startsWith("image/") ||
        base.startsWith("video/") ||
        base.startsWith("audio/")
    ) {
        return trimmed;
    }
    return OCTET_STREAM;
}
