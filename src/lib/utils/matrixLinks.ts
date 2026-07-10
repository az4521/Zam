/**
 * Recognize Matrix permalinks and mentions so the client can navigate them
 * in-app instead of bouncing through matrix.to.
 *
 * Handled forms:
 * - `https://matrix.to/#/<id>[/<eventId>][?via=…]` for users, room ids and
 *   aliases (segments may be percent-encoded — matrix.to itself encodes them)
 * - `matrix:u/…`, `matrix:r/…`, `matrix:roomid/…[/e/<eventId>]` URIs (MSC2312)
 * - bare `@user:server` / `#alias:server` mention text
 *
 * Anything unrecognized returns null; callers fall back to the default link
 * behavior.
 */

export type MatrixLinkTarget =
    | { kind: "user"; userId: string }
    | { kind: "room"; roomId: string; eventId?: string; via: string[] }
    | { kind: "alias"; alias: string; eventId?: string; via: string[] };

// Loose shapes for identifiers arriving through explicit links: a sigil, a
// non-empty colon-free localpart, a server name with optional port. Room ids
// only need the sigil — v12 room ids have no server part.
const USER_ID_RE = /^@[^\s:]+:[^\s:]+(?::\d+)?$/;
const ALIAS_RE = /^#[^\s:]+:[^\s:]+(?::\d+)?$/;
const ROOM_ID_RE = /^!\S+$/;
const EVENT_ID_RE = /^\$\S+$/;

function safeDecode(segment: string): string | null {
    try {
        return decodeURIComponent(segment);
    } catch {
        return null;
    }
}

/** Split `rest?query#fragment` into path and query (fragment discarded). */
function splitQuery(rest: string): [string, string] {
    const qIdx = rest.indexOf("?");
    if (qIdx === -1) return [rest, ""];
    return [rest.slice(0, qIdx), rest.slice(qIdx + 1).split("#")[0]];
}

function parseVia(query: string): string[] {
    return new URLSearchParams(query)
        .getAll("via")
        .map((s) => s.trim())
        .filter(Boolean);
}

function targetFromIdentifier(
    id: string,
    eventId: string | undefined,
    via: string[],
): MatrixLinkTarget | null {
    if (id.startsWith("@")) {
        // An event id on a user link is meaningless — treat as malformed.
        if (eventId || !USER_ID_RE.test(id)) return null;
        return { kind: "user", userId: id };
    }
    if (id.startsWith("#")) {
        if (!ALIAS_RE.test(id)) return null;
        return eventId
            ? { kind: "alias", alias: id, eventId, via }
            : { kind: "alias", alias: id, via };
    }
    if (id.startsWith("!")) {
        if (!ROOM_ID_RE.test(id)) return null;
        return eventId
            ? { kind: "room", roomId: id, eventId, via }
            : { kind: "room", roomId: id, via };
    }
    return null;
}

function parseMatrixToPath(rest: string): MatrixLinkTarget | null {
    const [pathPart, query] = splitQuery(rest);
    const segments = pathPart.split("/");
    if (segments.length > 2) return null;
    const id = safeDecode(segments[0]);
    if (!id) return null;
    let eventId: string | undefined;
    if (segments.length === 2) {
        const ev = safeDecode(segments[1]);
        if (!ev || !EVENT_ID_RE.test(ev)) return null;
        eventId = ev;
    }
    return targetFromIdentifier(id, eventId, parseVia(query));
}

const MATRIX_URI_SIGILS: Record<string, string> = {
    u: "@",
    r: "#",
    roomid: "!",
};

function parseMatrixUri(rest: string): MatrixLinkTarget | null {
    const [pathPart, query] = splitQuery(rest);
    const rawSegments = pathPart.split("/").map(safeDecode);
    if (rawSegments.some((s) => s === null)) return null;
    const segments = rawSegments as string[];
    if (segments.length !== 2 && segments.length !== 4) return null;
    const sigil = MATRIX_URI_SIGILS[segments[0]];
    if (!sigil || !segments[1]) return null;
    let eventId: string | undefined;
    if (segments.length === 4) {
        if (segments[2] !== "e" || !segments[3]) return null;
        // matrix: URIs carry event ids without the $ sigil.
        eventId = segments[3].startsWith("$") ? segments[3] : `$${segments[3]}`;
    }
    return targetFromIdentifier(sigil + segments[1], eventId, parseVia(query));
}

/**
 * Parse an href or bare mention text into a Matrix navigation target, or null
 * when it isn't a recognizable Matrix link.
 */
export function parseMatrixLink(input: string): MatrixLinkTarget | null {
    const raw = input?.trim();
    if (!raw) return null;

    if (raw.startsWith("@")) {
        return USER_ID_RE.test(raw) ? { kind: "user", userId: raw } : null;
    }
    if (raw.startsWith("#")) {
        return ALIAS_RE.test(raw)
            ? { kind: "alias", alias: raw, via: [] }
            : null;
    }

    const matrixTo = raw.match(/^https?:\/\/matrix\.to\/#\/(.*)$/i);
    if (matrixTo) return parseMatrixToPath(matrixTo[1]);
    if (/^matrix:/i.test(raw))
        return parseMatrixUri(raw.slice("matrix:".length));
    return null;
}

// Bare mentions in message text: a sigil after a word boundary, a localpart,
// and a dotted server name (optional port). Requiring the dot keeps things
// like "#1:30pm" from linkifying; explicit links stay loose (see above).
const MENTION_RE =
    /(^|[\s(>[\]{}"'.,;!?~*_-])([@#][A-Za-z0-9._%=+/-]+:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?::\d+)?)/g;

/**
 * Wrap bare `@user:server` / `#alias:server` mentions in matrix.to anchors.
 * Input must be HTML-escaped plain text (the `plainToHtml` path) — this must
 * never run over untrusted formatted HTML.
 */
export function linkifyMatrixIdentifiers(html: string): string {
    return html.replace(
        MENTION_RE,
        (_m, pre: string, id: string) =>
            `${pre}<a href="https://matrix.to/#/${encodeURIComponent(id)}">${id}</a>`,
    );
}
