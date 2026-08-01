/**
 * Mirrors the minimal Matrix session (homeserver URL + access token + the
 * account/device identity) into native storage (Capacitor Preferences →
 * Android SharedPreferences) so the native push service
 * (MatrixMessagingService.java) can call the homeserver to enrich data-only
 * notifications with sender / message / room info, and can read the
 * active-session heartbeat to tell whether ANOTHER device is currently in use.
 *
 * The credential tuple travels as ONE versioned record under a single key
 * (see `$lib/utils/nativeSessionRecord`). Preferences offers no transaction,
 * so four independently-written keys can TEAR — an account switch or a process
 * death mid-write leaves account A's bearer token paired with account B's
 * homeserver, and the push service then sends the one to the other (external
 * audit SEC-01). One key cannot tear.
 *
 * No-op off-native. Cleared on logout.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
    LEGACY_NATIVE_SESSION_KEYS,
    NATIVE_SESSION_KEY,
    parseNativeSession,
    serializeNativeSession,
} from "$lib/utils/nativeSessionRecord";

const KEY_HIDE_BODY = "matrix_hide_notification_body";

/**
 * Remove one key without letting its failure strand the keys after it. The
 * previous code wrapped four removals in ONE try, so a throw on the first left
 * the access token at rest indefinitely — exactly the thing logout exists to
 * prevent.
 */
async function removeQuietly(key: string): Promise<void> {
    try {
        await Preferences.remove({ key });
    } catch {
        /* best effort — every removal is independently guarded on purpose */
    }
}

export async function syncNativeSession(session: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    /**
     * This device's Matrix device id — the native service compares it against
     * the active-session blob. Nullable on purpose: a missing device id must
     * not stop the rest of the tuple being mirrored (the push service still
     * enriches notifications without it, it just never suppresses). It is
     * carried as an explicit null inside the record rather than left behind as
     * a stale key: the native reader treats "no device id" as "notify", but a
     * WRONG one would look like another device and could silence this one.
     */
    deviceId?: string | null;
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const record = serializeNativeSession(session);
    if (!record) {
        // Incomplete or malformed input: write NOTHING — not the record, not a
        // partial fallback. A three-field "best effort" mirror is worse than
        // no mirror, because the native service would pair whatever we wrote
        // with whatever was already sitting there.
        //
        // Refusing to write also leaves any PREVIOUS record in place at rest,
        // and that is deliberate: a transient blank auth state (a store not yet
        // hydrated, a restore still in flight) must not nuke a working mirror
        // at boot. Clearing is logout's job — clearNativeSession() below. This
        // branch is unreachable today anyway: the sole caller,
        // src/lib/components/layout/AppShell.svelte:894, guards all three
        // required fields before it calls in.
        console.warn(
            "[nativeSession] refusing to mirror an incomplete session",
        );
        return;
    }
    try {
        // ONE write. Preferences has no transaction, so the only way
        // homeserver / token / identity cannot come apart is being one value.
        await Preferences.set({ key: NATIVE_SESSION_KEY, value: record });
    } catch (err) {
        console.warn("[nativeSession] failed to sync session", err);
        // Leave the legacy keys alone: the write failed, so sweeping them now
        // would strip a working (if old-shaped) session and leave none.
        return;
    }
    // Migration: installs that predate the record still have the per-key
    // values at rest, and they are never read again. Swept only AFTER the
    // record lands, so a crash in between leaves a working session, not none.
    for (const key of LEGACY_NATIVE_SESSION_KEYS) await removeQuietly(key);
}

/**
 * Mirror the device-global "hide message text in notifications" setting so the
 * native push service (MatrixMessagingService.java) can honour it. Capacitor
 * Preferences stores strings, so the Java side compares against "true".
 */
export async function syncNativeNotificationPrivacy(
    hide: boolean,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Preferences.set({ key: KEY_HIDE_BODY, value: String(hide) });
    } catch (err) {
        console.warn(
            "[nativeSession] failed to sync notification privacy",
            err,
        );
    }
}

export async function clearNativeSession(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    // The record holds the token, so it goes FIRST and on its own: if anything
    // below throws, the credential is already gone.
    await removeQuietly(NATIVE_SESSION_KEY);
    // Then the pre-record keys, so an upgrade from an old install doesn't
    // leave a second copy of the token behind after logout.
    for (const key of LEGACY_NATIVE_SESSION_KEYS) await removeQuietly(key);
    // Asymmetric on purpose: KEY_HIDE_BODY is a DEVICE-global setting, not
    // session state, so it is written from the component layer (via
    // syncNativeNotificationPrivacy) rather than by syncNativeSession —
    // writing it there would make it session-scoped and clobber it with a
    // stale value on every boot. It is still removed here so logout doesn't
    // strand it for the next account.
    await removeQuietly(KEY_HIDE_BODY);
}

export interface NativeSessionState {
    native: boolean;
    homeserverUrl: string | null;
    userId: string | null;
    deviceId: string | null;
    /** Whether an access token is present (not the token itself). */
    hasToken: boolean;
    /**
     * Whether the mirrored device-global "hide message text in notifications"
     * flag is set natively. Java has no compile-time linkage to this key, so
     * the debug screen is the only place the mirror can be confirmed.
     */
    hideNotificationBody: boolean;
    error?: string;
}

/**
 * Read back what's actually stored natively — used by Settings → Debug Info to
 * confirm the web→native session mirror worked (the data the push service uses).
 */
export async function readNativeSession(): Promise<NativeSessionState> {
    if (!Capacitor.isNativePlatform()) {
        return {
            native: false,
            homeserverUrl: null,
            userId: null,
            deviceId: null,
            hasToken: false,
            hideNotificationBody: false,
        };
    }
    try {
        // Guard against a Preferences call that never resolves so the Debug
        // Info UI always renders a result instead of hanging on null.
        const withTimeout = <T>(p: Promise<T>): Promise<T> =>
            Promise.race([
                p,
                new Promise<T>((_, reject) =>
                    setTimeout(() => reject(new Error("timed out")), 4000),
                ),
            ]);
        const raw = (
            await withTimeout(Preferences.get({ key: NATIVE_SESSION_KEY }))
        ).value;
        const hideBody = (
            await withTimeout(Preferences.get({ key: KEY_HIDE_BODY }))
        ).value;
        // Only the record is consulted. The legacy keys are deliberately NOT a
        // fallback: reading them back is the torn-tuple hole this change closes.
        const record = parseNativeSession(raw);
        if (raw && !record) {
            // Something IS stored but does not validate. Say so rather than
            // render "(none)" everywhere — that reads as "logged out", the one
            // wrong conclusion to draw from a corrupt credential record.
            return {
                native: true,
                homeserverUrl: null,
                userId: null,
                deviceId: null,
                hasToken: false,
                hideNotificationBody: hideBody === "true",
                error: "stored session record is invalid or from a newer version",
            };
        }
        return {
            native: true,
            homeserverUrl: record?.homeserverUrl ?? null,
            userId: record?.userId ?? null,
            deviceId: record?.deviceId ?? null,
            // Presence only — the token itself never leaves this module.
            hasToken: !!record,
            // Same comparison the Java side makes: only the literal "true".
            hideNotificationBody: hideBody === "true",
        };
    } catch (err) {
        return {
            native: true,
            homeserverUrl: null,
            userId: null,
            deviceId: null,
            hasToken: false,
            hideNotificationBody: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
