// Per-account "use sliding sync" preference. Chosen on the login page and
// remembered per user id so session restores and account switches keep using
// the same sync transport the account signed in with.

const KEY_PREFIX = "moe.crafty.matrix.sliding_sync:";
/**
 * Timestamp of the last successful capability probe for an account. Lets a
 * boot skip the probe while the server was recently seen to support sliding
 * sync. Expires so the probe runs again every week.
 */
const OK_KEY_PREFIX = "moe.crafty.matrix.sliding_sync_ok:";
const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isSlidingSyncEnabled(userId: string): boolean {
    try {
        return globalThis.localStorage?.getItem(KEY_PREFIX + userId) === "1";
    } catch {
        return false;
    }
}

export function setSlidingSyncEnabled(userId: string, enabled: boolean): void {
    try {
        if (enabled) globalThis.localStorage?.setItem(KEY_PREFIX + userId, "1");
        else globalThis.localStorage?.removeItem(KEY_PREFIX + userId);
        // Whatever was known about the server no longer decides anything.
        globalThis.localStorage?.removeItem(OK_KEY_PREFIX + userId);
    } catch {
        // ignore storage errors
    }
}

/**
 * True when a probe recently found sliding sync on this account's server, so
 * the boot need not ask again. A stamp in the future (clock moved back) does
 * not count: the probe just runs.
 */
export function isSlidingSyncKnownSupported(
    userId: string,
    now = Date.now(),
): boolean {
    try {
        const raw = globalThis.localStorage?.getItem(OK_KEY_PREFIX + userId);
        if (!raw) return false;
        const at = Number(raw);
        if (!Number.isFinite(at)) return false;
        const age = now - at;
        return age >= 0 && age < OK_TTL_MS;
    } catch {
        return false;
    }
}

/**
 * Record the outcome of a probe: true stamps the account as supported now,
 * false forgets any earlier stamp so the next boot probes again.
 */
export function markSlidingSyncSupported(
    userId: string,
    supported: boolean,
): void {
    try {
        if (supported)
            globalThis.localStorage?.setItem(
                OK_KEY_PREFIX + userId,
                String(Date.now()),
            );
        else globalThis.localStorage?.removeItem(OK_KEY_PREFIX + userId);
    } catch {
        // ignore storage errors
    }
}
