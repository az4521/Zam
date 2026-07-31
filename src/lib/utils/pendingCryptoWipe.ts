/**
 * A marker for a rust-crypto store wipe that an explicit logout could not
 * finish, so the next boot can finish it.
 *
 * Why this has to exist: matrix-js-sdk's `clearStores()` deletes the two
 * rust-crypto IndexedDB databases and sets `req.onblocked` to a LOG-ONLY
 * handler (`node_modules/matrix-js-sdk/lib/client.js:736`). A delete blocked by
 * a second tab therefore never settles, `logout()` never resolves, and
 * AppShell's bounded 4s window ends in a reload with the plaintext key material
 * still on disk.
 *
 * The record holds NO secrets — a user id, a device id and an IndexedDB name
 * prefix, all of which are already discoverable on the device — so
 * localStorage is a fine home for it. Never add a token or a recovery key
 * here.
 */

export const PENDING_WIPE_KEY = "matrix_pending_crypto_wipe";
export const PENDING_WIPE_VERSION = 1;
/** Bound on the stored list, so a device that can never delete (Firefox
 *  private mode rejects every deleteDatabase) can't grow the record forever. */
export const MAX_PENDING_WIPES = 16;

export interface SessionId {
    userId: string;
    deviceId: string;
}

export interface PendingWipe {
    userId: string;
    deviceId: string;
    /** Prefix passed to `initRustCrypto`/`clearStores`; see `getCryptoDbName`. */
    cryptoDbPrefix: string;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function toWipe(value: unknown): PendingWipe | null {
    if (!value || typeof value !== "object") return null;
    const o = value as Record<string, unknown>;
    if (
        !isNonEmptyString(o.userId) ||
        !isNonEmptyString(o.deviceId) ||
        !isNonEmptyString(o.cryptoDbPrefix)
    ) {
        return null;
    }
    // Rebuilt field by field: whatever else a past or hostile writer put in the
    // envelope never reaches a consumer.
    return {
        userId: o.userId,
        deviceId: o.deviceId,
        cryptoDbPrefix: o.cryptoDbPrefix,
    };
}

/** Corrupt JSON, wrong shape or unknown version → no records. Never throws. */
export function parsePendingWipes(raw: string | null): PendingWipe[] {
    if (!raw) return [];
    try {
        const data = JSON.parse(raw) as unknown;
        if (!data || typeof data !== "object") return [];
        const envelope = data as { v?: unknown; wipes?: unknown };
        if (envelope.v !== PENDING_WIPE_VERSION) return [];
        if (!Array.isArray(envelope.wipes)) return [];
        return (
            envelope.wipes
                .map(toWipe)
                .filter((w): w is PendingWipe => w !== null)
                // The cap on `addPendingWipe` only binds writers we control;
                // the stored length comes off disk, so bound it here too.
                .slice(-MAX_PENDING_WIPES)
        );
    } catch {
        return [];
    }
}

export function serializePendingWipes(wipes: PendingWipe[]): string {
    return JSON.stringify({
        v: PENDING_WIPE_VERSION,
        // Rebuilt field by field on the WRITE side as well. TypeScript will not
        // catch the dangerous call — `{ ...account, cryptoDbPrefix }` compiles
        // clean because excess-property checking does not fire through a
        // spread, and account records carry an `accessToken`. Structure, not
        // the type checker, is what keeps a secret out of localStorage.
        wipes: wipes.map((w) => ({
            userId: w.userId,
            deviceId: w.deviceId,
            cryptoDbPrefix: w.cryptoDbPrefix,
        })),
    });
}

function sameSession(
    a: { userId: string; deviceId: string },
    b: { userId: string; deviceId: string },
): boolean {
    return a.userId === b.userId && a.deviceId === b.deviceId;
}

/** Dedupes on user + device (the newest entry wins) and caps the list. */
export function addPendingWipe(
    wipes: PendingWipe[],
    wipe: PendingWipe,
): PendingWipe[] {
    const next = wipes.filter((w) => !sameSession(w, wipe));
    next.push(wipe);
    return next.slice(-MAX_PENDING_WIPES);
}

export function removePendingWipe(
    wipes: PendingWipe[],
    id: SessionId,
): PendingWipe[] {
    return wipes.filter((w) => !sameSession(w, id));
}

/**
 * The records it is safe to delete right now.
 *
 * A session still known to this device (any account in the registry, including
 * the one signing in) is EXCLUDED: its store is either open or usable, and
 * deleting it would destroy message keys the user can still use. A live
 * session we can only identify by user id excludes every record for that user
 * — unknown is not the same as gone, and the destructive direction is the one
 * we refuse to guess in.
 *
 * Excluded records are skipped, NOT dropped: they become eligible again once
 * that session really leaves the device.
 */
export function wipesToRetry(
    wipes: PendingWipe[],
    liveSessions: Array<{ userId: string; deviceId?: string | null }>,
): PendingWipe[] {
    return wipes.filter(
        (w) =>
            !liveSessions.some(
                (s) =>
                    s.userId === w.userId &&
                    (!isNonEmptyString(s.deviceId) ||
                        s.deviceId === w.deviceId),
            ),
    );
}

/**
 * The two databases matrix-js-sdk creates per crypto prefix — mirrors
 * `node_modules/matrix-js-sdk/lib/client.js:719`. Keep in step with it.
 */
export function cryptoDbNames(prefix: string): string[] {
    return [
        `${prefix}::matrix-sdk-crypto`,
        `${prefix}::matrix-sdk-crypto-meta`,
    ];
}

// --- storage -----------------------------------------------------------
// Every access is try/catch-tolerant (private mode, quota, SSR), matching
// `scopedStorage.ts`. These are total functions: a storage failure degrades to
// "no records" / "not written", never to a thrown error on the boot path.

export function readPendingWipes(): PendingWipe[] {
    try {
        return parsePendingWipes(localStorage.getItem(PENDING_WIPE_KEY));
    } catch {
        return [];
    }
}

export function writePendingWipes(wipes: PendingWipe[]): void {
    try {
        if (wipes.length === 0) {
            localStorage.removeItem(PENDING_WIPE_KEY);
            return;
        }
        localStorage.setItem(PENDING_WIPE_KEY, serializePendingWipes(wipes));
    } catch {
        // ignore (private mode / storage full)
    }
}

export function rememberPendingWipe(wipe: PendingWipe): void {
    writePendingWipes(addPendingWipe(readPendingWipes(), wipe));
}

export function forgetPendingWipe(id: SessionId): void {
    writePendingWipes(removePendingWipe(readPendingWipes(), id));
}
