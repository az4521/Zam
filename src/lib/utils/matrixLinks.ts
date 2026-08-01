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

/**
 * Merge a link's explicit `via` servers with the servers returned by alias
 * resolution into a bounded candidate list for `/join?server_name=…`.
 *
 * The cap matters: servers can return the full member-server list (continuwuity
 * sent 889 for one space), and putting them all in the query string produces a
 * ~40 KB request URI that proxies kill — taking the connection, and the
 * in-flight /sync on it, down with it. A handful of candidates is all the
 * homeserver needs. Explicit link vias come first: the sharer curated them.
 */
export function mergeViaServers(
    linkVia: string[],
    resolvedServers: string[],
    max = 5,
): string[] {
    return [...new Set([...linkVia, ...resolvedServers])].slice(0, max);
}

/**
 * Build a matrix.to permalink for a user, alias, or room id. Users and aliases
 * are self-routing; a room id (`!…`) isn't joinable on its own, so up to 5 `via`
 * servers are appended as `?via=` params. Segments are percent-encoded
 * similarly to `linkifyMatrixIdentifiers` above, so the result round-trips
 * through `parseMatrixLink`.
 */
export function matrixToUrl(idOrAlias: string, via: string[] = []): string {
    const encoded = encodeURIComponent(idOrAlias).replace(/!/g, "%21");
    const base = `https://matrix.to/#/${encoded}`;
    if (idOrAlias.startsWith("!") && via.length) {
        const qs = via
            .slice(0, 5)
            .map((s) => `via=${encodeURIComponent(s)}`)
            .join("&");
        return `${base}?${qs}`;
    }
    return base;
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

// Bare http(s) URLs in escaped plain text. `<` and `>` can't appear raw (they
// are entities by this point) and a closing paren ends the match so
// "(see https://x)" doesn't swallow the bracket. Mirrors the composer's
// markdown linkifier so sent and received text behave the same.
const URL_RE = /https?:\/\/[^\s<>)"']*/g;

/**
 * Linkify an HTML-ESCAPED plain-text body: http(s) URLs first, then bare
 * `@user:server` / `#alias:server` mentions.
 *
 * Without the URL pass a pasted `https://matrix.to/#/!room:server` link stayed
 * dead text — and since the in-app Matrix-link handler works by intercepting
 * clicks on anchors, no anchor meant no way to open (or join) the target.
 *
 * URLs are stashed behind placeholders across the mention pass so a matrix.to
 * link — which contains an alias-shaped `#dev:server` segment — can't grow a
 * nested anchor inside itself.
 *
 * Input MUST already be HTML-escaped; this never runs over untrusted HTML.
 * Escaped entities inside a URL (`&amp;` joining `?via=` params) are preserved
 * verbatim in the href, which browsers decode back to `&` when it is read.
 */
export function linkifyPlainText(escapedHtml: string): string {
    const anchors: string[] = [];
    const stashed = escapedHtml.replace(URL_RE, (url) => {
        anchors.push(`<a href="${url}">${url}</a>`);
        return `\x02${anchors.length - 1}\x03`;
    });
    return linkifyMatrixIdentifiers(stashed).replace(
        /\x02(\d+)\x03/g,
        (_m, index: string) => anchors[Number(index)],
    );
}

/**
 * The tooltip an anchor should carry, or null for "leave it alone".
 *
 * Only user links get one: the anchor text is usually a nickname, so the full
 * user id is the useful disambiguation. Extracted from MessageItem so the rule
 * is testable — the component now applies it per-anchor on hover/focus instead
 * of sweeping every anchor in the row from a MutationObserver.
 */
export function matrixLinkTitle(
    href: string | null | undefined,
): string | null {
    if (!href) return null;
    const target = parseMatrixLink(href);
    return target?.kind === "user" ? target.userId : null;
}
