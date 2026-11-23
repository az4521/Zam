/**
 * Size caps for module-level caches that only grow. Both rely on the
 * insertion order of Map and Set: the first key is the oldest.
 */

/**
 * Set `key` (moving it to the newest position) and evict the oldest entries
 * until the map holds at most `max`.
 */
export function setBounded<K, V>(
    map: Map<K, V>,
    key: K,
    value: V,
    max: number,
): void {
    map.delete(key);
    map.set(key, value);
    trimMapOldest(map, max);
}

/** Evict the oldest entries until the map holds at most `max`. */
export function trimMapOldest<K, V>(map: Map<K, V>, max: number): void {
    for (const key of map.keys()) {
        if (map.size <= max) break;
        map.delete(key);
    }
}

/** Evict the oldest members until the set holds at most `max`. */
export function trimSetOldest<T>(set: Set<T>, max: number): void {
    for (const value of set) {
        if (set.size <= max) break;
        set.delete(value);
    }
}
