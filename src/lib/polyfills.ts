// Runtime APIs newer than some Android System WebViews we still run on.
// @vitejs/plugin-legacy only polyfills its legacy (no-ESM) build, and an old
// Chromium WebView supports ES modules, so it gets the modern bundle bare.
// Import this first, before anything that might call these.

// Chrome 119. matrix-js-sdk uses it, among other places, in RustCrypto's
// onSyncCompleted: without it every sliding sync response throws there, so
// the crypto layer never sends a request and a new session never uploads
// its device keys (it can't be verified, and nobody encrypts for it).
if (typeof Promise.withResolvers !== "function") {
    Object.defineProperty(Promise, "withResolvers", {
        configurable: true,
        writable: true,
        value: function withResolvers<T>(): PromiseWithResolvers<T> {
            let resolve!: (value: T | PromiseLike<T>) => void;
            let reject!: (reason?: unknown) => void;
            const promise = new Promise<T>((res, rej) => {
                resolve = res;
                reject = rej;
            });
            return { promise, resolve, reject };
        },
    });
}

// Chrome 103.
if (typeof AbortSignal !== "undefined" && !("timeout" in AbortSignal)) {
    Object.defineProperty(AbortSignal, "timeout", {
        configurable: true,
        writable: true,
        value: function timeout(ms: number): AbortSignal {
            const controller = new AbortController();
            setTimeout(
                () =>
                    controller.abort(
                        new DOMException("signal timed out", "TimeoutError"),
                    ),
                ms,
            );
            return controller.signal;
        },
    });
}

export {};
