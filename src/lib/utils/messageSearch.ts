export interface SnippetSegment {
    text: string;
    highlight: boolean;
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split a plain-text message body into segments, marking the substrings that
 * match any of the server's highlight terms (case-insensitively). Bodies
 * longer than `maxLength` are clipped to a window around the first match
 * (or the start, if nothing matches), with "…" marking the cut ends.
 *
 * The output is plain text meant to be rendered segment-by-segment — the
 * body must never go through {@html}.
 */
export function buildSnippetSegments(
    body: string,
    highlights: string[],
    maxLength = 200,
): SnippetSegment[] {
    if (!body) return [];

    const terms = highlights.filter((t) => t.length > 0);
    const pattern = terms.length
        ? new RegExp(terms.map(escapeRegExp).join("|"), "gi")
        : null;

    // Clip long bodies to a window centred on the first match.
    let clipped = body;
    let clippedStart = false;
    let clippedEnd = false;
    if (body.length > maxLength) {
        const firstMatch = pattern ? pattern.exec(body) : null;
        const matchStart = firstMatch?.index ?? 0;
        let start = Math.max(0, matchStart - Math.floor(maxLength / 2));
        const end = Math.min(body.length, start + maxLength);
        start = Math.max(0, end - maxLength);
        clipped = body.slice(start, end);
        clippedStart = start > 0;
        clippedEnd = end < body.length;
    }

    const segments: SnippetSegment[] = [];
    if (clippedStart) segments.push({ text: "…", highlight: false });
    if (!pattern) {
        segments.push({ text: clipped, highlight: false });
    } else {
        pattern.lastIndex = 0;
        let cursor = 0;
        for (const match of clipped.matchAll(pattern)) {
            if (match.index > cursor) {
                segments.push({
                    text: clipped.slice(cursor, match.index),
                    highlight: false,
                });
            }
            segments.push({ text: match[0], highlight: true });
            cursor = match.index + match[0].length;
        }
        if (cursor < clipped.length) {
            segments.push({ text: clipped.slice(cursor), highlight: false });
        }
    }
    if (clippedEnd) segments.push({ text: "…", highlight: false });
    return segments;
}

/**
 * True when an error from the search endpoint means the homeserver does not
 * implement /search at all (spec: M_UNRECOGNIZED) — callers hide the feature
 * instead of surfacing an error.
 */
export function isSearchUnsupportedError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as { errcode?: unknown }).errcode === "M_UNRECOGNIZED"
    );
}

export type HasFilter = "image" | "video" | "file" | "audio" | "voice" | "link";

const HAS_VALUES: readonly HasFilter[] = [
    "image",
    "video",
    "file",
    "audio",
    "voice",
    "link",
];

export interface ParsedSearchQuery {
    /** Free-text search term with operators stripped, trimmed. */
    term: string;
    /** Raw values from `from:` operators (deduped, order preserved). May be a
     *  full mxid or a partial — partials are matched client-side only. */
    senders: string[];
    /** `has:` content kinds (deduped, order preserved). */
    has: HasFilter[];
}

/** True for a fully-qualified `@localpart:server` mxid (safe to send as a
 *  server-side `senders` filter; partials would never match server-side). */
export function isFullMxid(s: string): boolean {
    return /^@[^:\s]+:[^:\s]+$/.test(s);
}

/** Tokenize a raw search box query into free text + `from:`/`has:` operators.
 *  Only `from:` and `has:` are operators, so URLs (`https://…`) stay free
 *  text. An unrecognized `has:` value or an empty operator value is kept as
 *  free text rather than swallowed. */
export function parseSearchQuery(input: string): ParsedSearchQuery {
    const senders: string[] = [];
    const has: HasFilter[] = [];
    const freeText: string[] = [];
    for (const token of input.split(/\s+/)) {
        if (!token) continue;
        const m = /^(from|has):(.*)$/i.exec(token);
        if (!m) {
            freeText.push(token);
            continue;
        }
        const key = m[1].toLowerCase();
        const value = m[2];
        if (key === "from") {
            if (value && !senders.includes(value)) senders.push(value);
            // empty `from:` contributes nothing and is dropped from free text
            continue;
        }
        // key === "has"
        if (!value) continue; // empty `has:` is an incomplete operator — drop, like `from:`
        const v = value.toLowerCase() as HasFilter;
        if (HAS_VALUES.includes(v)) {
            if (!has.includes(v)) has.push(v);
        } else {
            // a non-empty unrecognized has: value (e.g. has:sticker) is real
            // text the user may be searching — keep the raw token, don't swallow it
            freeText.push(token);
        }
    }
    return { term: freeText.join(" ").trim(), senders, has };
}

export interface ServerSearchFilter {
    rooms: string[];
    senders?: string[];
    contains_url?: boolean;
}

const MEDIA_HAS: readonly HasFilter[] = [
    "image",
    "video",
    "file",
    "audio",
    "voice",
];

/** Map a parsed query to the subset the homeserver `/search` filter can honor:
 *  full-mxid senders and `contains_url` for media. Everything else is refined
 *  client-side (see matchesParsedQuery). */
export function buildServerSearchFilter(
    roomId: string,
    parsed: ParsedSearchQuery,
): ServerSearchFilter {
    const filter: ServerSearchFilter = { rooms: [roomId] };
    const fullSenders = parsed.senders.filter(isFullMxid);
    if (fullSenders.length) filter.senders = fullSenders;
    if (parsed.has.some((h) => MEDIA_HAS.includes(h)))
        filter.contains_url = true;
    return filter;
}

export interface SearchEventMeta {
    sender: string;
    msgtype: string;
    body: string;
    isVoice: boolean;
}

function hasMatch(h: HasFilter, meta: SearchEventMeta): boolean {
    switch (h) {
        case "image":
            return meta.msgtype === "m.image";
        case "video":
            return meta.msgtype === "m.video";
        case "file":
            return meta.msgtype === "m.file";
        case "audio":
            return meta.msgtype === "m.audio" && !meta.isVoice;
        case "voice":
            return meta.isVoice;
        case "link":
            return /https?:\/\/\S+/i.test(meta.body);
    }
}

/** Client-side refinement: does this event satisfy every operator group?
 *  Values within an operator are OR'd; operators are AND'd. */
export function matchesParsedQuery(
    meta: SearchEventMeta,
    parsed: ParsedSearchQuery,
): boolean {
    const sendersOk =
        parsed.senders.length === 0 ||
        parsed.senders.some((s) =>
            isFullMxid(s)
                ? meta.sender === s
                : meta.sender.toLowerCase().includes(s.toLowerCase()),
        );
    const hasOk =
        parsed.has.length === 0 || parsed.has.some((h) => hasMatch(h, meta));
    return sendersOk && hasOk;
}

/** Whether the query has operators the server can't fully honor, so the
 *  returned page must be filtered client-side (has: precision, links, partial
 *  senders). A full-mxid-only from: filter is server-honored → no refine. */
export function parsedQueryNeedsClientRefine(
    parsed: ParsedSearchQuery,
): boolean {
    if (parsed.has.length > 0) return true;
    return parsed.senders.some((s) => !isFullMxid(s));
}
