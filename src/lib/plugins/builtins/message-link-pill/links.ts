// Message permalink parsing for the message-link-pill built-in. Pure, no DOM.

export interface MessagePermalink {
    /** A room id (`!...`) or alias (`#...`). */
    roomOrAlias: string;
    eventId: string;
    href: string;
}

const ROOM_ID_RE = /^!\S+$/;
const ALIAS_RE = /^#[^\s:]+:[^\s:]+(?::\d+)?$/;
const EVENT_ID_RE = /^\$\S+$/;

function safeDecode(segment: string): string | null {
    try {
        return decodeURIComponent(segment);
    } catch {
        return null;
    }
}

function splitQuery(rest: string): [string, string] {
    const qIdx = rest.indexOf("?");
    if (qIdx === -1) return [rest, ""];
    return [rest.slice(0, qIdx), rest.slice(qIdx + 1).split("#")[0]];
}

function targetFromIdentifier(
    id: string,
    eventId: string,
): Omit<MessagePermalink, "href"> | null {
    if (!eventId || !EVENT_ID_RE.test(eventId)) return null;
    if (id.startsWith("!")) {
        if (!ROOM_ID_RE.test(id)) return null;
        return { roomOrAlias: id, eventId };
    }
    if (id.startsWith("#")) {
        if (!ALIAS_RE.test(id)) return null;
        return { roomOrAlias: id, eventId };
    }
    return null;
}

function parseMatrixToPath(rest: string) {
    const [pathPart] = splitQuery(rest);
    const segments = pathPart.split("/");
    if (segments.length !== 2) return null;
    const id = safeDecode(segments[0]);
    const eventId = safeDecode(segments[1]);
    if (!id || !eventId) return null;
    return targetFromIdentifier(id, eventId);
}

const MATRIX_URI_SIGILS: Record<string, string> = {
    u: "@",
    r: "#",
    roomid: "!",
};

function parseMatrixUri(rest: string) {
    const [pathPart] = splitQuery(rest);
    const segments = pathPart.split("/").map(safeDecode);
    if (segments.some((s) => s === null)) return null;
    const segs = segments as string[];
    if (segs.length !== 4) return null;
    const sigil = MATRIX_URI_SIGILS[segs[0].toLowerCase()];
    if (!sigil || !segs[1]) return null;
    if (segs[2] !== "e" && segs[2] !== "E") return null;
    if (!segs[3]) return null;
    const eventId = segs[3].startsWith("$") ? segs[3] : `$${segs[3]}`;
    return targetFromIdentifier(sigil + segs[1], eventId);
}

/** A link to one specific message (matrix.to or matrix: URI), or null. */
export function parseMessagePermalink(
    href: string | null | undefined,
): MessagePermalink | null {
    const raw = href?.trim();
    if (!raw) return null;
    const matrixTo = raw.match(/^https?:\/\/matrix\.to\/#\/(.*)$/i);
    if (matrixTo) {
        const parsed = parseMatrixToPath(matrixTo[1]);
        return parsed ? { ...parsed, href: raw } : null;
    }
    if (/^matrix:/i.test(raw)) {
        const parsed = parseMatrixUri(raw.slice("matrix:".length));
        return parsed ? { ...parsed, href: raw } : null;
    }
    return null;
}

/** True when the anchor's visible text is just its own URL. */
function looksLikeRawUrl(text: string, href: string): boolean {
    const cleanText = text.trim();
    const cleanHref = href.trim();
    if (!cleanText || !cleanHref) return false;
    if (cleanText === cleanHref) return true;
    const textLink = parseMessagePermalink(cleanText);
    const hrefLink = parseMessagePermalink(cleanHref);
    if (!textLink || !hrefLink) return false;
    return (
        textLink.roomOrAlias === hrefLink.roomOrAlias &&
        textLink.eventId === hrefLink.eventId
    );
}

/** Pill a link only when it points at a message and shows its raw URL. */
export function shouldPillAnchor(href: string, text: string): boolean {
    return parseMessagePermalink(href) !== null && looksLikeRawUrl(text, href);
}

/** Zam renders at most this many quoted-message cards per message. */
const MAX_EMBEDS = 3;

function permalinkKey(roomOrAlias: string, eventId: string): string {
    return `${roomOrAlias}|${eventId}`;
}

/** Distinct message links in first-appearance order, as Zam renders cards. */
export function distinctMessagePermalinks(hrefs: string[]): MessagePermalink[] {
    const seen = new Set<string>();
    const out: MessagePermalink[] = [];
    for (const href of hrefs) {
        const parsed = parseMessagePermalink(href);
        if (!parsed) continue;
        const key = permalinkKey(parsed.roomOrAlias, parsed.eventId);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(parsed);
        if (out.length >= MAX_EMBEDS) break;
    }
    return out;
}

export function embedIndexForHref(
    distinct: MessagePermalink[],
    href: string,
): number {
    const parsed = parseMessagePermalink(href);
    if (!parsed) return -1;
    const key = permalinkKey(parsed.roomOrAlias, parsed.eventId);
    return distinct.findIndex(
        (e) => permalinkKey(e.roomOrAlias, e.eventId) === key,
    );
}
