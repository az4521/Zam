// src/lib/utils/asyncWorkTracker.ts
/**
 * Counts the asynchronous work a class's methods have started and not yet
 * finished, across every instance and caller, by wrapping the methods on its
 * prototype once. Used to know when the crypto engine has really stopped
 * writing (matrix/cryptoActivity.ts), which matrix-js-sdk doesn't expose.
 */

export interface AsyncWorkTracker {
    /** Work started through a wrapped method and not yet settled. */
    inFlight(): number;
    /**
     * Resolves true once nothing is in flight, or false if that hasn't
     * happened within `timeoutMs`.
     */
    waitForIdle(timeoutMs: number): Promise<boolean>;
}

export function createAsyncWorkTracker(): AsyncWorkTracker & {
    /**
     * Wrap every plain method on `proto` (not getters, not the constructor,
     * not `skip`) so a returned promise counts as in flight until it settles.
     * Synchronous results and throws pass through untouched. Idempotent per
     * prototype.
     */
    track(proto: object, skip?: readonly string[]): void;
} {
    let count = 0;
    const waiters = new Set<() => void>();
    const tracked = new WeakSet<object>();

    const settle = () => {
        count--;
        if (count === 0) {
            for (const wake of [...waiters]) wake();
        }
    };

    return {
        inFlight: () => count,
        waitForIdle(timeoutMs) {
            if (count === 0) return Promise.resolve(true);
            return new Promise<boolean>((resolve) => {
                const done = (idle: boolean) => {
                    clearTimeout(timer);
                    waiters.delete(wake);
                    resolve(idle);
                };
                const wake = () => done(true);
                const timer = setTimeout(() => done(false), timeoutMs);
                waiters.add(wake);
            });
        },
        track(proto, skip = []) {
            if (tracked.has(proto)) return;
            tracked.add(proto);
            for (const name of Object.getOwnPropertyNames(proto)) {
                if (name === "constructor" || skip.includes(name)) continue;
                const desc = Object.getOwnPropertyDescriptor(proto, name);
                if (!desc || typeof desc.value !== "function") continue;
                const original = desc.value as (...args: unknown[]) => unknown;
                Object.defineProperty(proto, name, {
                    ...desc,
                    value: function (this: unknown, ...args: unknown[]) {
                        const result = original.apply(this, args);
                        if (
                            result &&
                            typeof (result as { then?: unknown }).then ===
                                "function"
                        ) {
                            count++;
                            (result as Promise<unknown>).then(settle, settle);
                        }
                        return result;
                    },
                });
            }
        },
    };
}
