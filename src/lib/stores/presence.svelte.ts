import { createSubscriber } from "svelte/reactivity";
import {
    fetchOwnExtendedProfile,
    getUserPresence,
    isUsingSlidingSync,
    onPresenceEvent,
    onSlidingSyncActiveChange,
    refreshUserPresence,
    setAccountNotificationsDisabled,
    setOwnPresence,
    supportsBusyPresence,
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
    type SeenPresence,
} from "$lib/utils/presence";
import {
    settingsState,
    setDoNotDisturbSetting,
    setOwnPresenceSetting,
    setOwnStatusMessageSetting,
} from "$lib/stores/settings.svelte";

export interface UserPresenceView {
    state: SeenPresence;
    currentlyActive: boolean;
    statusMsg?: string;
}

// Presence is watched per user. Presence data itself lives in the SDK's user
// model (live objects that mutate in place), so each user gets a
// createSubscriber: a reactive read via presenceFor() subscribes to that user
// alone, and a presence event for anyone else re-renders nothing. The
// subscription ends when the last reader unmounts. Users no rendered reader
// is watching cause no work. Watching also drives the sliding-sync poll in
// initPresence (see watchedPresenceUsers).
interface PresenceWatcher {
    subscribe: () => void;
    update: (() => void) | null;
}
const watchers = new Map<string, PresenceWatcher>();
const watched = new Set<string>();

/** Users whose presence a rendered reader currently watches. */
export function watchedPresenceUsers(): string[] {
    return [...watched];
}

const PRESENCE_SETTLE_MS = 300;

function watcherFor(userId: string): PresenceWatcher {
    let entry = watchers.get(userId);
    if (entry) return entry;
    const created: PresenceWatcher = {
        update: null,
        subscribe: createSubscriber((update) => {
            created.update = update;
            watched.add(userId);
            // Only fetch for someone who stays on screen: scrolling a big
            // member list flashes hundreds of rows past, and each would
            // otherwise cost a request.
            const settle = setTimeout(
                () => refreshUserPresence(userId),
                PRESENCE_SETTLE_MS,
            );
            return () => {
                clearTimeout(settle);
                created.update = null;
                watched.delete(userId);
                if (watchers.get(userId) === created) watchers.delete(userId);
            };
        }),
    };
    entry = created;
    watchers.set(userId, entry);
    return entry;
}

/**
 * Presence for a user, normalized for rendering. Null when nothing is known —
 * the server may have presence disabled entirely; callers typically render
 * that the same as offline. Inside a reactive context it makes the caller
 * re-render when this user's presence changes; outside one it is a plain read.
 */
export function presenceFor(userId: string): UserPresenceView | null {
    // Outside a reactive context there is nothing to subscribe, and making a
    // watcher entry would leave one behind per user read.
    if ($effect.tracking()) watcherFor(userId).subscribe();
    const raw = getUserPresence(userId);
    if (!raw) return null;
    return {
        state: normalizePresence(raw.presence),
        currentlyActive: raw.currentlyActive,
        statusMsg: raw.statusMsg,
    };
}

/** The state the user picked, as the server should see it: Do Not Disturb
 *  is MSC3026 busy (red for others), or idle on a server without busy.
 *  Invisible stays invisible. */
function chosenPresence(): SeenPresence {
    if (!settingsState.doNotDisturb || settingsState.ownPresence !== "online")
        return settingsState.ownPresence;
    return busySupported ? "busy" : "unavailable";
}

// Whether the homeserver takes busy; read from /versions in initPresence.
// Until then Do Not Disturb advertises away, as it did before busy.
let busySupported = false;

/** Turn Do Not Disturb on or off: the account's master push rule (so the
 *  server stops pushing to every device), local alerts (see
 *  emitNotificationNow) and idle presence. Rethrows a server failure and
 *  leaves the setting as it was. */
export async function changeDoNotDisturb(on: boolean): Promise<void> {
    await setAccountNotificationsDisabled(on);
    setDoNotDisturbSetting(on);
    if (on) busySupported = await supportsBusyPresence();
    advertised = advertisedPresence(chosenPresence(), 0);
    await setOwnPresence(
        advertised,
        settingsState.ownStatusMessage || undefined,
    );
}

