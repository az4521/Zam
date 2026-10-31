// Direct embeds for GIF-site links, for homeservers whose URL preview can't get
// them: these sites only answer previewers with an allowed User-Agent, so most
// servers get nothing back. Each site reaches its media a different way:
//   - KLIPY: its public API, by slug (see utils/klipy).
//   - GIPHY: the id is in the page link and the CDN paths derive from it.
//   - Tenor: its APIs need a key, but <page>.gif redirects to the file, which
//     an <img> follows without needing CORS.
import {
    fetchKlipyEmbed,
    isKlipyLink,
    type KlipyEmbed,
} from "$lib/utils/klipy";

const GIF_HOSTS = ["klipy.com", "giphy.com", "tenor.com"];

const MEDIA_FILE_RE = /\.(gif|webp|jpe?g|png|mp4|webm)$/i;
const VIDEO_FILE_RE = /\.(mp4|webm)$/i;
// `/gifs/some-title-<id>`, `/gifs/<id>`, `/stickers/...` or `/embed/<id>`.
const GIPHY_PAGE_RE = /^\/(gifs|stickers|embed)\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/;
// A trailing word in a slug-only link isn't an id: real ids are long and mixed.
const GIPHY_ID_RE = /^(?=.*[A-Z0-9])[A-Za-z0-9]{10,}$/;
// `/view/<title>-<number>`, with an optional locale segment before it.
const TENOR_PAGE_RE =
    /^(?:\/[a-z]{2}(?:-[A-Za-z]{2})?)?\/view\/([^/]*-\d+)\/?$/;

function parseUrl(url: string | null | undefined): URL | null {
    if (!url) return null;
    try {
        return new URL(url);
    } catch {
        return null;
    }
}

const bareHost = (u: URL) => u.hostname.replace(/^www\./, "");

/** True for a host a GIF site itself runs: never a lookalike. */
export function isGifHostMediaUrl(url: string | null | undefined): boolean {
    const u = parseUrl(url);
    if (u?.protocol !== "https:") return false;
    return GIF_HOSTS.some(
        (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
}

function directFile(url: string): string | null {
    const u = parseUrl(url);
    return u && isGifHostMediaUrl(url) && MEDIA_FILE_RE.test(u.pathname)
        ? url
        : null;
}

function giphyEmbed(url: string): KlipyEmbed | null {
    const u = parseUrl(url);
    if (!u || bareHost(u) !== "giphy.com") return null;
    const m = u.pathname.match(GIPHY_PAGE_RE);
    if (!m || !GIPHY_ID_RE.test(m[2])) return null;
    const base = `https://media.giphy.com/media/${m[2]}`;
    const imageUrl = `${base}/giphy.webp`;
    // Stickers are transparent, which mp4 can't carry.
    return m[1] === "stickers"
        ? { imageUrl }
        : { videoUrl: `${base}/giphy.mp4`, imageUrl };
}

function tenorEmbed(url: string): KlipyEmbed | null {
    const u = parseUrl(url);
    if (!u || bareHost(u) !== "tenor.com") return null;
    const m = u.pathname.match(TENOR_PAGE_RE);
    return m ? { imageUrl: `https://tenor.com/view/${m[1]}.gif` } : null;
}

function localEmbed(url: string): KlipyEmbed | null {
    const file = directFile(url);
    if (file) {
        return VIDEO_FILE_RE.test(new URL(file).pathname)
            ? { videoUrl: file }
            : { imageUrl: file };
    }
    return giphyEmbed(url) ?? tenorEmbed(url);
}

/** Whether a message link is something fetchGifEmbed can resolve. */
export function isGifHostLink(url: string): boolean {
    return isKlipyLink(url) || !!localEmbed(url);
}

/** Resolve a GIF-site link to its media. Null when there is none to be had. */
export async function fetchGifEmbed(url: string): Promise<KlipyEmbed | null> {
    return isKlipyLink(url) ? fetchKlipyEmbed(url) : localEmbed(url);
}
