// A bounded cache of blob URLs keyed by what they were made from. Blobs live
// in the browser process until their URL is revoked, so a cache that only
// forgets them holds every image it ever made for the life of the page.
// Evicting revokes, but never a URL something still shows: a component holds
// the URL while it uses it (hold), and `inUse` covers users that can't, like
// an <img> the media healer swapped a URL into.

export class BlobUrlCache {
    private entries = new Map<string, Promise<string | null>>();
    /** Resolved URL per key, once its promise settles with one. */
    private urls = new Map<string, string>();
    private holds = new Map<string, number>();
    /** Keys whose promise has settled (with a URL or null). */
    private settled = new Set<string>();

    constructor(
        private readonly max: number,
        private readonly inUse: (url: string) => boolean = () => false,
        private readonly revoke: (url: string) => void = (url) =>
            URL.revokeObjectURL(url),
    ) {}

    get size(): number {
        return this.entries.size;
    }

    /** The entry for `key`, made with `make` when absent. A null result
     *  ("nothing to make") is kept; a rejection is not, so a later call tries
     *  again. */
    get(
        key: string,
        make: () => Promise<string | null>,
    ): Promise<string | null> {
        const hit = this.entries.get(key);
        if (hit) {
            this.entries.delete(key); // refresh LRU position
            this.entries.set(key, hit);
            return hit;
        }
        const p = make().then(
            (url) => {
                if (url) this.urls.set(key, url);
                this.settled.add(key);
                // Not this one: its caller hasn't had the chance to hold it.
                this.evict(key);
                return url;
            },
            (err) => {
                if (this.entries.get(key) === p) this.entries.delete(key);
                throw err;
            },
        );
        this.entries.set(key, p);
        return p;
    }

    /** Keep `url` from being revoked until the returned release is called. */
    hold(url: string | null | undefined): () => void {
        if (!url) return () => {};
        this.holds.set(url, (this.holds.get(url) ?? 0) + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const n = (this.holds.get(url) ?? 1) - 1;
            if (n > 0) this.holds.set(url, n);
            else this.holds.delete(url);
            this.evict();
        };
    }

    private held(url: string): boolean {
        return this.holds.has(url) || this.inUse(url);
    }

    private evict(spare?: string): void {
        if (this.entries.size <= this.max) return;
        for (const key of [...this.entries.keys()]) {
            if (this.entries.size <= this.max) break;
            if (key === spare) continue;
            const url = this.urls.get(key);
            if (url && this.held(url)) continue; // on screen
            if (!url && !this.settled.has(key)) continue; // still being made
            this.entries.delete(key);
            this.urls.delete(key);
            this.settled.delete(key);
            if (url) this.revoke(url);
        }
    }
}
