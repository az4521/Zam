// X/Twitter link previews, built from FxTwitter's v2 status API.
//
// Homeservers get nothing useful from x.com, so tweets are previewed from
// https://api.fxtwitter.com/2/status/<id>. That endpoint sends CORS headers,
// unlike the Mastodon-shaped /api/v1/statuses/<snowcode> one FxTwitter serves
// Discord (same data, pre-rendered as HTML, but unreadable from a browser).
// Everything here is parsed from a third-party JSON body, so every field is
// type-checked and every link or media URL must be https before it is used.

export interface TweetMedia {
    kind: "photo" | "video" | "gif";
    url: string;
    width?: number;
    height?: number;
    /** Poster for a video or GIF. */
    thumbnail?: string;
    alt?: string;
}

export type TweetSegment =
    | { kind: "text"; text: string }
    | { kind: "link"; text: string; href: string };

export interface TweetPoll {
    choices: { label: string; percentage: number }[];
    totalVotes: number;
    /** ms since epoch, or null when unknown. */
    endsAt: number | null;
}

export interface TweetQuoteTombstone {
    tombstone: string;
    url?: string;
}

export interface TweetTranslation {
    /** BCP 47-ish code FxTwitter detected for the original, e.g. "ja". */
    sourceLang: string;
    /** English name of the source language, when FxTwitter gives one. */
    sourceLangName?: string;
    text: string;
    segments: TweetSegment[];
}

export interface TweetEmbed {
    url: string;
    authorName: string;
    authorHandle: string;
    authorUrl: string;
    avatarUrl?: string;
    text: string;
    segments: TweetSegment[];
    media: TweetMedia[];
    replyingTo: { handle: string; url: string } | null;
    poll: TweetPoll | null;
    quote: TweetEmbed | TweetQuoteTombstone | null;
    communityNote: TweetSegment[] | null;
    /** Present when the link asked for a translation (`/status/<id>/en`). */
    translation: TweetTranslation | null;
    replies: number | null;
    reposts: number | null;
    likes: number | null;
    /** ms since epoch, or null when unknown. */
    createdAt: number | null;
}

export function isQuoteTombstone(
    q: TweetEmbed["quote"],
): q is TweetQuoteTombstone {
    return !!q && "tombstone" in q;
}

// Hosts whose status links get a tweet card. The FxTwitter/vxTwitter mirrors
// are links people post to get an embed, so they get the same card.
const TWEET_HOSTS = new Set([
    "x.com",
    "twitter.com",
    "mobile.x.com",
    "mobile.twitter.com",
    "fxtwitter.com",
    "fixupx.com",
    "vxtwitter.com",
    "fixvx.com",
]);

// A trailing language segment, as FxTwitter takes it: /status/<id>/en,
// /status/<id>/pt-br, also after /photo/1 and the like.
const LANG_SEGMENT_RE = /\/([a-z]{2,3}(?:[-_][a-z0-9]{2,4})?)\/?$/i;

/**
 * The FxTwitter v2 API URL for a tweet link, or null if it isn't one. A
 * trailing language code (FxTwitter's translate feature) becomes `?lang=`.
 */
export function fxStatusApiUrl(rawUrl: string): string | null {
    let u: URL;
    try {
        u = new URL(rawUrl);
    } catch {
        return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!TWEET_HOSTS.has(u.hostname.replace(/^www\./, ""))) return null;
    // /{user}/status/{id}, /i/status/{id}, /i/web/status/{id}, with
    // anything after (/photo/1, /video/1, a language suffix...).
    const m = u.pathname.match(/^\/(?:[^/]+\/|i\/web\/)?status(?:es)?\/(\d+)/);
    if (!m) return null;
    const api = `https://api.fxtwitter.com/2/status/${m[1]}`;
    const lang = u.pathname.slice(m[0].length).match(LANG_SEGMENT_RE)?.[1];
    return lang ? `${api}?lang=${lang.toLowerCase()}` : api;
}

