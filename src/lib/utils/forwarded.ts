// MSC4553 forwarded messages.
//
// A forward is a fresh event whose content carries an `m.forwarded` object:
// optional attribution (sender, room, event, timestamp) plus `content`, a copy
// of the original message. The top-level fields are a text fallback for
// clients that do not know the MSC; supporting clients draw `m.forwarded
// .content` instead. A forward of a forward copies the object unchanged so it
// keeps pointing at the original message.
//
// Until the MSC is accepted we send `org.matrix.msc4553.forwarded`, and read
// the stable key, the unstable key and MSC2723's `com.famedly.app.forwarded`
// (which has no `content`, so those render from the top level).

import { stripBodyFallback, stripFormattedFallback } from "./replyFallback";

type Content = Record<string, unknown>;

export const FORWARDED_SEND_KEY = "org.matrix.msc4553.forwarded";
const FORWARDED_KEYS = [
    "m.forwarded",
    FORWARDED_SEND_KEY,
    "com.famedly.app.forwarded",
] as const;
/** MSC2723 forwards never carry `content`; never send this key. */
const MSC2723_KEY = "com.famedly.app.forwarded";

/** Keys that describe the forwarding event's own place in its room. */
const LOCAL_KEYS = ["m.relates_to", "m.mentions", "m.new_content"];

const HTML_FORMAT = "org.matrix.custom.html";
const TEXT_MSGTYPES = new Set(["m.text", "m.notice", "m.emote"]);
const CAPTION_MSGTYPES = new Set(["m.image", "m.video", "m.audio", "m.file"]);

/**
 * Stay well under the 64 KiB PDU limit: the forward carries the content twice,
 * and in an encrypted room the payload grows by about a third again.
 */
const MAX_CONTENT_BYTES = 40_000;

/** Attribution read from a forward. Every field is a claim by the forwarder. */
export interface ForwardInfo {
    eventId?: string;
    roomId?: string;
    roomName?: string;
    roomAvatarUrl?: string;
    sender?: string;
    ts?: number;
    /** The original content when present and valid, else null. */
    content: Content | null;
}

