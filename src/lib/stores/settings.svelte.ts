// Local-only client settings (never synced to the homeserver). Persisted to
// localStorage so they survive reloads. Add debug/dev toggles here.

import { isPresenceState, type PresenceState } from "$lib/utils/presence";

const STORAGE_PREFIX = "settings:";

function readBool(key: string, fallback: boolean): boolean {
    try {
        const v = localStorage.getItem(STORAGE_PREFIX + key);
        return v === null ? fallback : v === "true";
    } catch {
        return fallback;
    }
}

function writeBool(key: string, value: boolean): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, String(value));
    } catch {
        // ignore (private mode / storage full)
    }
}

function readString(key: string): string | null {
    try {
        return localStorage.getItem(STORAGE_PREFIX + key);
    } catch {
        return null;
    }
}

function writeString(key: string, value: string): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch {
        // ignore (private mode / storage full)
    }
}

function readPresence(key: string, fallback: PresenceState): PresenceState {
    const v = readString(key);
    return isPresenceState(v) ? v : fallback;
}

export const settingsState = $state({
    /** Debug: render every Matrix timeline event (state events, edits, redacted,
     *  etc) in the chat log, not just messages/stickers. */
    showAllEvents: readBool("showAllEvents", false),
    /** Presence advertised to the homeserver (Settings → Account). */
    ownPresence: readPresence("ownPresence", "online"),
});

export function setShowAllEvents(value: boolean): void {
    settingsState.showAllEvents = value;
    writeBool("showAllEvents", value);
}

export function setOwnPresenceSetting(value: PresenceState): void {
    settingsState.ownPresence = value;
    writeString("ownPresence", value);
}
