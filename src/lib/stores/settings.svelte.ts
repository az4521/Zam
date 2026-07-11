// Local-only client settings (never synced to the homeserver). Persisted to
// localStorage so they survive reloads. Add debug/dev toggles here.

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

export const settingsState = $state({
    /** Debug: render every Matrix timeline event (state events, edits, redacted,
     *  etc) in the chat log, not just messages/stickers. */
    showAllEvents: readBool("showAllEvents", false),
    /** Keep the mobile room-list drawer open after navigating (Home, spaces,
     *  rooms) instead of auto-closing it. */
    keepSidebarOpen: readBool("keepSidebarOpen", false),
    /** Send private read receipts (m.read.private): the server still tracks
     *  what you've read, but other users can't see it. Default is public. */
    privateReadReceipts: readBool("privateReadReceipts", false),
});

export function setShowAllEvents(value: boolean): void {
    settingsState.showAllEvents = value;
    writeBool("showAllEvents", value);
}

export function setKeepSidebarOpen(value: boolean): void {
    settingsState.keepSidebarOpen = value;
    writeBool("keepSidebarOpen", value);
}

export function setPrivateReadReceipts(value: boolean): void {
    settingsState.privateReadReceipts = value;
    writeBool("privateReadReceipts", value);
}
