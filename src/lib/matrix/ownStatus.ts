import {
    fetchOwnExtendedProfile,
    getPresence,
    setOwnProfileField,
} from "$lib/matrix/client";
import { auth } from "$lib/stores/auth.svelte";
import { changeOwnStatusMessage } from "$lib/stores/presence.svelte";
import { setCachedProfile } from "$lib/stores/profileFields.svelte";
import {
    PROFILE_FIELDS,
    formatStatusMessage,
    planFieldWrite,
    planLegacyStatusMirror,
    type ExtendedProfile,
    type UserStatus,
} from "$lib/utils/extendedProfile";

/**
 * Set (or clear, with null) our status everywhere a client might look for it:
 * the MSC4426 profile field, Commet's legacy profile key, and the presence
 * status message that Sable shows. Returns the refreshed profile, or null on a
 * server without extended profiles (the presence message is still set there).
 * A server with presence off does not fail the save.
 */
export async function saveOwnStatus(
    status: UserStatus | null,
): Promise<ExtendedProfile | null> {
    const profile = await fetchOwnExtendedProfile();
    if (profile) {
        const ops = [
            ...planFieldWrite(profile, PROFILE_FIELDS.status, status),
            ...planLegacyStatusMirror(profile, status),
        ];
        for (const op of ops) await setOwnProfileField(op.key, op.value);
    }
    await changeOwnStatusMessage(formatStatusMessage(status)).catch(() => {});
    const refreshed = profile ? await fetchOwnExtendedProfile() : null;
    if (auth.userId) setCachedProfile(auth.userId, refreshed);
    if (status === null) await assertCleared(refreshed);
    return refreshed;
}

/**
 * After a clear, ask the server what it actually kept. A clear that quietly
 * did nothing is worse than an error, so name whatever is still set.
 */
async function assertCleared(profile: ExtendedProfile | null): Promise<void> {
    const leftovers: string[] = [];
    for (const key of [
        PROFILE_FIELDS.status.stable,
        PROFILE_FIELDS.status.unstable,
        ...PROFILE_FIELDS.status.legacy,
    ]) {
        if (profile?.[key] !== undefined)
            leftovers.push(`profile field ${key}`);
    }
    const presence = auth.userId ? await getPresence(auth.userId) : null;
    const presenceLeft = presence?.statusMsg;
    if (leftovers.length > 0) {
        throw new Error(`The server still has: ${leftovers.join(", ")}`);
    }
    if (presenceLeft) {
        // Some servers (Tuwunel) keep one presence message per device and show
        // the newest, so another signed-in session can keep it alive.
        throw new Error(
            `Status cleared, but the server still shows the presence message "${presenceLeft}". ` +
                "It is probably set by another session of this account (another app or client) - clear it there, or sign that session out.",
        );
    }
}
