/**
 * Wraps a dynamic import so the first call starts it and every later call gets
 * the same promise, which keeps a reopened picker from waiting on the module
 * again. A failed load is forgotten so the next call retries it.
 */
export function lazyOnce<T>(load: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | null = null;
    return () => {
        pending ??= load().catch((err: unknown) => {
            pending = null;
            throw err;
        });
        return pending;
    };
}
