// Runtime APIs newer than the oldest engines we run on: iOS 15 Safari and
// older Android System WebViews. @vitejs/plugin-legacy only polyfills its
// legacy (no-ESM) build, and both of those support ES modules, so they get
// the modern bundle bare (SvelteKit has no index.html for the plugin to put
// its modern polyfills in). Syntax is already lowered by the build target;
// this covers built-ins. Import it first, before anything that calls them.
//
// Safari 15.4: matrix-js-sdk and our code use these.
import "core-js/actual/array/at";
import "core-js/actual/array/find-last";
import "core-js/actual/array/find-last-index";
import "core-js/actual/typed-array/at";
import "core-js/actual/string/at";
import "core-js/actual/object/has-own";
import "core-js/actual/structured-clone";

// Safari 15.4; not in core-js. The SDK's VoIP and LiveKit call it. Any
// RFC 4122 v4 id built from crypto.getRandomValues will do.
if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID !== "function" &&
    typeof crypto.getRandomValues === "function"
) {
    Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        writable: true,
        value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
            const b = crypto.getRandomValues(new Uint8Array(16));
            b[6] = (b[6] & 0x0f) | 0x40;
            b[8] = (b[8] & 0x3f) | 0x80;
            const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
            return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
        },
    });
}

// Chrome 119, Safari 17.4. matrix-js-sdk uses it, among other places, in RustCrypto's
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

// Chrome 98 / Safari 15.4: abort(reason) and signal.reason. Older engines
// ignore the argument, so whatever reads `reason` (p-retry, our timeouts)
// gets undefined instead of the error it was aborted with.
if (
    typeof AbortController !== "undefined" &&
    !("reason" in AbortSignal.prototype)
) {
    const abort = AbortController.prototype.abort;
    Object.defineProperty(AbortController.prototype, "abort", {
        configurable: true,
        writable: true,
        value: function (this: AbortController, reason?: unknown) {
            if (!this.signal.aborted) {
                Object.defineProperty(this.signal, "reason", {
                    configurable: true,
                    value:
                        reason === undefined
                            ? new DOMException(
                                  "signal is aborted without reason",
                                  "AbortError",
                              )
                            : reason,
                });
            }
            abort.call(this);
        },
    });
}

// Chrome 100 / Safari 15.4.
if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.prototype.throwIfAborted !== "function"
) {
    Object.defineProperty(AbortSignal.prototype, "throwIfAborted", {
        configurable: true,
        writable: true,
        value: function (this: AbortSignal) {
            if (this.aborted) {
                throw (
                    this.reason ??
                    new DOMException(
                        "signal is aborted without reason",
                        "AbortError",
                    )
                );
            }
        },
    });
}

// Chrome 103, Safari 16.
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
