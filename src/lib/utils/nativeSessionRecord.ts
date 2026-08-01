/**
 * The one credential record the native notification surfaces read.
 *
 * Homeserver URL, access token, user id and device id are only ever useful as
 * a TUPLE: the token authenticates one account against one homeserver. The
 * native side used to keep them in four independently-written keys
 * (`matrix_access_token`, `matrix_hs_url`, …), which both
 * `MatrixMessagingService.java` and `static/sw.js` then read back as if they
 * had been written together. They had not. An account switch, a logout racing
 * a login, or a process death mid-write leaves a TORN set — account A's bearer
 * token paired with account B's homeserver — and the reader happily sends the
 * one to the other (external audit SEC-01).
 *
 * So the four fields travel as ONE versioned JSON record under a single key,
 * written and cleared in a single operation. A reader either gets the whole
 * tuple or gets nothing; there is no third state. Every rejection here means
 * "no credentials", never a partially-populated object — a half-filled record
 * is exactly the failure this module exists to make unrepresentable.
 *
 * `static/sw.js` and `MatrixMessagingService.java` mirror `parseNativeSession`
 * by hand (they cannot import TypeScript) — keep those copies in step with
 * this file, including the key names and the version check.
 */

/**
 * Preferences / IndexedDB key holding the whole session record.
 *
 * Deliberately NOT `"matrix_session"`: that is the legacy single-session WEB
 * `localStorage` key which `src/lib/stores/accounts.svelte.ts` migrates into
 * the multi-account registry and then DELETES on boot. Different store,
 * different lifetime, different shape — never confuse the two. Reusing the
 * name would leave a record one boot away from being erased by migration code
 * that has no idea this feature exists.
 *
 * `static/sw.js` and `MatrixMessagingService.java` hand-mirror this exact
 * string; changing it means changing all three.
 */
export const NATIVE_SESSION_KEY = "matrix_session_record";

/** Bump when the record shape changes; readers refuse anything else. */
export const NATIVE_SESSION_VERSION = 1;

/**
 * The pre-record keys. Still written by installs that predate this change, so
 * they are cleaned up on sync and on clear — never READ, because reading them
 * is the bug. The access token is FIRST: a clear that dies partway through
 * must have removed the credential before anything else.
 *
 * `as const` so that ordering is part of the TYPE, not just a test: a reorder
 * that puts the token anywhere but slot 0 changes the tuple's signature.
 * Still assignable wherever a `readonly string[]` is expected.
 */
export const LEGACY_NATIVE_SESSION_KEYS = [
    "matrix_access_token",
    "matrix_hs_url",
    "matrix_user_id",
    "matrix_device_id",
] as const;

export interface NativeSessionRecord {
    v: number;
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string | null;
}

function nonBlankString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function validHomeserverUrl(value: unknown): string | null {
    const raw = nonBlankString(value);
    if (!raw) return null;
    // Trim BEFORE certifying, and return the TRIMMED value: `new URL()`
    // silently tolerates surrounding whitespace, so `"  https://hs  "` would
    // otherwise be stamped valid with its padding intact. The Java mirror
    // builds request URLs by concatenation (`hs + "/_matrix/…"`), which turns
    // that padding into a malformed request against the wrong-looking host.
    const url = raw.trim();
    try {
        const parsed = new URL(url);
        // http: stays allowed — a LAN homeserver works today and this record
        // is only a mirror of whatever the account is already using. The
        // service worker layers its own https-only check on top.
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
            return null;
    } catch {
        // Not absolute (`/_matrix`, `matrix.example.org`) → we would have no
        // idea which server the token belongs to. Refuse the whole record.
        return null;
    }
    return url;
}

/** A Matrix user id, cheaply: the identity half of the tuple. */
function validUserId(value: unknown): string | null {
    const id = nonBlankString(value);
    if (!id || !id.startsWith("@") || id.length < 2) return null;
    return id;
}

/**
 * Build the record to store. Returns null — meaning "write nothing" — unless
 * the whole credential tuple is present and well-formed.
 */
export function serializeNativeSession(input: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    deviceId?: string | null;
}): string | null {
    const homeserverUrl = validHomeserverUrl(input.homeserverUrl);
    const accessToken = nonBlankString(input.accessToken);
    const userId = validUserId(input.userId);
    // All or nothing: a three-field "best effort" write is precisely the tear
    // this record exists to make impossible.
    if (!homeserverUrl || !accessToken || !userId) return null;
    const record: NativeSessionRecord = {
        v: NATIVE_SESSION_VERSION,
        homeserverUrl,
        accessToken,
        userId,
        // Always present, explicitly null when unknown: an omitted key would
        // be indistinguishable from a truncated record.
        deviceId: nonBlankString(input.deviceId),
    };
    return JSON.stringify(record);
}

/**
 * Strict parse of the stored record — anything unexpected yields null, i.e.
 * "this device has no credentials", which every reader must treat as "do not
 * contact any homeserver".
 */
export function parseNativeSession(raw: unknown): NativeSessionRecord | null {
    if (typeof raw !== "string" || raw.trim().length === 0) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    // Arrays and JSON primitives are not records; `typeof null === "object"`.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return null;
    const record = parsed as Record<string, unknown>;
    // A record from another shape (older or newer) may mean something else by
    // the same field names — refuse rather than guess.
    if (record.v !== NATIVE_SESSION_VERSION) return null;
    const homeserverUrl = validHomeserverUrl(record.homeserverUrl);
    const accessToken = nonBlankString(record.accessToken);
    const userId = validUserId(record.userId);
    if (!homeserverUrl || !accessToken || !userId) return null;
    // deviceId is optional by design (no device id → the reader simply never
    // suppresses), but a WRONG type means the record is corrupt, not partial.
    const rawDevice = record.deviceId;
    if (
        rawDevice !== undefined &&
        rawDevice !== null &&
        typeof rawDevice !== "string"
    )
        return null;
    return {
        v: NATIVE_SESSION_VERSION,
        homeserverUrl,
        accessToken,
        userId,
        deviceId: nonBlankString(rawDevice),
    };
}
