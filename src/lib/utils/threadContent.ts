/**
 * Whether an event (described by its type, redaction status, and relation)
 * is a renderable reply belonging to the thread rooted at `rootEventId`.
 * The relation should be read from the event's original (unedited) content,
 * since an edit moves the top-level relation to `m.replace`.
 */
export function isThreadReplyContent(params: {
    type: string;
    isRedacted: boolean;
    relatesTo: { rel_type?: string; event_id?: string } | undefined;
    rootEventId: string;
}): boolean {
    if (params.isRedacted) return false;
    if (params.type !== "m.room.message" && params.type !== "m.sticker") {
        return false;
    }
    const rel = params.relatesTo;
    return rel?.rel_type === "m.thread" && rel?.event_id === params.rootEventId;
}

export interface ThreadReplyParams {
    /** Event id of the thread root. */
    rootEventId: string;
    /** Most recent event in the thread, for the reply-fallback ordering. */
    latestEventId?: string;
    /** Plain text of the reply. */
    text: string;
    /** Markdown-rendered HTML of the reply, if any. */
    formattedText?: string;
    mentions?: { user_ids?: string[]; room?: boolean };
}

export interface ThreadReplyContent {
    msgtype: "m.text";
    body: string;
    format?: "org.matrix.custom.html";
    formatted_body?: string;
    "m.relates_to": {
        rel_type: "m.thread";
        event_id: string;
        is_falling_back: true;
        "m.in_reply_to": { event_id: string };
    };
    "m.mentions"?: { user_ids?: string[]; room?: boolean };
}

/**
 * Build the content for a thread reply (MSC3440 / `m.thread`).
 *
 * The relation is written in the spec-compliant form — `rel_type: "m.thread"`
 * with an `is_falling_back` reply pointer — so these replies aggregate
 * correctly whether or not the SDK's `threadSupport` is enabled, and remain
 * forward-compatible if the client later switches to full thread support.
 */
export function buildThreadReplyContent(
    params: ThreadReplyParams,
): ThreadReplyContent {
    const { rootEventId, latestEventId, text, formattedText, mentions } =
        params;

    const content = withThreadRelation(
        { msgtype: "m.text" as const, body: text },
        { rootEventId, latestEventId },
    ) as ThreadReplyContent;
    if (formattedText !== undefined) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedText;
    }
    // Always present (spec recommendation): an m.mentions key — even empty —
    // disables the legacy body-scan push rules on the receiving server.
    content["m.mentions"] = mentions ?? {};
    return content;
}

/** Namespaced composer instance key for a thread's draft/file-queue scoping. */
export function composerThreadKey(roomId: string, rootEventId: string): string {
    return `${roomId}::thread::${rootEventId}`;
}

/**
 * Attach the spec-compliant `m.thread` relation (MSC3440) to an arbitrary
 * message content, returning a NEW object (the input is never mutated). Any
 * pre-existing `m.relates_to` is replaced — a thread reply's thread membership
 * takes precedence. Used to thread files, stickers and emotes, which share the
 * same relation shape as a text reply.
 */
export function withThreadRelation<T extends Record<string, unknown>>(
    content: T,
    params: { rootEventId: string; latestEventId?: string },
): T & {
    "m.relates_to": {
        rel_type: "m.thread";
        event_id: string;
        is_falling_back: true;
        "m.in_reply_to": { event_id: string };
    };
} {
    return {
        ...content,
        "m.relates_to": {
            rel_type: "m.thread",
            event_id: params.rootEventId,
            is_falling_back: true,
            "m.in_reply_to": {
                event_id: params.latestEventId ?? params.rootEventId,
            },
        },
    };
}
