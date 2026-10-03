import type { SlidingSync } from "matrix-js-sdk/lib/sliding-sync";

/**
 * Keep a SlidingSync loop running after it crashes.
 *
 * SlidingSync.start() runs every RoomData and Lifecycle listener synchronously
 * inside its loop, outside its own try/catch, so one listener that throws
 * (ours, the SDK's, or anything downstream of a ClientEvent.Sync emit) rejects
 * start(), and the SDK only logs that: sync stops for good and the app sits on
 * "Reconnecting" until it is restarted, which resend() and the stuck-sync
 * watchdog can't fix. This wraps start() so a crashed loop restarts on a fresh
 * connection (resetup re-sends the lists and room subscriptions; the new loop
 * starts with no pos), backing off in case the same response keeps crashing it.
 */
export function keepSlidingSyncAlive(
    sliding: SlidingSync,
    onCrash: (err: unknown, retryInMs: number) => void,
    { initialBackoffMs = 1000, maxBackoffMs = 30_000 } = {},
): void {
    // Both members are private in the SDK's typings but plain JS at runtime.
    const internals = sliding as unknown as {
        terminated?: boolean;
        resetup(): void;
    };
    const isTerminated = () => !!internals.terminated;
    const startLoop = sliding.start.bind(sliding);
    sliding.start = async () => {
        let backoffMs = initialBackoffMs;
        for (;;) {
            try {
                await startLoop();
                return; // stop() was called
            } catch (err) {
                if (isTerminated()) return;
                onCrash(err, backoffMs);
                await new Promise((r) => setTimeout(r, backoffMs));
                backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
                if (isTerminated()) return;
                internals.resetup();
            }
        }
    };
}
