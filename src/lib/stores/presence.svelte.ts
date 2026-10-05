import {
    fetchOwnExtendedProfile,
    getUserPresence,
    isUsingSlidingSync,
    onPresenceEvent,
    setOwnPresence,
} from "$lib/matrix/client";
import {
    PROFILE_FIELDS,
    formatStatusMessage,
    parseStatus,
    readField,
} from "$lib/utils/extendedProfile";
import { normalizePresence, type PresenceState } from "$lib/utils/presence";
import {
    settingsState,
    setOwnPresenceSetting,
    setOwnStatusMessageSetting,
} from "$lib/stores/settings.svelte";

export interface UserPresenceView {
    state: PresenceState;
    currentlyActive: boolean;
    statusMsg?: string;
}

// Presence data itself lives in the SDK's user model; this store only holds
// the tick that tells $derived consumers to re-read it (house pattern — live
// SDK objects mutate in place, so deriveds must depend on a counter).
export const presenceState = $state({
    presenceTick: 0,
});

/**
 * Presence for a user, normalized for rendering. Null when nothing is known —
 * the server may have presence disabled entirely; callers typically render
 * that the same as offline.
 */
export function presenceFor(userId: string): UserPresenceView | null {
    const raw = getUserPresence(userId);
    if (!raw) return null;
    return {
        state: normalizePresence(raw.presence),
        currentlyActive: raw.currentlyActive,
        statusMsg: raw.statusMsg,
    };
}

/** Change own advertised presence: persist the choice locally and push it to
 *  the homeserver. Rethrows so settings UI can surface the server error. */
export async function changeOwnPresence(value: PresenceState): Promise<void> {
    setOwnPresenceSetting(value);
    await setOwnPresence(value, settingsState.ownStatusMessage || undefined);
}

/** Mirror our profile status into the presence status_msg ("" clears it). */
export async function changeOwnStatusMessage(message: string): Promise<void> {
    setOwnStatusMessageSetting(message);
    await setOwnPresence(settingsState.ownPresence, message);
}

/**
 * A status cleared from another device leaves this device's presence message
 * behind, and a server that keeps one message per device (Tuwunel) then shows
 * whichever is newest. So when this device remembers a message, bring it in
 * line with the profile status, which is the source of truth.
 */
async function reconcileStatusMessage(): Promise<void> {
    const local = settingsState.ownStatusMessage;
    if (!local) return;
    const profile = await fetchOwnExtendedProfile();
    if (!profile) return;
    const desired = formatStatusMessage(
        parseStatus(readField(profile, PROFILE_FIELDS.status)),
    );
    if (desired !== local) await changeOwnStatusMessage(desired);
}

const SLIDING_PRESENCE_HEARTBEAT_MS = 25_000;

/** Call once on app mount (after login). Returns a cleanup function. */
export function initPresence(): () => void {
    // Re-apply the persisted choice — the sync loop advertises "online" by
    // default, so away/invisible must be pushed again each session.
    if (settingsState.ownPresence !== "online") {
        setOwnPresence(
            settingsState.ownPresence,
            settingsState.ownStatusMessage || undefined,
        ).catch((err) => {
            console.warn("[presence] could not apply own presence", err);
        });
    }

    reconcileStatusMessage().catch((err) => {
        console.warn("[presence] could not reconcile status message", err);
    });

    // Sliding sync never marks us as syncing, so the server times an online or
    // away presence out to offline about 30s after the last PUT (Synapse's
    // sync_online_timeout). Keep re-asserting it while sliding sync is on.
    const heartbeat = setInterval(() => {
        if (!isUsingSlidingSync() || settingsState.ownPresence === "offline")
            return;
        setOwnPresence(
            settingsState.ownPresence,
            settingsState.ownStatusMessage || undefined,
        ).catch(() => {});
    }, SLIDING_PRESENCE_HEARTBEAT_MS);

    const unsubPresence = onPresenceEvent(() => {
        presenceState.presenceTick++;
    });
    return () => {
        clearInterval(heartbeat);
        unsubPresence();
    };
}
