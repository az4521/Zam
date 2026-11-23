/**
 * Screen wake lock while a video call is on screen. Browsers release the lock
 * automatically when the page is hidden, so it is re-requested on return.
 * Voice-only calls do not call for a lock (the screen may sleep, as on Discord).
 */

export interface WakeLockSentinelLike {
    readonly released?: boolean;
    release(): Promise<void> | void;
    addEventListener?: (type: "release", listener: () => void) => void;
}

export interface WakeLockNavigatorLike {
    wakeLock?: {
        request(type: "screen"): Promise<WakeLockSentinelLike>;
    };
}

export interface WakeLockDocumentLike {
    readonly visibilityState: string;
    addEventListener(type: "visibilitychange", listener: () => void): void;
    removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface WakeLockController {
    /** Declare whether the screen should be kept awake. */
    setWanted(wanted: boolean): void;
    /** Release any held lock and stop listening. Safe to call more than once. */
    dispose(): void;
}

export function createWakeLockController(
    nav: WakeLockNavigatorLike = navigator,
    doc: WakeLockDocumentLike = document,
): WakeLockController {
    let wanted = false;
    let disposed = false;
    let pending = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const isVisible = (): boolean => doc.visibilityState === "visible";

    const shouldHold = (): boolean => !disposed && wanted && isVisible();

    function releaseHeld(): void {
        const held = sentinel;
        sentinel = null;
        if (!held) return;
        try {
            const result = held.release();
            if (
                result &&
                typeof (result as Promise<void>).catch === "function"
            ) {
                (result as Promise<void>).catch(() => {});
            }
        } catch {
            // Already released by the browser; nothing to do.
        }
    }

    function acquire(): void {
        if (!nav.wakeLock || pending) return;
        pending = true;
        let request: Promise<WakeLockSentinelLike>;
        try {
            request = nav.wakeLock.request("screen");
        } catch {
            pending = false;
            return;
        }
        request.then(
            (lock) => {
                pending = false;
                if (!shouldHold()) {
                    // Wanted state changed while the request was in flight.
                    try {
                        const result = lock.release();
                        if (
                            result &&
                            typeof (result as Promise<void>).catch ===
                                "function"
                        ) {
                            (result as Promise<void>).catch(() => {});
                        }
                    } catch {
                        // ignore
                    }
                    return;
                }
                sentinel = lock;
                lock.addEventListener?.("release", () => {
                    if (sentinel === lock) sentinel = null;
                });
            },
            () => {
                // Denied, unsupported, or document not active: stay silent.
                pending = false;
            },
        );
    }

    function sync(): void {
        if (shouldHold()) {
            if (!sentinel) acquire();
        } else {
            releaseHeld();
        }
    }

    const onVisibility = (): void => sync();
    doc.addEventListener("visibilitychange", onVisibility);

    return {
        setWanted(next: boolean): void {
            if (disposed) return;
            wanted = next;
            sync();
        },
        dispose(): void {
            if (disposed) return;
            wanted = false;
            disposed = true;
            doc.removeEventListener("visibilitychange", onVisibility);
            releaseHeld();
        },
    };
}
