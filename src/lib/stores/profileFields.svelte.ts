import { fetchExtendedProfile } from "$lib/matrix/client";
import { auth } from "$lib/stores/auth.svelte";
import {
    activeBase,
    getPresetColors,
    settingsState,
} from "$lib/stores/settings.svelte";
import {
    PROFILE_FIELDS,
    parseColourPreference,
    readField,
    type ExtendedProfile,
} from "$lib/utils/extendedProfile";
import { pickNameColour } from "$lib/utils/nameColour";
import { resolveEffectiveColors } from "$lib/utils/themePalette";

// Other users' extended profiles (pronouns, bio, name colour...), fetched
// lazily and cached. The timeline asks for every sender it draws, so requests
// are de-duplicated and capped rather than fired all at once.

const TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const MAX_CONCURRENT = 4;

interface Entry {
    profile: ExtendedProfile;
    expires: number;
}

class ProfileFieldsState {
    /** Bumped whenever an entry lands, so readers re-derive. */
    tick = $state(0);
}

export const profileFieldsState = new ProfileFieldsState();

const cache = new Map<string, Entry>();
const queued: string[] = [];
const inFlight = new Set<string>();

// Scoped to the signed-in account: another account may see different fields.
const cacheKey = (userId: string) => `${auth.userId ?? ""}|${userId}`;

/**
 * A user's cached extended profile, empty when none is loaded (yet). Reactive:
 * call it inside a `$derived` and it re-runs when the profile arrives.
 */
export function getCachedProfile(userId: string): ExtendedProfile | undefined {
    void profileFieldsState.tick;
    return cache.get(cacheKey(userId))?.profile;
}

/**
 * The colour to draw `userId`'s name in on the current theme, or undefined for
 * the default. Also asks for the profile if it is not loaded. Reactive.
 */
export function nameColourFor(userId: string): string | undefined {
    if (!userId || !settingsState.showNameColours) return undefined;
    requestProfile(userId);
    const preference = parseColourPreference(
        readField(getCachedProfile(userId), PROFILE_FIELDS.usernameColour),
    );
    if (!preference) return undefined;
    const { background } = resolveEffectiveColors(
        activeBase(),
        getPresetColors(settingsState.activePreset),
    );
    return pickNameColour(preference, background) ?? undefined;
}

/** Ask for a profile to be (re)loaded if it is missing or stale. */
export function requestProfile(userId: string): void {
    if (!userId) return;
    const key = cacheKey(userId);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return;
    if (inFlight.has(key) || queued.includes(userId)) return;
    queued.push(userId);
    pump();
}

/** Store a profile we already know, e.g. right after saving our own. */
export function setCachedProfile(
    userId: string,
    profile: ExtendedProfile | null,
): void {
    cache.set(cacheKey(userId), {
        profile: profile ?? {},
        expires: Date.now() + TTL_MS,
    });
    profileFieldsState.tick++;
}

function pump(): void {
    while (inFlight.size < MAX_CONCURRENT && queued.length > 0) {
        const userId = queued.shift()!;
        const key = cacheKey(userId);
        inFlight.add(key);
        fetchExtendedProfile(userId)
            .then((profile) => {
                cache.set(key, {
                    profile: profile ?? {},
                    expires: Date.now() + TTL_MS,
                });
            })
            .catch(() => {
                // Not found, forbidden or offline: try again later, quietly.
                cache.set(key, {
                    profile: {},
                    expires: Date.now() + FAILURE_TTL_MS,
                });
            })
            .finally(() => {
                inFlight.delete(key);
                profileFieldsState.tick++;
                pump();
            });
    }
}
