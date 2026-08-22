/**
 * A bounded, string-keyed LRU memo. Insertion-order eviction with
 * move-to-newest on read, backed by a plain Map (Maps preserve insertion
 * order). Generic and pure — the caller owns the key and the compute fn.
 *
 * Used to cache per-message HTML render passes across a room switch, which
 * unmounts and re-mounts N MessageItem rows. The cache MUST live at module
 * scope to survive that remount, and the key MUST carry every input that can
 * change the output (see MessageItem's sanitize/withTwemoji wiring).
 */
export interface LruMemo<V> {
    get(key: string, compute: () => V): V;
    clear(): void;
    readonly size: number;
}

export function createLruMemo<V>(max: number): LruMemo<V> {
    const store = new Map<string, V>();
    return {
        get(key, compute) {
            if (store.has(key)) {
                // Re-insert so the key is newest (LRU recency).
                const value = store.get(key) as V;
                store.delete(key);
                store.set(key, value);
                return value;
            }
            const value = compute();
            store.set(key, value);
            if (store.size > max) {
                const oldest = store.keys().next().value;
                if (oldest !== undefined) store.delete(oldest);
            }
            return value;
        },
        clear() {
            store.clear();
        },
        get size() {
            return store.size;
        },
    };
}