function isObject(v: unknown): v is Content {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** The forwarded object under whichever key the event used, with its key. */
function rawForward(
    content: Content | null | undefined,
): { key: string; obj: Content } | null {
    if (!isObject(content)) return null;
    for (const key of FORWARDED_KEYS) {
        const obj = content[key];
        if (isObject(obj)) return { key, obj };
    }
    return null;
}

/** Does `inner` meet the content rules of an event of `eventType`? */
export function isValidForwardedContent(
    inner: unknown,
    eventType: string,
): inner is Content {
    if (!isObject(inner)) return false;
    if (typeof inner.body !== "string") return false;
    if (eventType === "m.sticker")
        return typeof inner.url === "string" || isObject(inner.file);
    if (eventType === "m.room.message")
        return typeof inner.msgtype === "string";
    return false;
}

/** The forward attribution on an event's content, or null if not a forward. */
export function readForward(
    content: Content | null | undefined,
    eventType: string,
): ForwardInfo | null {
    const found = rawForward(content);
    if (!found) return null;
    const { key, obj } = found;
    const inner = key === MSC2723_KEY ? undefined : obj.content;
    const ts = obj.origin_server_ts;
    return {
        eventId: str(obj.event_id),
        roomId: str(obj.room_id),
        roomName: str(obj.room_name),
        roomAvatarUrl: str(obj.room_avatar_url)?.startsWith("mxc://")
            ? (obj.room_avatar_url as string)
            : undefined,
        sender: str(obj.sender),
        ts:
            typeof ts === "number" && Number.isFinite(ts) && ts > 0
                ? ts
                : undefined,
        content: isValidForwardedContent(inner, eventType) ? inner : null,
    };
}

/**
 * What to draw for a message: the original content of a forward that carries
 * a valid copy, else the event's own content. Relations and mentions inside
 * the copy belong to the source room, so the forward's own replace them.
 */
export function forwardDisplayContent<T extends Content>(
    content: T,
    eventType: string,
): T {
    const fwd = readForward(content, eventType);
    if (!fwd?.content) return content;
    const out: Content = { ...fwd.content };
    for (const key of LOCAL_KEYS) delete out[key];
    for (const key of FORWARDED_KEYS) delete out[key];
    if (content["m.relates_to"] !== undefined)
        out["m.relates_to"] = content["m.relates_to"];
    if (content["m.mentions"] !== undefined)
        out["m.mentions"] = content["m.mentions"];
    return out as T;
}

// ── Sending ───────────────────────────────────────────────────────────────

/** The message the user picked to forward. */
export interface ForwardSource {
    /** Decrypted event type: m.room.message or m.sticker. */
    type: string;
    /** Content as displayed, with the latest edit applied. */
    content: Content;
    /** Pre-edit content: decides whether this is a reply or a forward. */
    originalContent: Content;
    eventId?: string;
    roomId?: string;
    /** Omit for rooms whose name should not travel (DMs). */
    roomName?: string;
    roomAvatarUrl?: string;
    sender?: string;
    ts?: number;
}

export interface ForwardFallbackContext {
    /** Display name for a user ID, for the emote actor. */
    displayName?: (userId: string) => string | undefined;
    /** `via` servers for an event permalink in this room. */
    via?: (roomId: string) => string[];
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function userPermalink(userId: string): string {
    return `https://matrix.to/#/${encodeURIComponent(userId)}`;
}

/** matrix.to event permalink, each segment percent-encoded (MSC4553). */
export function forwardEventPermalink(
    roomId: string,
    eventId: string,
    via: string[] = [],
): string {
    const base = `https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(eventId)}`;
    const qs = [...new Set(via)]
        .slice(0, 5)
        .map((s) => `via=${encodeURIComponent(s)}`)
        .join("&");
    return qs ? `${base}?${qs}` : base;
}

/** Content copied into `m.forwarded.content` from the picked event. */
function copyOriginal(src: ForwardSource): Content {
    const inner = structuredClone(src.content);
    for (const key of FORWARDED_KEYS) delete inner[key];
    const rel = src.originalContent["m.relates_to"] as
        { "m.in_reply_to"?: unknown } | undefined;
    if (rel?.["m.in_reply_to"]) {
        if (typeof inner.body === "string")
            inner.body = stripBodyFallback(inner.body);
        if (typeof inner.formatted_body === "string")
            inner.formatted_body = stripFormattedFallback(inner.formatted_body);
    }
    return inner;
}

/** The `m.forwarded` object for a forward of `src`. */
function forwardObject(src: ForwardSource): Content {
    const existing = rawForward(src.originalContent);
    if (existing) {
        // A forward of a forward points at the original message: copy its
        // object as is, replacing only a missing or invalid copy.
        const obj = structuredClone(existing.obj);
        if (
            existing.key === MSC2723_KEY ||
            !isValidForwardedContent(obj.content, src.type)
        )
            obj.content = copyOriginal(src);
        return obj;
    }
    const obj: Content = {};
    if (src.eventId) obj.event_id = src.eventId;
    if (src.roomId) obj.room_id = src.roomId;
    if (src.roomName) obj.room_name = src.roomName;
    if (src.roomAvatarUrl?.startsWith("mxc://"))
        obj.room_avatar_url = src.roomAvatarUrl;
    if (src.sender) obj.sender = src.sender;
    if (src.ts) obj.origin_server_ts = src.ts;
    obj.content = copyOriginal(src);
    return obj;
}

function originalHtml(inner: Content, text: string): string {
    if (
        inner.format === HTML_FORMAT &&
        typeof inner.formatted_body === "string"
    )
        return inner.formatted_body;
    return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

/** The fallback's first line, as plain text and HTML. */
function fallbackHeader(
    obj: Content,
    ctx: ForwardFallbackContext,
): { text: string; html: string } {
    const sender = str(obj.sender);
    const roomId = str(obj.room_id);
    const eventId = str(obj.event_id);
    const permalink =
        roomId && eventId
            ? forwardEventPermalink(roomId, eventId, ctx.via?.(roomId) ?? [])
            : null;
    let text = sender ? `Forwarded from ${sender}` : "Forwarded message";
    let html = sender
        ? `Forwarded from <a href="${escapeHtml(userPermalink(sender))}">${escapeHtml(sender)}</a>`
        : "Forwarded message";
    if (permalink) {
        text += ` - view original message: ${permalink}`;
        html += ` - <a href="${escapeHtml(permalink)}">view original message</a>`;
    }
    return { text, html: `<strong>${html}</strong>` };
}

/** Top-level content: a copy of the original with a fallback applied. */
function topLevel(
    type: string,
    obj: Content,
    ctx: ForwardFallbackContext,
    quote: boolean,
): Content {
    const inner = obj.content as Content;
    const top: Content = structuredClone(inner);
    for (const key of LOCAL_KEYS) delete top[key];
    for (const key of FORWARDED_KEYS) delete top[key];

    const msgtype = typeof inner.msgtype === "string" ? inner.msgtype : "";
    const body = typeof inner.body === "string" ? inner.body : "";
    const isText = type === "m.room.message" && TEXT_MSGTYPES.has(msgtype);
    const isCaptioned =
        type === "m.room.message" && CAPTION_MSGTYPES.has(msgtype);

    if (isText || isCaptioned) {
        // Unaware clients would show an emote as one by the forwarder.
        if (msgtype === "m.emote") top.msgtype = "m.text";
        let quotedText = "";
        let quotedHtml = "";
        if (isText && body.trim()) {
            quotedText = body;
            quotedHtml = originalHtml(inner, body);
            if (msgtype === "m.emote") {
                const sender = str(obj.sender);
                const name = sender
                    ? (ctx.displayName?.(sender) ?? sender)
                    : "Sender";
                const actorHtml = sender
                    ? `<a href="${escapeHtml(userPermalink(sender))}">${escapeHtml(name)}</a>`
                    : "Sender";
                quotedText = `${name} ${body}`;
                quotedHtml = `<em><strong>${actorHtml}</strong> ${quotedHtml}</em>`;
            }
        } else if (isCaptioned) {
            const filename = str(inner.filename);
            top.filename = filename ?? body;
            if (filename && filename !== body && body.trim()) {
                quotedText = body;
                quotedHtml = originalHtml(inner, body);
            }
        }
        const header = fallbackHeader(obj, ctx);
        const withQuote = quote && quotedText !== "";
        top.body = withQuote ? `${header.text}\n${quotedText}` : header.text;
        top.format = HTML_FORMAT;
        top.formatted_body = withQuote
            ? `${header.html}<br><blockquote>${quotedHtml}</blockquote>`
            : header.html;
    }
    // Stickers and other msgtypes (m.location, unknown) keep their body.

    // Our own mentions: an empty set keeps legacy push rules off the
    // fallback text, and the original sender is not pinged.
    top["m.mentions"] = {};
    top[FORWARDED_SEND_KEY] = obj;
    return top;
}

function byteLength(v: unknown): number {
    return new TextEncoder().encode(JSON.stringify(v)).length;
}

/**
 * Content for an MSC4553 forward of `src`, sent with the same event type.
 * When the doubled content would be too big, the fallback drops its quote and
 * keeps only the attribution line.
 */
export function buildForwardContent(
    src: ForwardSource,
    ctx: ForwardFallbackContext = {},
): Content {
    const obj = forwardObject(src);
    const full = topLevel(src.type, obj, ctx, true);
    if (byteLength(full) <= MAX_CONTENT_BYTES) return full;
    return topLevel(src.type, obj, ctx, false);
}
