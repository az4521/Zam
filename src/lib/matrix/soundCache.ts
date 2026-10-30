/**
 * On-device cache for soundboard files, so a sound is downloaded once and
 * every later play comes from disk. Media is addressed by its mxc URI and
 * never changes, so an entry is valid for as long as it is kept.
 *
 * Cache Storage, in a cache of its own: the service worker only prunes its
 * `zam-shell-*` caches. Entries are keyed by synthetic URLs on a reserved
 * host, since the Cache API wants http(s) requests and the origin of the app
 * itself is not always one (Electron, Capacitor). Nothing here ever fetches
 * them. Without Cache Storage (blocked site data) every call quietly does
 * nothing and the caller keeps its in-memory copy.
 */
import {
    SOUND_CACHE_MAX_BYTES,
    SOUND_CACHE_MAX_ENTRIES,
    parseSoundCacheIndex,
    planSoundCacheEviction,
    type SoundCacheIndex,
} from "$lib/utils/soundCachePlan";

export const SOUND_CACHE_NAME = "zam-soundboard-v1";
const HOST = "https://soundboard.invalid/";
const INDEX_REQUEST = new Request(`${HOST}__index`);

const entryRequest = (mxcUrl: string) =>
    new Request(`${HOST}${encodeURIComponent(mxcUrl)}`);

async function openCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return null;
    try {
        return await caches.open(SOUND_CACHE_NAME);
    } catch {
        return null; // storage blocked (private mode, disabled site data)
    }
}

async function readIndex(cache: Cache): Promise<SoundCacheIndex> {
    try {
        const res = await cache.match(INDEX_REQUEST);
        return res ? parseSoundCacheIndex(await res.json()) : {};
    } catch {
        return {};
    }
}

async function writeIndex(cache: Cache, index: SoundCacheIndex): Promise<void> {
    await cache.put(
        INDEX_REQUEST,
        new Response(JSON.stringify(index), {
            headers: { "content-type": "application/json" },
        }),
    );
}

// Index updates are read-modify-write; run them one at a time.
let indexChain: Promise<unknown> = Promise.resolve();
function withIndex(
    cache: Cache,
    edit: (index: SoundCacheIndex) => void | Promise<void>,
): Promise<void> {
    const run = indexChain.then(async () => {
        const index = await readIndex(cache);
        await edit(index);
        await writeIndex(cache, index);
    });
    indexChain = run.catch(() => {});
    return run.catch(() => {});
}

/** The cached file, or null. A hit counts as a use for eviction. */
export async function getCachedSound(
    mxcUrl: string,
): Promise<ArrayBuffer | null> {
    const cache = await openCache();
    if (!cache) return null;
    try {
        const res = await cache.match(entryRequest(mxcUrl));
        if (!res) return null;
        const bytes = await res.arrayBuffer();
        void withIndex(cache, (index) => {
            index[mxcUrl] = { size: bytes.byteLength, used: Date.now() };
        });
        return bytes;
    } catch {
        return null;
    }
}

/** Store a downloaded file, dropping the least recently used to stay inside
 *  the limits. Failures (quota, blocked storage) are ignored. */
export async function putCachedSound(
    mxcUrl: string,
    bytes: ArrayBuffer,
): Promise<void> {
    const cache = await openCache();
    if (!cache) return;
    try {
        await cache.put(
            entryRequest(mxcUrl),
            new Response(bytes, {
                headers: { "content-type": "application/octet-stream" },
            }),
        );
    } catch {
        return;
    }
    await withIndex(cache, async (index) => {
        index[mxcUrl] = { size: bytes.byteLength, used: Date.now() };
        for (const key of planSoundCacheEviction(
            index,
            SOUND_CACHE_MAX_BYTES,
            SOUND_CACHE_MAX_ENTRIES,
            mxcUrl,
        )) {
            delete index[key];
            await cache.delete(entryRequest(key)).catch(() => false);
        }
    });
}

/** Forget a file, e.g. one that turned out not to decode. */
export async function deleteCachedSound(mxcUrl: string): Promise<void> {
    const cache = await openCache();
    if (!cache) return;
    await cache.delete(entryRequest(mxcUrl)).catch(() => false);
    await withIndex(cache, (index) => {
        delete index[mxcUrl];
    });
}

/** Empty the cache. */
export async function clearSoundCache(): Promise<void> {
    if (typeof caches === "undefined") return;
    try {
        await caches.delete(SOUND_CACHE_NAME);
    } catch {
        /* nothing to clear */
    }
}