/** Change own advertised presence: persist the choice locally and push it to
 *  the homeserver. Rethrows so settings UI can surface the server error. */
export async function changeOwnPresence(value: PresenceState): Promise<void> {
    setOwnPresenceSetting(value);
    // Picking a presence is itself input, so the device is in use.
    advertised = advertisedPresence(chosenPresence(), 0);
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
let advertised: SeenPresence = settingsState.ownPresence;
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
    const next = advertisedPresence(chosenPresence(), idleMs);
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
    busySupported = false;
    advertised = chosenPresence();
    lastInputTs = Date.now();
    if (advertised !== "online") {
        setOwnPresence(
            advertised,
            settingsState.ownStatusMessage || undefined,
        ).catch((err) => {
            console.warn("[presence] could not apply own presence", err);
        });
    }
    // Do Not Disturb went out as away above; upgrade it to busy once the
    // server says it has busy.
    let disposed = false;
    supportsBusyPresence().then((ok) => {
        if (disposed || !ok) return;
        busySupported = true;
        const next = chosenPresence();
        if (next === advertised) return;
        advertised = next;
        setOwnPresence(next, settingsState.ownStatusMessage || undefined).catch(
            (err) => {
                console.warn("[presence] could not apply busy presence", err);
            },
        );
    });

    reconcileStatusMessage().catch((err) => {
        console.warn("[presence] could not reconcile status message", err);
    });

    // Sliding sync never marks us as syncing, so the server times an online or
    // away presence out to offline about 30s after the last PUT (Synapse's
    // sync_online_timeout). Keep re-asserting it while sliding sync is on,
    // and only then: classic /sync needs no timer at all.
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const armHeartbeat = () => {
        if (isUsingSlidingSync() === (heartbeat !== undefined)) return;
        clearInterval(heartbeat);
        heartbeat = isUsingSlidingSync()
            ? setInterval(() => {
                  if (advertised === "offline") return;
                  setOwnPresence(
                      advertised,
                      settingsState.ownStatusMessage || undefined,
                  ).catch(() => {});
              }, SLIDING_PRESENCE_HEARTBEAT_MS)
            : undefined;
    };
    armHeartbeat();
    const unsubSliding = onSlidingSyncActiveChange(armHeartbeat);

    const idleCheck = setInterval(() => {
        updateAdvertisedPresence().catch(() => {});
    }, IDLE_CHECK_MS);
    // Passive: they only stamp a number. Coming back from away should not
    // wait for the next check, so input while away re-checks at once.
    const onUserInput = () => {
        lastInputTs = Date.now();
        if (advertised === "unavailable" && chosenPresence() === "online")
            updateAdvertisedPresence().catch(() => {});
    };
    const inputEvents = ["pointerdown", "keydown", "wheel", "touchstart"];
    for (const type of inputEvents)
        window.addEventListener(type, onUserInput, { passive: true });

    const unsubPresence = onPresenceEvent((userId) => {
        watchers.get(userId)?.update?.();
    });

    // Sliding sync never pushes presence, so the watched users are re-fetched
    // here, once a poll (refreshUserPresence's TTL keeps it to one fetch per
    // user per minute). Hidden tabs skip it; becoming visible catches up at
    // once. On classic sync this is a no-op: the server pushes presence.
    const refreshWatched = () => {
        if (document.visibilityState !== "visible") return;
        for (const id of watched) refreshUserPresence(id);
    };
    const presencePoll = setInterval(refreshWatched, 30_000);
    document.addEventListener("visibilitychange", refreshWatched);

    return () => {
        disposed = true;
        unsubSliding();
        clearInterval(heartbeat);
        clearInterval(idleCheck);
        clearInterval(presencePoll);
        document.removeEventListener("visibilitychange", refreshWatched);
        for (const type of inputEvents)
            window.removeEventListener(type, onUserInput);
        unsubPresence();
    };
}
