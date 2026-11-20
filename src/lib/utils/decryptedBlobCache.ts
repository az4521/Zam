// Decrypted media kept by its ciphertext mxc URL, so every view of one file
// shares one decrypt and one object URL: the inline image, its lightbox, and
// the room media panel. Memory only (cleared with the session, see clear()).
//
// Bounded by total bytes, least recently used first. Each entry owns exactly
// one object URL, made once. A view that shows the URL takes a hold with
// `hold()` / `get()` and calls `release()` when it stops showing it. Only
// entries with no holds are evicted, and eviction revokes their URL, so a
// mounted <img> is never handed a revoked URL. A blob bigger than the whole
// budget is held but never cached: its URL is revoked by its last release.

export const DECRYPTED_BLOB_CACHE_BYTES = 64 * 1024 * 1024;

export interface HeldBlob {
    /** Object URL for the blob. Valid until this hold is released. */
    readonly url: string;
    readonly blob: Blob;
    /** Drop this holder's claim on the URL. Calling it again does nothing. */
    release(): void;
}

interface Entry {
    blob: Blob;
    url: string;
    holds: number;
    /** Left the cache while held: its URL is revoked by the last release. */
    dropped: boolean;
}

export interface DecryptedBlobCacheOptions {
    maxBytes: number;
    createUrl: (blob: Blob) => string;
    revokeUrl: (url: string) => void;
}

export class DecryptedBlobCache {
    /** Insertion order is the LRU order: the least recently used comes first. */
    private readonly entries = new Map<string, Entry>();
    private bytes = 0;
    private readonly opts: DecryptedBlobCacheOptions;

    constructor(opts: DecryptedBlobCacheOptions) {
        this.opts = opts;
    }

    /** Total bytes of the cached blobs (held or not). */
    get totalBytes(): number {
        return this.bytes;
    }

    get size(): number {
        return this.entries.size;
    }

    /** A hold on the cached blob for `key`, or null when there is none. */
    get(key: string): HeldBlob | null {
        const e = this.entries.get(key);
        if (!e) return null;
        this.touch(key, e);
        return this.holdEntry(e);
    }

    /**
     * Hold `blob` under `key`, caching it. When `key` is already cached, the
     * cached blob is held instead and `blob` is ignored (same file, same bytes).
     */
    hold(key: string, blob: Blob): HeldBlob {
        const existing = this.entries.get(key);
        if (existing) {
            this.touch(key, existing);
            return this.holdEntry(existing);
        }
        const oversize = blob.size > this.opts.maxBytes;
        const e: Entry = {
            blob,
            url: this.opts.createUrl(blob),
            holds: 0,
            dropped: oversize,
        };
        if (!oversize) {
            this.entries.set(key, e);
            this.bytes += blob.size;
        }
        return this.holdEntry(e);
    }

    /** Cache `blob` under `key` without keeping a hold on it. */
    cache(key: string, blob: Blob): void {
        this.hold(key, blob).release();
    }

    /**
     * Forget everything (an account switch). Unheld URLs are revoked now; a
     * held one is revoked by its last release, so nothing on screen breaks.
     */
    clear(): void {
        for (const e of this.entries.values()) {
            if (e.holds === 0) this.opts.revokeUrl(e.url);
            else e.dropped = true;
        }
        this.entries.clear();
        this.bytes = 0;
    }

    private touch(key: string, e: Entry): void {
        this.entries.delete(key);
        this.entries.set(key, e);
    }

    private holdEntry(e: Entry): HeldBlob {
        e.holds++;
        let released = false;
        return {
            url: e.url,
            blob: e.blob,
            release: () => {
                if (released) return;
                released = true;
                e.holds--;
                if (e.holds === 0 && e.dropped) this.opts.revokeUrl(e.url);
                this.evict();
            },
        };
    }

    private evict(): void {
        if (this.bytes <= this.opts.maxBytes) return;
        for (const [key, e] of this.entries) {
            if (this.bytes <= this.opts.maxBytes) break;
            if (e.holds > 0) continue;
            this.entries.delete(key);
            this.bytes -= e.blob.size;
            this.opts.revokeUrl(e.url);
        }
    }
}

/** The app-wide cache of decrypted media, keyed by ciphertext mxc URL. */
export const decryptedBlobs = new DecryptedBlobCache({
    maxBytes: DECRYPTED_BLOB_CACHE_BYTES,
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
});
