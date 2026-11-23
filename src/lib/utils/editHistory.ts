// Pure model for a message's edit history: the original and every `m.replace`
// edit, newest first when displayed. The SDK-facing fetch lives in client.ts
// (`fetchEditHistory`); this module only decides which edits count, what text
// each version shows and how the versions are ordered, so it can be tested
// without a client.

/** The displayable text of one version of a message. */
export interface EditVersionContent {
    msgtype: string;
    body: string;
    format?: string;
    formatted_body?: string;
}

/** One entry of the edit history, oldest first as returned. */
export interface EditVersion {
    eventId: string;
    /** Origin server timestamp in ms. */
    ts: number;
    /** null only when `undecryptable` is set (the text is not available). */
    content: EditVersionContent | null;
    /** An encrypted edit that could not be decrypted: its text is unknown. */
    undecryptable?: boolean;
}

/** The original event, as the edit history needs to see it. */
export interface EditHistoryOriginal {
    eventId: string;
    sender: string | null | undefined;
    ts: number;
    /** The original (pre-edit) event content, decrypted if it was encrypted. */
    content: unknown;
}

/** One `m.replace` relation, after the client has tried to decrypt it. */
export interface EditHistoryCandidate {
    eventId: string;
    sender: string | null | undefined;
    ts: number;
    /**
     * The edit's full clear content (the one carrying `m.new_content`), or
     * null/undefined when it could not be decrypted.
     */
    content?: unknown;
    /** True when the edit is encrypted and could not be decrypted. */
    undecryptable?: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Normalise a message content object into the text a version shows. Missing
 * fields fall back to safe defaults; `format`/`formatted_body` are kept only
 * when both are strings, so a half-formed HTML pair is shown as plain text.
 */
export function normaliseVersionContent(
    raw: unknown,
): EditVersionContent | null {
    if (!isRecord(raw)) return null;
    const msgtype = typeof raw.msgtype === "string" ? raw.msgtype : "m.text";
    const body = typeof raw.body === "string" ? raw.body : "";
    const out: EditVersionContent = { msgtype, body };
    if (
        typeof raw.format === "string" &&
        typeof raw.formatted_body === "string"
    ) {
        out.format = raw.format;
        out.formatted_body = raw.formatted_body;
    }
    return out;
}

/**
 * Build the version list for a message. The original always comes first. An
 * edit is dropped when its sender differs from the original sender (the spec
 * only lets the original sender replace their own event), or when it is a
 * decrypted edit with no `m.new_content` object (it cannot replace anything).
 * An undecryptable edit that passes the sender check is kept as a flagged
 * entry so the user still sees that an edit happened.
 *
 * The result is sorted by timestamp, oldest first. Ties are broken with the
 * original first, then by event id, so the order is deterministic.
 */
export function buildEditHistory(
    original: EditHistoryOriginal,
    edits: readonly EditHistoryCandidate[],
): EditVersion[] {
    const versions: EditVersion[] = [];
    const originalContent = normaliseVersionContent(original.content);
    versions.push({
        eventId: original.eventId,
        ts: original.ts,
        content: originalContent,
    });

    for (const edit of edits) {
        if (!edit.sender || edit.sender !== original.sender) continue;
        if (edit.undecryptable) {
            versions.push({
                eventId: edit.eventId,
                ts: edit.ts,
                content: null,
                undecryptable: true,
            });
            continue;
        }
        if (!isRecord(edit.content)) continue;
        const newContent = normaliseVersionContent(
            edit.content["m.new_content"],
        );
        if (!newContent) continue;
        versions.push({
            eventId: edit.eventId,
            ts: edit.ts,
            content: newContent,
        });
    }

    versions.sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        if (a.eventId === original.eventId) return -1;
        if (b.eventId === original.eventId) return 1;
        return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
    });
    return versions;
}
