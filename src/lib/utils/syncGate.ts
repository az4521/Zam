// src/lib/utils/syncGate.ts
/**
 * Holds the client's sync requests while paused, letting every other request
 * through. matrix-js-sdk has no way to pause sync without stopping crypto
 * with it, but it takes a custom fetch, so this sits there.
 *
 * Used on Android while the app is in the background (backgroundRelease.ts):
 * a paused page has no sync backlog to work through when a push thaws it, so
 * it can answer the push's decrypt request at once.
 */

/** Classic `/sync` or the sliding sync endpoint, under any API version. */
export function isSyncRequest(url: string): boolean {
    let path: string;
    try {
        path = new URL(url, "https://placeholder.invalid").pathname;
    } catch {
        return false;
    }
    return /^\/_matrix\/client\/.+\/sync$/.test(path);
}

function requestUrl(resource: RequestInfo | URL): string {
    if (typeof resource === "string") return resource;
    if (resource instanceof URL) return resource.href;
    return resource.url;
}

function abortError(signal: AbortSignal): unknown {
    return (
        signal.reason ??
        new DOMException("The operation was aborted.", "AbortError")
    );
}

export interface SyncGate {
    /** Drop-in fetch: sync requests wait while paused; abortable meanwhile. */
    fetch: typeof fetch;
    pause(): void;
    /** Let held and future sync requests go. */
    resume(): void;
    isPaused(): boolean;
}

export function createSyncGate(baseFetch: typeof fetch): SyncGate {
    let paused = false;
    const waiting = new Set<() => void>();

    const gatedFetch = ((resource: RequestInfo | URL, init?: RequestInit) => {
        if (!paused || !isSyncRequest(requestUrl(resource)))
            return baseFetch(resource, init);
        const signal = init?.signal ?? undefined;
        return new Promise<Response>((resolve, reject) => {
            if (signal?.aborted) {
                reject(abortError(signal));
                return;
            }
            const onAbort = () => {
                waiting.delete(go);
                reject(abortError(signal!));
            };
            const go = () => {
                signal?.removeEventListener("abort", onAbort);
                baseFetch(resource, init).then(resolve, reject);
            };
            waiting.add(go);
            signal?.addEventListener("abort", onAbort, { once: true });
        });
    }) as typeof fetch;

    return {
        fetch: gatedFetch,
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
            const held = [...waiting];
            waiting.clear();
            for (const go of held) go();
        },
        isPaused: () => paused,
    };
}
