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