function str(v: unknown): string | undefined {
    return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function count(v: unknown): number | null {
    const n = num(v);
    return n !== undefined && n >= 0 ? n : null;
}

/** `v` if it is an https URL, else undefined. */
export function httpsUrl(v: unknown): string | undefined {
    const s = str(v);
    if (!s) return undefined;
    try {
        return new URL(s).protocol === "https:" ? s : undefined;
    } catch {
        return undefined;
    }
}

function obj(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

// URLs, @mentions and #hashtags in tweet text. A mention or hashtag must not
// follow a word character (or `/`, `&` for URL fragments and entities); the
// preceding character is captured rather than looked behind for, as older
// WebViews lack lookbehind.
const TOKEN_RE =
    /(https?:\/\/[^\s<>"]+)|(^|[^\p{L}\p{N}_@/&])@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_@])|(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;
// Punctuation that ends a sentence, not the URL before it.
const URL_TRAIL_RE = /[.,;:!?'")\]}]+$/;

/**
 * Split tweet text into plain text and links. `displayFor` maps an expanded
 * URL to the shortened form Twitter shows for it (from the url facets).
 */
export function tweetSegments(
    text: string,
    displayFor: Map<string, string> = new Map(),
): TweetSegment[] {
    const out: TweetSegment[] = [];
    let last = 0;
    const pushText = (s: string) => {
        if (!s) return;
        const prev = out[out.length - 1];
        if (prev?.kind === "text") prev.text += s;
        else out.push({ kind: "text", text: s });
    };
    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(text))) {
        if (m[1]) {
            let href = m[1];
            const trail = href.match(URL_TRAIL_RE)?.[0] ?? "";
            // Keep a closing paren that closes one inside the URL.
            let cut = trail.length;
            if (
                trail.startsWith(")") &&
                (href.match(/\(/g)?.length ?? 0) >
                    (href.slice(0, href.length - trail.length).match(/\)/g)
                        ?.length ?? 0)
            ) {
                cut = trail.length - 1;
            }
            href = href.slice(0, href.length - cut);
            pushText(text.slice(last, m.index));
            out.push({
                kind: "link",
                text: displayFor.get(href) ?? href,
                href,
            });
            last = m.index + href.length;
            TOKEN_RE.lastIndex = last;
        } else if (m[3] !== undefined) {
            pushText(text.slice(last, m.index) + m[2]);
            out.push({
                kind: "link",
                text: `@${m[3]}`,
                href: `https://x.com/${m[3]}`,
            });
            last = m.index + m[0].length;
        } else if (m[5] !== undefined) {
            pushText(text.slice(last, m.index) + m[4]);
            out.push({
                kind: "link",
                text: `#${m[5]}`,
                href: `https://x.com/hashtag/${encodeURIComponent(m[5])}`,
            });
            last = m.index + m[0].length;
        }
    }
    pushText(text.slice(last));
    return out;
}

function urlDisplays(rawText: unknown): Map<string, string> {
    const map = new Map<string, string>();
    const facets = obj(rawText)?.facets;
    if (!Array.isArray(facets)) return map;
    for (const f of facets) {
        const facet = obj(f);
        if (facet?.type !== "url") continue;
        const href = str(facet.replacement);
        const display = str(facet.display);
        if (href && display) map.set(href, display);
    }
    return map;
}

function parseMediaItem(v: unknown): TweetMedia | null {
    const m = obj(v);
    if (!m) return null;
    const url = httpsUrl(m.url);
    if (!url) return null;
    const type = str(m.type);
    if (type !== "photo" && type !== "video" && type !== "gif") return null;
    const thumbnail = httpsUrl(m.thumbnail_url);
    // A GIF arrives as a video (an mp4 with a poster); a "gif" with no
    // poster or duration is an image.
    const kind: TweetMedia["kind"] =
        type === "video"
            ? "video"
            : type === "gif" && (thumbnail !== undefined || "duration" in m)
              ? "gif"
              : "photo";
    return {
        kind,
        url,
        width: num(m.width),
        height: num(m.height),
        thumbnail,
        alt: str(m.altText) || undefined,
    };
}

function parseMedia(v: unknown): TweetMedia[] {
    const media = obj(v);
    if (!media) return [];
    // `all` is in posted order; older responses only have the split lists.
    const list = Array.isArray(media.all)
        ? media.all
        : [
              ...(Array.isArray(media.videos) ? media.videos : []),
              ...(Array.isArray(media.photos) ? media.photos : []),
          ];
    return list
        .map(parseMediaItem)
        .filter((x): x is TweetMedia => x !== null)
        .slice(0, 4);
}

function parsePoll(v: unknown): TweetPoll | null {
    const p = obj(v);
    if (!p || !Array.isArray(p.choices)) return null;
    const choices = p.choices
        .map((c) => {
            const choice = obj(c);
            const label = str(choice?.label);
            if (!choice || label === undefined) return null;
            const pct = num(choice.percentage) ?? 0;
            return { label, percentage: Math.max(0, Math.min(100, pct)) };
        })
        .filter((c): c is TweetPoll["choices"][number] => c !== null);
    if (choices.length === 0) return null;
    const ends = Date.parse(str(p.ends_at) ?? "");
    return {
        choices,
        totalVotes: count(p.total_votes) ?? 0,
        endsAt: Number.isFinite(ends) ? ends : null,
    };
}

function parseTranslation(
    v: unknown,
    original: string,
): TweetTranslation | null {
    const tr = obj(v);
    const text = str(tr?.text)?.trim();
    const sourceLang = str(tr?.source_lang);
    // FxTwitter echoes the original when it is already in the target
    // language; nothing to show then.
    if (!tr || !text || !sourceLang || text === original) return null;
    if (str(tr.target_lang) === sourceLang) return null;
    return {
        sourceLang,
        sourceLangName: str(tr.source_lang_en) || undefined,
        text,
        segments: tweetSegments(text),
    };
}

function parseCreatedAt(s: Record<string, unknown>): number | null {
    const ts = num(s.created_timestamp);
    if (ts !== undefined) return ts * 1000;
    const parsed = Date.parse(str(s.created_at) ?? "");
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A tweet card from an FxTwitter status object (the `status` of a v2 status
 * response). `depth` stops a quote's own quote from being nested.
 */
export function parseFxStatus(v: unknown, depth = 0): TweetEmbed | null {
    const s = obj(v);
    if (!s || s.type === "tombstone") return null;
    const author = obj(s.author);
    const handle = str(author?.screen_name);
    const url = httpsUrl(s.url);
    if (!author || !handle || !url) return null;

    const text = (str(s.text) ?? "").trim();

    let quote: TweetEmbed["quote"] = null;
    const rawQuote = obj(s.quote);
    if (rawQuote && depth === 0) {
        if (rawQuote.type === "tombstone") {
            quote = {
                tombstone: str(rawQuote.message) ?? "",
                url: httpsUrl(rawQuote.url),
            };
        } else {
            quote = parseFxStatus(rawQuote, depth + 1);
        }
    }

    const reply = obj(s.replying_to);
    const replyHandle = str(reply?.screen_name);
    const replyingTo = replyHandle
        ? {
              handle: replyHandle,
              url:
                  httpsUrl(reply?.url) ??
                  httpsUrl(reply?.profile_url) ??
                  `https://x.com/${encodeURIComponent(replyHandle)}`,
          }
        : null;

    const note = obj(s.community_note);
    const noteText = str(note?.text)?.trim();

    return {
        url,
        authorName: str(author.name) || handle,
        authorHandle: handle,
        authorUrl:
            httpsUrl(author.url) ??
            `https://x.com/${encodeURIComponent(handle)}`,
        avatarUrl: httpsUrl(author.avatar_url),
        text,
        segments: tweetSegments(text, urlDisplays(s.raw_text)),
        media: parseMedia(s.media),
        replyingTo,
        poll: parsePoll(s.poll),
        quote,
        communityNote: noteText
            ? tweetSegments(noteText, urlDisplays(note))
            : null,
        translation: parseTranslation(s.translation, text),
        replies: count(s.replies),
        reposts: count(s.reposts),
        likes: count(s.likes),
        createdAt: parseCreatedAt(s),
    };
}

/** A v2 status API response body to a tweet card. */
export function parseFxStatusResponse(body: unknown): TweetEmbed | null {
    return parseFxStatus(obj(body)?.status);
}

/**
 * Twitter photo URL at a size fit for a card: `name=orig` is the full
 * upload, which a 512px grid cell doesn't need. The lightbox keeps `orig`.
 */
export function tweetPhotoThumb(url: string): string {
    try {
        const u = new URL(url);
        if (u.hostname !== "pbs.twimg.com") return url;
        u.searchParams.set("name", "medium");
        return u.toString();
    } catch {
        return url;
    }
}

/** "1.2K"-style count in the given locale. */
export function compactCount(n: number, locale?: string): string {
    try {
        return new Intl.NumberFormat(locale, {
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(n);
    } catch {
        return String(n);
    }
}
