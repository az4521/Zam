/**
 * Mirrors the minimal Matrix session (homeserver URL + access token) into
 * native storage (Capacitor Preferences → Android SharedPreferences) so the
 * native push service (MatrixMessagingService.java) can call the homeserver to
 * enrich data-only notifications with sender / message / room info.
 *
 * No-op off-native. Cleared on logout.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const KEY_HS = "matrix_hs_url";
const KEY_TOKEN = "matrix_access_token";
const KEY_USER = "matrix_user_id";
const KEY_HIDE_BODY = "matrix_hide_notification_body";

export async function syncNativeSession(session: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Preferences.set({ key: KEY_HS, value: session.homeserverUrl });
        await Preferences.set({
            key: KEY_TOKEN,
            value: session.accessToken,
        });
        await Preferences.set({ key: KEY_USER, value: session.userId });
    } catch (err) {
        console.warn("[nativeSession] failed to sync session", err);
    }
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
    try {
        await Preferences.remove({ key: KEY_HS });
        await Preferences.remove({ key: KEY_TOKEN });
        await Preferences.remove({ key: KEY_USER });
        // Asymmetric on purpose: KEY_HIDE_BODY is a DEVICE-global setting, not
        // session state, so it is written from the component layer (via
        // syncNativeNotificationPrivacy) rather than by syncNativeSession —
        // writing it there would make it session-scoped and clobber it with a
        // stale value on every boot. It is still removed here so logout doesn't
        // strand it for the next account.
        await Preferences.remove({ key: KEY_HIDE_BODY });
    } catch {
        /* ignore */
    }
}

export interface NativeSessionState {
    native: boolean;
    homeserverUrl: string | null;
    userId: string | null;
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
        const hs = (await withTimeout(Preferences.get({ key: KEY_HS }))).value;
        const token = (await withTimeout(Preferences.get({ key: KEY_TOKEN })))
            .value;
        const user = (await withTimeout(Preferences.get({ key: KEY_USER })))
            .value;
        const hideBody = (
            await withTimeout(Preferences.get({ key: KEY_HIDE_BODY }))
        ).value;
        return {
            native: true,
            homeserverUrl: hs ?? null,
            userId: user ?? null,
            hasToken: !!token,
            // Same comparison the Java side makes: only the literal "true".
            hideNotificationBody: hideBody === "true",
        };
    } catch (err) {
        return {
            native: true,
            homeserverUrl: null,
            userId: null,
            hasToken: false,
            hideNotificationBody: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
