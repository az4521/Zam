// Every app page holds APP_PAGE_LOCK in shared mode for its whole life. The
// Android push service's hidden page refreshes an expired OAuth token only
// while it can take that lock exclusively, i.e. while no app page runs
// (headlessTokenRefresh.ts): the refresh token rotates, so two parties
// refreshing would leave one of them holding a dead token.
//
// A page that boots while such a refresh is under way waits here for it, and
// must re-read the registry afterwards (reloadRegistryFromStorage): the copy
// it loaded at startup may hold the refresh token that was just used up.

import { APP_PAGE_LOCK } from "$lib/utils/headlessTokenRefresh";

/** A headless refresh is two bounded requests; never hold boot much longer. */
const WAIT_MS = 15_000;

let held = false;

/**
 * Resolves once this page holds the lock (true), or false when the wait ran
 * out or Web Locks are unusable (boot then goes on: an old WebView has no
 * headless refresh either, since that needs the same locks).
 */
export function holdAppPageLock(): Promise<boolean> {
    if (held) return Promise.resolve(true);
    const locks =
        typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return Promise.resolve(false);
    const abort = new AbortController();
    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
            abort.abort();
            console.warn("[appPageLock] still waiting, booting without it");
            resolve(false);
        }, WAIT_MS);
        locks
            .request(
                APP_PAGE_LOCK,
                { mode: "shared", signal: abort.signal },
                () => {
                    clearTimeout(timer);
                    held = true;
                    resolve(true);
                    // Never released: the browser drops it when the page goes.
                    return new Promise<void>(() => {});
                },
            )
            .catch(() => {
                clearTimeout(timer);
                resolve(false);
            });
    });
}
