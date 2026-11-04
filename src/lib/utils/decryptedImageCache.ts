// Decrypted images kept after their message unmounts, so switching rooms and
// back shows them at once instead of downloading and decrypting each again.
// Only the tile-sized copy (tileImage.ts) is kept, or the original when it is
// small enough to be its own tile; the full image is decrypted again only if
// the viewer is opened. Memory only, and cleared when a session starts
// (crypto.ts initCrypto), so a previous account's images don't outlive it.

/** Total bytes kept; least recently shown goes first. */
export const DECRYPTED_IMAGE_CACHE_BYTES = 48 * 1024 * 1024;
/** An original this size or under is kept as is when it has no tile copy. */
export const DECRYPTED_IMAGE_ORIGINAL_MAX = 1024 * 1024;

export interface CachedImage {
    blob: Blob;
    /** The blob is the original image, so the viewer can use it too. */
    isOriginal: boolean;
}

const cache = new Map<string, CachedImage>();
let bytes = 0;

/** The kept copy of the image at `mxc`, if any. */
export function cachedDecryptedImage(mxc: string): CachedImage | null {
    const hit = cache.get(mxc);
    if (!hit) return null;
    cache.delete(mxc); // refresh LRU position
    cache.set(mxc, hit);
    return hit;
}

export function cacheDecryptedImage(mxc: string, entry: CachedImage): void {
    if (entry.blob.size > DECRYPTED_IMAGE_CACHE_BYTES) return;
    const old = cache.get(mxc);
    if (old) {
        bytes -= old.blob.size;
        cache.delete(mxc);
    }
    cache.set(mxc, entry);
    bytes += entry.blob.size;
    for (const [key, value] of cache) {
        if (bytes <= DECRYPTED_IMAGE_CACHE_BYTES) break;
        cache.delete(key);
        bytes -= value.blob.size;
    }
}

export function clearDecryptedImageCache(): void {
    cache.clear();
    bytes = 0;
}
