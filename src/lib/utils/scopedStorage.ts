// Per-account localStorage keys: `${base}:${userId}`. Pre-multi-account
// builds wrote the bare base key; the first scoped read adopts that legacy
// value for the current account and deletes the bare key. All storage
// access is try/catch-tolerant (private mode, quota).

export function scopedKey(base: string, userId: string | null): string {
    return userId ? `${base}:${userId}` : base;
}

export function readScoped(base: string, userId: string | null): string | null {
    try {
        const key = scopedKey(base, userId);
        const scoped = localStorage.getItem(key);
        if (scoped !== null) return scoped;
        if (!userId) return null;
        const legacy = localStorage.getItem(base);
        if (legacy === null) return null;
        localStorage.setItem(key, legacy);
        localStorage.removeItem(base);
        return legacy;
    } catch {
        return null;
    }
}

export function writeScoped(
    base: string,
    userId: string | null,
    value: string,
): void {
    try {
        localStorage.setItem(scopedKey(base, userId), value);
    } catch {
        // ignore (private mode / storage full)
    }
}

export function removeScoped(base: string, userId: string | null): void {
    try {
        localStorage.removeItem(scopedKey(base, userId));
    } catch {
        // ignore
    }
}
