// Per-account "use sliding sync" preference. Chosen on the login page and
// remembered per user id so session restores and account switches keep using
// the same sync transport the account signed in with.

const KEY_PREFIX = "moe.crafty.matrix.sliding_sync:";

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
    } catch {
        // ignore storage errors
    }
}
