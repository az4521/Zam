// Local-only client settings (never synced to the homeserver). Persisted to
// localStorage so they survive reloads. Add debug/dev toggles here.

import { isPresenceState, type PresenceState } from "$lib/utils/presence";
import { applyTheme, normalizeTheme, type Theme } from "$lib/utils/theme";
import {
    normalizeDoubleTapAction,
    type DoubleTapAction,
} from "$lib/utils/doubleTap";
import { auth } from "$lib/stores/auth.svelte";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";

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

function readAccountString(key: string): string | null {
    return readScoped(STORAGE_PREFIX + key, auth.userId);
}

function writeAccountString(key: string, value: string): void {
    writeScoped(STORAGE_PREFIX + key, auth.userId, value);
}

function readAccountBool(key: string, fallback: boolean): boolean {
    const value = readAccountString(key);
    return value === null ? fallback : value === "true";
}

function writeAccountBool(key: string, value: boolean): void {
    writeAccountString(key, String(value));
}

function readPresence(key: string, fallback: PresenceState): PresenceState {
    const v = readAccountString(key);
    return isPresenceState(v) ? v : fallback;
}

function readReactionOverrides(): Record<string, string> {
    try {
        const parsed = JSON.parse(
            readAccountString("doubleTapReactionBySpace") ?? "{}",
        );
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return {};
        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === "string" && entry[1].length > 0,
            ),
        );
    } catch {
        return {};
    }
}

export const settingsState = $state({
    /** Local interface color theme. */
    theme: normalizeTheme(readString("theme")),
    ownDoubleTapAction: normalizeDoubleTapAction(
        readAccountString("ownDoubleTapAction"),
        "none",
        true,
    ),
    otherDoubleTapAction: normalizeDoubleTapAction(
        readAccountString("otherDoubleTapAction"),
        "none",
        false,
    ),
    doubleTapReaction: readAccountString("doubleTapReaction") || "👍",
    doubleTapReactionBySpace: readReactionOverrides(),
    /** Debug: render every Matrix timeline event (state events, edits, redacted,
     *  etc) in the chat log, not just messages/stickers. */
    showAllEvents: readBool("showAllEvents", false),
    /** Keep the mobile room-list drawer open after navigating (Home, spaces,
     *  rooms) instead of auto-closing it. */
    keepSidebarOpen: readBool("keepSidebarOpen", false),
    /** Send private read receipts (m.read.private): the server still tracks
     *  what you've read, but other users can't see it. Default is public. */
    privateReadReceipts: readAccountBool("privateReadReceipts", false),
    /** Presence advertised to the homeserver (Settings → Account). */
    ownPresence: readPresence("ownPresence", "online"),
});

applyTheme(settingsState.theme);

/** Reload settings whose meaning belongs to the active Matrix account. */
export function reloadAccountSettings(): void {
    settingsState.ownDoubleTapAction = normalizeDoubleTapAction(
        readAccountString("ownDoubleTapAction"),
        "none",
        true,
    );
    settingsState.otherDoubleTapAction = normalizeDoubleTapAction(
        readAccountString("otherDoubleTapAction"),
        "none",
        false,
    );
    settingsState.doubleTapReaction =
        readAccountString("doubleTapReaction") || "👍";
    settingsState.doubleTapReactionBySpace = readReactionOverrides();
    settingsState.privateReadReceipts = readAccountBool(
        "privateReadReceipts",
        false,
    );
    settingsState.ownPresence = readPresence("ownPresence", "online");
}

export function setTheme(value: Theme): void {
    settingsState.theme = value;
    writeString("theme", value);
    applyTheme(value);
}

export function setOwnDoubleTapAction(value: DoubleTapAction): void {
    settingsState.ownDoubleTapAction = normalizeDoubleTapAction(
        value,
        "none",
        true,
    );
    writeAccountString("ownDoubleTapAction", settingsState.ownDoubleTapAction);
}

export function setOtherDoubleTapAction(value: DoubleTapAction): void {
    settingsState.otherDoubleTapAction = normalizeDoubleTapAction(
        value,
        "none",
        false,
    );
    writeAccountString(
        "otherDoubleTapAction",
        settingsState.otherDoubleTapAction,
    );
}

export function setDoubleTapReaction(value: string): void {
    if (!value) return;
    settingsState.doubleTapReaction = value;
    writeAccountString("doubleTapReaction", value);
}

export function setSpaceDoubleTapReaction(
    spaceId: string,
    value: string | null,
): void {
    const next = { ...settingsState.doubleTapReactionBySpace };
    if (value) next[spaceId] = value;
    else delete next[spaceId];
    settingsState.doubleTapReactionBySpace = next;
    writeAccountString("doubleTapReactionBySpace", JSON.stringify(next));
}

export function getDoubleTapReaction(spaceId: string | null): string {
    return (
        (spaceId && settingsState.doubleTapReactionBySpace[spaceId]) ||
        settingsState.doubleTapReaction
    );
}

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
    writeAccountBool("privateReadReceipts", value);
}

export function setOwnPresenceSetting(value: PresenceState): void {
    settingsState.ownPresence = value;
    writeAccountString("ownPresence", value);
}
