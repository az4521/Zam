/**
 * On-device storage for the noise filter model (DeepFilterNet3's wasm):
 *  - Android and desktop ship them inside the app (Capacitor and Electron
 *    serve the bundled build), so they are read from disk.
 *  - The web / PWA keeps them in their own Cache Storage cache. Not the
 *    service worker's shell cache, which is per version and wiped on every
 *    deploy; a model file only changes when its package does, so it survives
 *    deploys and is re-fetched only when its content hash changes. The
 *    service worker leaves these files alone (swCacheRouting) so they are not
 *    stored twice.
 * Works in a Worker too (Cache Storage is available there), so nothing here
 * touches the page: callers pass `useCache` (!modelIsBundled(), from
 * $lib/audio/modelBundled).
 */

/** Survives deploys: holds only the current version of each model file,
 *  keyed by its content-hashed URL. */
export const MODEL_CACHE_NAME = "zam-models-v1";

/** "df_bg" for ".../df_bg.Ab12Cd.wasm": versions of one file share it. */
function stem(url: string): string {
    const name = new URL(url).pathname.split("/").pop() ?? "";
    return name.split(".")[0];
}

/** "\0asm": a missing file can come back as the SPA's index.html with a 200. */
export function isWasm(bytes: ArrayBuffer): boolean {
    const b = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    return b[0] === 0 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d;
}

export interface ModelAsset {
    url: string;
    label: string;
    isValid: (bytes: ArrayBuffer) => boolean;
}

async function download(asset: ModelAsset): Promise<ArrayBuffer> {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error(`${asset.label}: HTTP ${res.status}`);
    const bytes = await res.arrayBuffer();
    if (!asset.isValid(bytes))
        throw new Error(`${asset.label}: not the expected file`);
    return bytes;
}

async function openModelCache(useCache: boolean): Promise<Cache | null> {
    if (!useCache || typeof caches === "undefined") return null;
    try {
        return await caches.open(MODEL_CACHE_NAME);
    } catch {
        return null; // storage blocked (private mode, disabled site data)
    }
}

/** The asset's bytes: from disk (bundled), the model cache, or the network
 *  (then stored). Drops older versions of the same file from the cache. */
export async function modelAssetBytes(
    asset: ModelAsset,
    useCache: boolean,
): Promise<ArrayBuffer> {
    const cache = await openModelCache(useCache);
    if (!cache) return download(asset);
    const hit = await cache.match(asset.url).catch(() => undefined);
    if (hit?.ok) {
        const bytes = await hit.arrayBuffer();
        if (asset.isValid(bytes)) return bytes;
    }
    const bytes = await download(asset);
    try {
        await cache.put(
            asset.url,
            new Response(bytes.slice(0), {
                headers: { "Content-Type": "application/octet-stream" },
            }),
        );
        const mine = stem(asset.url);
        for (const req of await cache.keys())
            if (req.url !== asset.url && stem(req.url) === mine)
                await cache.delete(req);
    } catch {
        /* quota or blocked storage: still usable this session */
    }
    return bytes;
}

/** Whether the asset is already in the model cache (always false without
 *  `useCache` or with storage blocked). */
export async function modelAssetCached(
    url: string,
    useCache: boolean,
): Promise<boolean> {
    const cache = await openModelCache(useCache);
    if (!cache) return false;
    return !!(await cache.match(url).catch(() => undefined));
}
