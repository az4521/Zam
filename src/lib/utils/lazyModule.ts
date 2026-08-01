/** A module loaded on first real use instead of at import time.
 *
 *  Two rules earn this its own file: the loader runs at most once for any
 *  number of concurrent callers (so a burst of renders cannot fire N
 *  `import()`s), and a REJECTION is not cached — a chunk that failed to
 *  download because the network blinked must be retryable, or one bad
 *  fetch would disable calls or syntax highlighting until reload. */
export interface LazyModule<T> {
    /** The resolved module, or null if it has not finished loading. */
    peek(): T | null;
    /** Loads once. Concurrent callers share one in-flight promise. A
     *  rejection is NOT cached — the next call retries. */
    load(): Promise<T>;
}

export function lazyModule<T>(loader: () => Promise<T>): LazyModule<T> {
    let loaded: T | null = null;
    let inFlight: Promise<T> | null = null;

    return {
        peek: () => loaded,
        load: () => {
            // `!== null`, not truthiness: the generic is `T`, not
            // `T extends object`, so a module that resolves to a falsy value
            // must still count as loaded — otherwise the cache silently
            // disables itself and the loader runs on every single call.
            if (loaded !== null) return Promise.resolve(loaded);
            inFlight ??= loader().then(
                (mod) => {
                    loaded = mod;
                    inFlight = null;
                    return mod;
                },
                (err) => {
                    inFlight = null;
                    throw err;
                },
            );
            return inFlight;
        },
    };
}
