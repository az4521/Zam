import {
    getUserPresence,
    onPresenceEvent,
    setOwnPresence,
} from "$lib/matrix/client";
import { normalizePresence, type PresenceState } from "$lib/utils/presence";
import {
    settingsState,
    setOwnPresenceSetting,
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
    await setOwnPresence(value);
}

/** Call once on app mount (after login). Returns a cleanup function. */
export function initPresence(): () => void {
    // Re-apply the persisted choice — the sync loop advertises "online" by
    // default, so away/invisible must be pushed again each session.
    if (settingsState.ownPresence !== "online") {
        setOwnPresence(settingsState.ownPresence).catch((err) => {
            console.warn("[presence] could not apply own presence", err);
        });
    }

    return onPresenceEvent(() => {
        presenceState.presenceTick++;
    });
}
