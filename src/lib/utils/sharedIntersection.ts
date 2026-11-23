/**
 * One IntersectionObserver per (root, rootMargin) pair, shared by every
 * target observed with it. A picker with 200 tiles then costs one observer,
 * not 200. The observer is disconnected when its last target leaves.
 */

type Listener = (entry: IntersectionObserverEntry) => void;

interface Pool {
    io: IntersectionObserver;
    listeners: Map<Element, Listener>;
}

// rootMargin -> root (null = viewport) -> pool
const pools = new Map<string, Map<Element | null, Pool>>();

/** Observe `target` through the shared observer for `root`/`rootMargin`.
 *  Returns the unobserve function, which is idempotent. */
export function observeShared(
    target: Element,
    root: Element | null,
    rootMargin: string,
    listener: Listener,
): () => void {
    let byRoot = pools.get(rootMargin);
    if (!byRoot) {
        byRoot = new Map();
        pools.set(rootMargin, byRoot);
    }
    let pool = byRoot.get(root);
    if (!pool) {
        const listeners = new Map<Element, Listener>();
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    listeners.get(entry.target)?.(entry);
                }
            },
            { root, rootMargin, threshold: 0 },
        );
        pool = { io, listeners };
        byRoot.set(root, pool);
    }
    const owned = pool;
    owned.listeners.set(target, listener);
    owned.io.observe(target);

    let done = false;
    return () => {
        if (done) return;
        done = true;
        owned.io.unobserve(target);
        owned.listeners.delete(target);
        if (owned.listeners.size > 0) return;
        owned.io.disconnect();
        if (byRoot.get(root) === owned) byRoot.delete(root);
        if (byRoot.size === 0 && pools.get(rootMargin) === byRoot) {
            pools.delete(rootMargin);
        }
    };
}
