// Fetches the pictures that rich presence refers to (a game's icon, an album
// cover) so the page can put them on the homeserver as Matrix media. Discord
// activities name an image in one of a few ways, and only these hosts are ever
// contacted, whatever an app asks for:
//
//   cdn.discordapp.com    app icons and assets registered with Discord
//   media.discordapp.net  pictures Discord proxies from elsewhere ("mp:...")
//   i.scdn.co             Spotify covers ("spotify:...")
//
// Arbitrary URLs from apps are refused: a local app could otherwise point
// this at an address inside the user's network.

const ALLOWED_HOSTS = new Set([
    "cdn.discordapp.com",
    "media.discordapp.net",
    "i.scdn.co",
]);
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const ASSET_LIST_TTL_MS = 10 * 60 * 1000;

// `exeIcon(gameId)` gives { type, data } for a game the user added by hand
// (the icon of its executable), or null. It is also the fallback when an
// "icon:" reference cannot be fetched.
//
// Media players ("Listening to", app id media-<player>) are not Discord apps,
// so their pictures are not fetched at all: `mediaCover(ref)` gives the cover
// behind a "media:<player>:<hash>" reference and `mediaIcon(player)` the
// player's own icon for "media-icon:<player>". Both give { type, data } or null.
function createPresenceImages({
    fetch: doFetch = globalThis.fetch,
    exeIcon = async () => null,
    mediaCover = () => null,
    mediaIcon = async () => null,
} = {}) {
    const assetLists = new Map(); // app id -> { at, byName: Map }

    async function assetId(appId, name) {
        let list = assetLists.get(appId);
        if (!list || Date.now() - list.at > ASSET_LIST_TTL_MS) {
            const res = await doFetch(
                `https://discord.com/api/v10/oauth2/applications/${appId}/assets`,
                { signal: AbortSignal.timeout(TIMEOUT_MS) },
            );
            if (!res.ok) return null;
            const byName = new Map();
            for (const a of await res.json()) {
                if (typeof a?.name === "string" && typeof a?.id === "string")
                    byName.set(a.name, a.id);
            }
            list = { at: Date.now(), byName };
            assetLists.set(appId, list);
        }
        return list.byName.get(name) ?? null;
    }

    /** The URL an image reference stands for, or null if it is not one we fetch. */
    async function resolve(appId, ref) {
        if (typeof ref !== "string" || !ref || ref.length > 1024) return null;
        if (!/^\d{1,25}$/.test(appId)) return null;

        const icon = /^icon:([0-9a-f]{8,64})$/i.exec(ref);
        if (icon)
            return `https://cdn.discordapp.com/app-icons/${appId}/${icon[1]}.png?size=256`;

        if (ref.startsWith("mp:")) {
            const rest = ref.slice(3);
            if (/\.\.|[\s\\?#]/.test(rest)) return null;
            return `https://media.discordapp.net/${rest}`;
        }

        const spotify = /^spotify:([A-Za-z0-9]{8,64})$/.exec(ref);
        if (spotify) return `https://i.scdn.co/image/${spotify[1]}`;

        if (/^https:\/\//i.test(ref)) {
            try {
                return ALLOWED_HOSTS.has(new URL(ref).hostname) ? ref : null;
            } catch {
                return null;
            }
        }
        if (/^[a-z]+:/i.test(ref)) return null; // youtube:, twitch:, ...

        // An asset registered with the application: a name, or its id.
        const id = /^\d{5,25}$/.test(ref) ? ref : await assetId(appId, ref);
        return id
            ? `https://cdn.discordapp.com/app-assets/${appId}/${id}.png?size=256`
            : null;
    }

    /** { type, data } for the image, or null if it is unavailable or unsuitable. */
    async function fetchImage(appId, ref) {
        try {
            if (ref === "exe-icon") return await exeIcon(String(appId));
            // Before resolve(): these app ids are not numeric.
            if (typeof ref === "string" && ref.startsWith("media:")) {
                const m = /^media:(.+):[0-9a-f]{12}$/.exec(ref);
                if (!m || String(appId) !== `media-${m[1]}`) return null;
                return (await mediaCover(ref)) ?? null;
            }
            if (typeof ref === "string" && ref.startsWith("media-icon:")) {
                const player = ref.slice("media-icon:".length);
                if (!player || String(appId) !== `media-${player}`) return null;
                return (await mediaIcon(player)) ?? null;
            }
            const url = await resolve(String(appId), ref);
            if (!url) return null;
            const image = await download(url);
            // An app's own icon that is missing or refused: the game's
            // executable icon, when the game is known.
            if (!image && /^icon:/.test(ref))
                return (await exeIcon(String(appId))) ?? null;
            return image;
        } catch {
            return null;
        }
    }

    /** { type, data } for an image URL on an allowed host, or null. */
    async function download(url) {
        try {
            const res = await doFetch(url, {
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) return null;
            // Redirects are followed, so check where it ended up.
            if (res.url && !ALLOWED_HOSTS.has(new URL(res.url).hostname))
                return null;
            const type = (res.headers.get("content-type") ?? "")
                .split(";")[0]
                .trim()
                .toLowerCase();
            if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) return null;
            const declared = Number(res.headers.get("content-length"));
            if (declared > MAX_BYTES) return null;
            const data = new Uint8Array(await res.arrayBuffer());
            if (data.length === 0 || data.length > MAX_BYTES) return null;
            return { type, data };
        } catch {
            return null;
        }
    }

    return { fetchImage, resolve };
}

module.exports = { createPresenceImages };
