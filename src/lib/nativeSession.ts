/**
 * Mirrors the minimal Matrix session (homeserver URL + access token) into
 * native storage (Capacitor Preferences → Android SharedPreferences) so the
 * native push service (MatrixMessagingService.java) can call the homeserver to
 * enrich data-only notifications with sender / message / room info.
 *
 * No-op off-native. Cleared on logout.
 */

import { Capacitor } from "@capacitor/core";

const KEY_HS = "matrix_hs_url";
const KEY_TOKEN = "matrix_access_token";
const KEY_USER = "matrix_user_id";

async function prefs() {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
}

export async function syncNativeSession(session: {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
}): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const p = await prefs();
        await p.set({ key: KEY_HS, value: session.homeserverUrl });
        await p.set({ key: KEY_TOKEN, value: session.accessToken });
        await p.set({ key: KEY_USER, value: session.userId });
    } catch (err) {
        console.warn("[nativeSession] failed to sync session", err);
    }
}

export async function clearNativeSession(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const p = await prefs();
        await p.remove({ key: KEY_HS });
        await p.remove({ key: KEY_TOKEN });
        await p.remove({ key: KEY_USER });
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
        };
    }
    try {
        const p = await prefs();
        const hs = (await p.get({ key: KEY_HS })).value;
        const token = (await p.get({ key: KEY_TOKEN })).value;
        const user = (await p.get({ key: KEY_USER })).value;
        return {
            native: true,
            homeserverUrl: hs ?? null,
            userId: user ?? null,
            hasToken: !!token,
        };
    } catch (err) {
        return {
            native: true,
            homeserverUrl: null,
            userId: null,
            hasToken: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
