/**
 * Pure helpers for the server's media upload limit.
 *
 * `sendFile` used to toast and resolve when a file was over the limit, which
 * read to the composer as "sent" and silently dropped the file (audit
 * MEDIA-02). It now throws `FileTooLargeError` so the caller can keep the item
 * queued and surface the failure itself.
 */

const KIB = 1024;
const MIB = 1024 * 1024;

/** Human-readable byte limit — KB below a megabyte so a small limit isn't rendered as "0 MB". */
export function formatByteLimit(bytes: number): string {
    if (bytes >= MIB) return `${Math.round(bytes / MIB)} MB`;
    return `${Math.round(bytes / KIB)} KB`;
}

/** A null limit means the server advertised none; the boundary itself is allowed. */
export function exceedsUploadLimit(
    size: number,
    limit: number | null,
): boolean {
    if (limit === null) return false;
    return size > limit;
}

export function uploadLimitMessage(fileName: string, limit: number): string {
    return `"${fileName}" exceeds the server's ${formatByteLimit(limit)} upload limit`;
}

export class FileTooLargeError extends Error {
    /** Duck-typed marker: survives bundler duplication, where `instanceof` doesn't. */
    readonly isFileTooLarge = true;

    constructor(
        readonly fileName: string,
        readonly size: number,
        readonly limit: number,
    ) {
        super(uploadLimitMessage(fileName, limit));
        this.name = "FileTooLargeError";
    }
}

export function isFileTooLargeError(err: unknown): err is FileTooLargeError {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as { isFileTooLarge?: unknown }).isFileTooLarge === true
    );
}
