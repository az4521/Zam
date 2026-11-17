// Pure YouTube link helpers: no SDK, no DOM. LinkPreview.svelte builds its
// player and title from these.

export interface YoutubeLink {
    id: string;
    /** seconds, 0 if none */
    start: number;
    short: boolean;
}

export interface YoutubeOembedMeta {
    title: string;
    author: string | null;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
]);
// Path kinds whose video id is the segment right after them.
const ID_PATH_KINDS = new Set(["shorts", "live", "embed", "v"]);

/**
 * Parses a `t` / `start` value: plain seconds ("90"), or "90s", "2m", "1h2m3s".
 * Anything else is 0.
 */
export function parseStartTime(raw: string | null): number {
    if (!raw) return 0;
    const s = raw.trim().toLowerCase();
    if (/^\d+$/.test(s)) return Number(s);
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
    if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined))
        return 0;
    return (
        Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
    );
}

/** The video id, start offset and shortness of a YouTube URL, or null. */
export function parseYoutubeUrl(raw: string): YoutubeLink | null {
    let u: URL;
    try {
        u = new URL(raw.trim());
    } catch {
        return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const segments = u.pathname.split("/").filter((s) => s !== "");

    let id: string | null = null;
    let short = false;
    if (host === "youtu.be") {
        id = segments[0] ?? null;
    } else if (WATCH_HOSTS.has(host)) {
        const first = segments[0];
        if (first === "watch") {
            id = u.searchParams.get("v");
        } else if (first !== undefined && ID_PATH_KINDS.has(first)) {
            id = segments[1] ?? null;
            short = first === "shorts";
        }
    } else {
        return null;
    }
    if (!id || !VIDEO_ID.test(id)) return null;

    const start =
        parseStartTime(u.searchParams.get("t")) ||
        parseStartTime(u.searchParams.get("start"));
    return { id, start, short };
}

export function youtubeWatchUrl(id: string): string {
    return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeOembedUrl(watchUrl: string): string {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`;
}

/** Title and channel name from a YouTube oEmbed response, or null if unusable. */
export function parseOembedTitle(json: unknown): YoutubeOembedMeta | null {
    if (!json || typeof json !== "object") return null;
    const o = json as { title?: unknown; author_name?: unknown };
    if (typeof o.title !== "string") return null;
    const title = o.title.trim();
    if (!title) return null;
    const author =
        typeof o.author_name === "string" && o.author_name.trim()
            ? o.author_name.trim()
            : null;
    return { title, author };
}
