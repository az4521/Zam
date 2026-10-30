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
import {
    advertisedPresence,
    normalizePresence,
    type PresenceState,
} from "$lib/utils/presence";
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
    // Picking a presence is itself input, so the device is in use.
    advertised = advertisedPresence(value, 0);
    await setOwnPresence(
        advertised,
        settingsState.ownStatusMessage || undefined,
    );
}

/** Mirror our profile status into the presence status_msg ("" clears it). */
export async function changeOwnStatusMessage(message: string): Promise<void> {
    setOwnStatusMessageSetting(message);
    await setOwnPresence(advertised, message);
}

// What this device currently tells the server: the chosen presence, except
// that a chosen "online" drops to "unavailable" while the device is idle.
// Without that, every sync long-poll re-marks the account online, and tuwunel
// shows the highest state across devices, so a desktop left open kept the
// user online forever. Plain module state: it only feeds SDK calls.
let advertised: PresenceState = settingsState.ownPresence;
let lastInputTs = Date.now();

const IDLE_CHECK_MS = 15_000;

/** How long this device has gone without input. The desktop app asks the OS,
 *  so typing in another window still counts as being at the computer and a
 *  locked screen counts as away at once; elsewhere only input to the page
 *  counts. */
export async function readIdleMs(): Promise<number> {
    const system = await window.desktop?.idle?.get().catch(() => null);
    if (system) return system.locked ? Infinity : system.seconds * 1000;
    return Math.max(0, Date.now() - lastInputTs);
}

async function updateAdvertisedPresence(): Promise<void> {
    const idleMs = await readIdleMs();
    const next = advertisedPresence(settingsState.ownPresence, idleMs);
    if (next === advertised) return;
    advertised = next;
    await setOwnPresence(next, settingsState.ownStatusMessage || undefined);
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
    advertised = settingsState.ownPresence;
    lastInputTs = Date.now();
    if (advertised !== "online") {
        setOwnPresence(
            advertised,
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
        if (!isUsingSlidingSync() || advertised === "offline") return;
        setOwnPresence(
            advertised,
            settingsState.ownStatusMessage || undefined,
        ).catch(() => {});
    }, SLIDING_PRESENCE_HEARTBEAT_MS);

    const idleCheck = setInterval(() => {
        updateAdvertisedPresence().catch(() => {});
    }, IDLE_CHECK_MS);
    // Passive: they only stamp a number. Coming back from away should not
    // wait for the next check, so input while away re-checks at once.
    const onUserInput = () => {
        lastInputTs = Date.now();
        if (
            advertised === "unavailable" &&
            settingsState.ownPresence === "online"
        )
            updateAdvertisedPresence().catch(() => {});
    };
    const inputEvents = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const type of inputEvents)
        window.addEventListener(type, onUserInput, { passive: true });

    const unsubPresence = onPresenceEvent(() => {
        presenceState.presenceTick++;
    });
    return () => {
        clearInterval(heartbeat);
        clearInterval(idleCheck);
        for (const type of inputEvents)
            window.removeEventListener(type, onUserInput);
        unsubPresence();
    };
}
