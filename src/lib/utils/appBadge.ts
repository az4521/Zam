/**
 * Home-screen / dock app badge (Badging API). Pure: the caller passes the
 * navigator, so tests can supply a fake. Never throws.
 */

export interface BadgeNavigatorLike {
    setAppBadge?: (count?: number) => Promise<void> | void;
    clearAppBadge?: () => Promise<void> | void;
}

/** Last value successfully sent per navigator, so unchanged counts do not re-call the API. */
const lastSent = new WeakMap<object, number>();

function normalise(count: number): number {
    if (!Number.isFinite(count) || count <= 0) return 0;
    return Math.floor(count);
}

/**
 * Mirror `count` onto the app icon badge. Positive counts set the badge,
 * zero clears it. Calls are skipped when the value matches the last one sent.
 */
export function syncAppBadge(
    count: number,
    nav: BadgeNavigatorLike = navigator,
): void {
    try {
        const value = normalise(count);
        if (lastSent.get(nav) === value) return;

        if (value > 0) {
            if (typeof nav.setAppBadge !== "function") return;
            const result = nav.setAppBadge(value);
            lastSent.set(nav, value);
            if (
                result &&
                typeof (result as Promise<void>).catch === "function"
            ) {
                (result as Promise<void>).catch(() => forget(nav));
            }
        } else {
            if (typeof nav.clearAppBadge !== "function") return;
            const result = nav.clearAppBadge();
            lastSent.set(nav, 0);
            if (
                result &&
                typeof (result as Promise<void>).catch === "function"
            ) {
                (result as Promise<void>).catch(() => forget(nav));
            }
        }
    } catch {
        // Badging is a nicety; a failure must never break the app.
    }
}

/** Forget the cached value after a failed call so the next sync retries. */
function forget(nav: object): void {
    lastSent.delete(nav);
}
