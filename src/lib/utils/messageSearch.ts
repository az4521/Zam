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
