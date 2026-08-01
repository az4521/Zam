/**
 * A registry of "take my notifications down" callbacks.
 *
 * Three independent surfaces post notifications for this app — the page's own
 * Web Notification API objects, the service worker's, and Android's native
 * ones — and three different places have to take all of them down: explicit
 * logout (AppShell), session expiry (routes/+page.svelte) and an account
 * switch (AccountSwitcher). The page's Notification handles live in AppShell's
 * private, deliberately non-reactive Maps and cannot be reached from the other
 * two without prop-drilling, so AppShell registers its closer here instead and
 * every teardown path calls one function.
 *
 * Zero imports on purpose: this is unit-testable without a DOM, an SDK or a
 * Capacitor bridge.
 */
type NotificationSurface = { clear: () => void };

const surfaces = new Set<NotificationSurface>();

/**
 * Register a surface. Returns an idempotent unregister — calling it twice, or
 * after another surface registered, only ever removes this one registration.
 */
export function registerNotificationSurface(clear: () => void): () => void {
    // A fresh wrapper object per call, so registering the same function twice
    // yields two surfaces with two independent unregisters, and an unregister
    // called twice cannot take a later registration down with it.
    const surface: NotificationSurface = { clear };
    surfaces.add(surface);
    return () => {
        surfaces.delete(surface);
    };
}

/**
 * Take every registered surface down. A surface that throws (notifications
 * unsupported, a Capacitor bridge that is not there, a handle the OS already
 * disposed) must not strand the ones after it — this runs on the way out of a
 * session, where a half-done clear is the failure we are fixing.
 */
export function clearAllNotificationSurfaces(): void {
    // Snapshot first: a surface that registers another one mid-clear must not
    // extend the iteration (Set iteration is live).
    for (const surface of [...surfaces]) {
        try {
            surface.clear();
        } catch {
            /* surface unavailable — the others still have to run */
        }
    }
}

/** Diagnostics/tests only. */
export function notificationSurfaceCount(): number {
    return surfaces.size;
}
