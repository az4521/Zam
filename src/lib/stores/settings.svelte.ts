// Local-only client settings (never synced to the homeserver). Persisted to
// localStorage so they survive reloads. Add debug/dev toggles here.

import { isPresenceState, type PresenceState } from "$lib/utils/presence";
import { applyTheme, normalizeTheme, type Theme } from "$lib/utils/theme";
import {
    normalizeTimeClock,
    normalizeDateStyle,
    type TimeClock,
    type DateStyle,
} from "$lib/utils/timeFormat";
import {
    normalizeDoubleTapAction,
    type DoubleTapAction,
} from "$lib/utils/doubleTap";
import { normalizeGifTab, type GifTab } from "$lib/utils/klipy";
import {
    parseAudioMap,
    serializeAudioMap,
    type ParticipantAudio,
} from "$lib/utils/participantAudio";
import { auth } from "$lib/stores/auth.svelte";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
import { DEFAULT_ENCRYPT_DMS } from "$lib/utils/roomEncryption";

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

/** Device ids are stored as "" for "system default" → exposed as null. */
function readAccountDeviceId(key: string): string | null {
    const v = readAccountString(key);
    return v ? v : null;
}

function readAccountNumber(key: string, fallback: number): number {
    const v = readAccountString(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
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
    /** Timestamp display (device-global, like theme). See utils/timeFormat. */
    timeClock: normalizeTimeClock(readString("timeClock")),
    dateStyle: normalizeDateStyle(readString("dateStyle")),
    /** Which tab the GIF picker opens on (device-global, like theme). */
    gifDefaultTab: normalizeGifTab(readString("gifDefaultTab")),
    customDatePattern: readString("customDatePattern") || "yyyy-MM-dd",
    alwaysAbsolute: readBool("alwaysAbsolute", false),
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
    /** Whether new direct messages are created encrypted. Default OFF for v1
     *  (see DEFAULT_ENCRYPT_DMS) — opt-in so new DMs don't silently become
     *  unreadable to contacts whose clients aren't set up for E2EE. */
    encryptNewDms: readAccountBool("encryptNewDms", DEFAULT_ENCRYPT_DMS),
    /** Presence advertised to the homeserver (Settings → Account). */
    ownPresence: readPresence("ownPresence", "online"),
    /** Voice: preferred devices (null = system default). Preferences, not
     *  bindings — resolved against the live device list at each use. */
    audioInputDeviceId: readAccountDeviceId("audioInputDeviceId"),
    audioOutputDeviceId: readAccountDeviceId("audioOutputDeviceId"),
    videoInputDeviceId: readAccountDeviceId("videoInputDeviceId"),
    /** Master volume for remote call audio (0..1). */
    callOutputVolume: readAccountNumber("callOutputVolume", 1),
    noiseSuppression: readAccountBool("noiseSuppression", true),
    echoCancellation: readAccountBool("echoCancellation", true),
    autoGainControl: readAccountBool("autoGainControl", true),
    callSoundsEnabled: readAccountBool("callSoundsEnabled", true),
    callSoundsVolume: readAccountNumber("callSoundsVolume", 0.5),
    /** Ring for incoming DM calls. Deliberately independent of
     *  callSoundsEnabled: "no join/leave blips" and "never ring me" are
     *  different wishes. */
    ringEnabled: readAccountBool("ringEnabled", true),
    ringVolume: readAccountNumber("ringVolume", 1),
    /** Per-user call volume/mute, keyed by user id. */
    participantAudio: parseAudioMap(readAccountString("participantAudio")),
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
    settingsState.encryptNewDms = readAccountBool(
        "encryptNewDms",
        DEFAULT_ENCRYPT_DMS,
    );
    settingsState.ownPresence = readPresence("ownPresence", "online");
    settingsState.audioInputDeviceId =
        readAccountDeviceId("audioInputDeviceId");
    settingsState.audioOutputDeviceId = readAccountDeviceId(
        "audioOutputDeviceId",
    );
    settingsState.videoInputDeviceId =
        readAccountDeviceId("videoInputDeviceId");
    settingsState.callOutputVolume = readAccountNumber("callOutputVolume", 1);
    settingsState.noiseSuppression = readAccountBool("noiseSuppression", true);
    settingsState.echoCancellation = readAccountBool("echoCancellation", true);
    settingsState.autoGainControl = readAccountBool("autoGainControl", true);
    settingsState.callSoundsEnabled = readAccountBool(
        "callSoundsEnabled",
        true,
    );
    settingsState.callSoundsVolume = readAccountNumber("callSoundsVolume", 0.5);
    settingsState.ringEnabled = readAccountBool("ringEnabled", true);
    settingsState.ringVolume = readAccountNumber("ringVolume", 1);
    settingsState.participantAudio = parseAudioMap(
        readAccountString("participantAudio"),
    );
}

export function setTheme(value: Theme): void {
    settingsState.theme = value;
    writeString("theme", value);
    applyTheme(value);
}

export function setTimeClock(value: TimeClock): void {
    settingsState.timeClock = value;
    writeString("timeClock", value);
}

export function setDateStyle(value: DateStyle): void {
    settingsState.dateStyle = value;
    writeString("dateStyle", value);
}

export function setGifDefaultTab(value: GifTab): void {
    settingsState.gifDefaultTab = value;
    writeString("gifDefaultTab", value);
}

export function setCustomDatePattern(value: string): void {
    settingsState.customDatePattern = value;
    writeString("customDatePattern", value);
}

export function setAlwaysAbsolute(value: boolean): void {
    settingsState.alwaysAbsolute = value;
    writeBool("alwaysAbsolute", value);
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

export function setEncryptNewDms(value: boolean): void {
    settingsState.encryptNewDms = value;
    writeAccountBool("encryptNewDms", value);
}

export function setOwnPresenceSetting(value: PresenceState): void {
    settingsState.ownPresence = value;
    writeAccountString("ownPresence", value);
}

export function setAudioInputDeviceId(value: string | null): void {
    settingsState.audioInputDeviceId = value;
    writeAccountString("audioInputDeviceId", value ?? "");
}

export function setAudioOutputDeviceId(value: string | null): void {
    settingsState.audioOutputDeviceId = value;
    writeAccountString("audioOutputDeviceId", value ?? "");
}

export function setVideoInputDeviceId(value: string | null): void {
    settingsState.videoInputDeviceId = value;
    writeAccountString("videoInputDeviceId", value ?? "");
}

export function setCallOutputVolume(value: number): void {
    settingsState.callOutputVolume = Math.min(1, Math.max(0, value));
    writeAccountString(
        "callOutputVolume",
        String(settingsState.callOutputVolume),
    );
}

export function setNoiseSuppression(value: boolean): void {
    settingsState.noiseSuppression = value;
    writeAccountBool("noiseSuppression", value);
}

export function setEchoCancellation(value: boolean): void {
    settingsState.echoCancellation = value;
    writeAccountBool("echoCancellation", value);
}

export function setAutoGainControl(value: boolean): void {
    settingsState.autoGainControl = value;
    writeAccountBool("autoGainControl", value);
}

export function setCallSoundsEnabled(value: boolean): void {
    settingsState.callSoundsEnabled = value;
    writeAccountBool("callSoundsEnabled", value);
}

export function setCallSoundsVolume(value: number): void {
    settingsState.callSoundsVolume = Math.min(1, Math.max(0, value));
    writeAccountString(
        "callSoundsVolume",
        String(settingsState.callSoundsVolume),
    );
}

export function setRingEnabled(value: boolean): void {
    settingsState.ringEnabled = value;
    writeAccountBool("ringEnabled", value);
}

export function setRingVolume(value: number): void {
    settingsState.ringVolume = Math.min(1, Math.max(0, value));
    writeAccountString("ringVolume", String(settingsState.ringVolume));
}

/** Per-user call volume/mute. Stored as one account-scoped JSON blob. */
export function setParticipantAudioSetting(
    userId: string,
    next: ParticipantAudio,
): void {
    // Reassigning the Map rather than mutating it is deliberate: $state tracks
    // the reference, so an in-place map.set would not retrigger derivations.
    const map = new Map(settingsState.participantAudio);
    map.set(userId, next);
    settingsState.participantAudio = map;
    writeAccountString("participantAudio", serializeAudioMap(map));
}
