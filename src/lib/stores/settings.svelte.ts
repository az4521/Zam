// Client settings, persisted to localStorage so they survive reloads.
//
// Most are local-only (debug/dev toggles, voice device picks). The settings
// behind the Customization panel are additionally mirrored to the homeserver
// as account data so they follow the account across devices — localStorage
// stays the synchronous boot cache, the server is the source of truth once a
// sync lands. See stores/customizationSync.svelte for the transport.

import { isPresenceState, type PresenceState } from "$lib/utils/presence";
import {
    applyTheme,
    applyPreset,
    normalizeTheme,
    type Theme,
} from "$lib/utils/theme";
import {
    normalizeTimeClock,
    normalizeDateStyle,
    previewDatePattern,
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
import {
    normalizeLinkPreviewMedia,
    type LinkPreviewMedia,
} from "$lib/utils/linkPreviewPolicy";
import { normalizeGraceMs } from "$lib/utils/activeSession";
import type { ClientCustomization } from "$lib/utils/customization";
import { applyThemeColors } from "$lib/utils/theme";
import { sanitizeThemeColors, type ThemeColors } from "$lib/utils/themePalette";
import {
    sanitizeCustomPreset,
    isBuiltinPreset,
    defaultActivePresetName,
    resolveActivePreset,
    forkFromEdit,
    migrateThemeToPresetName,
    type CustomPreset,
    type ThemeBase,
} from "$lib/utils/themePreset";

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

function writeAccountNumber(key: string, value: number): void {
    writeAccountString(key, String(value));
}

/** Device ids are stored as "" for "system default" → exposed as null. */
function readAccountDeviceId(key: string): string | null {
    const v = readAccountString(key);
    return v ? v : null;
}

/** Volumes only: the value is CLAMPED to 0..1. A number setting with any
 *  other range (e.g. a duration in ms) must not use this. */
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

function readThemePresets(): Record<string, CustomPreset> {
    try {
        const parsed = JSON.parse(readString("themePresets") ?? "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return {};
        const result: Record<string, CustomPreset> = {};
        for (const [key, value] of Object.entries(parsed)) {
            // Try new {base, colors} shape first
            let sanitized = sanitizeCustomPreset(value);
            // Back-compat: if it looks like old colors-only shape, wrap it
            if (
                sanitized === null &&
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                !(value as any).base
            ) {
                const colors = sanitizeThemeColors(value);
                if (Object.keys(colors).length > 0) {
                    sanitized = { base: "dark", colors };
                }
            }
            if (sanitized !== null) {
                result[key] = sanitized;
            }
        }
        return result;
    } catch {
        return {};
    }
}

// Read and migrate legacy theme setting to activePreset
const legacyTheme = readString("theme");
const storedActivePreset = readString("activePreset") || "";
const initialActivePreset =
    storedActivePreset ||
    (legacyTheme ? migrateThemeToPresetName(legacyTheme) : "");

export const settingsState = $state({
    /** COMPAT SHIM: Legacy local interface color theme. Now derived from activePreset's base.
     * Use activeBase for the actual base; this exists for back-compat only. */
    get theme(): Theme {
        const resolved = resolveActivePreset(
            this.activePreset,
            this.themePresets,
        );
        return resolved.base as Theme;
    },
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
    /** Device-global: whether the packaged desktop/Android build auto-downloads
     *  updates. Default ON; the escape hatch is this toggle. */
    autoUpdateEnabled: readBool("autoUpdateEnabled", true),
    /** Device-global: render the read-receipt avatars under messages. Default
     *  ON (existing behaviour). Display only — it does not change whether we
     *  SEND receipts; that is `privateReadReceipts`. */
    showReadReceiptAvatars: readBool("showReadReceiptAvatars", true),
    /** Device-global: which link-preview media may load automatically.
     *  "all" (default) is the historical behaviour; "proxied" loads only the
     *  copies our own homeserver serves, so third-party hosts never learn the
     *  reader's IP or when they read a message; "none" shows text-only cards.
     *  Each preview keeps a per-message button to load its media on demand.
     *
     *  ⚠ Must stay readString/writeString (device-global), for the same reason
     *  spelled out on hideNotificationBody: switching a bare key to the scoped
     *  reader would make readScoped() adopt it into the ACTIVE account's scope
     *  and delete the bare key, silently resetting it for every other account
     *  on this device. It is deliberately NOT part of ClientCustomization
     *  either — this is a per-device trust decision, not a look-and-feel one. */
    linkPreviewMedia: normalizeLinkPreviewMedia(readString("linkPreviewMedia")),
    /** Device-global: keep message text out of OS notifications — they say
     *  "<sender> sent a message" instead of the body. Default OFF. Applies to
     *  in-app popups, web push (service worker) and Android FCM on THIS
     *  device; the in-app notification inbox still shows real text.
     *
     *  ⚠ Must stay readBool/writeBool (device-global). Converting it to
     *  readAccountBool/writeAccountBool would make readScoped() adopt the bare
     *  key into the ACTIVE account's scope and DELETE it, silently dropping the
     *  toggle for every other account on this device — with no error anywhere. */
    hideNotificationBody: readBool("hideNotificationBody", false),
    /** Keep the mobile room-list drawer open after navigating (Home, spaces,
     *  rooms) instead of auto-closing it. */
    keepSidebarOpen: readBool("keepSidebarOpen", false),
    /** Send private read receipts (m.read.private): the server still tracks
     *  what you've read, but other users can't see it. Default is public. */
    privateReadReceipts: readAccountBool("privateReadReceipts", false),
    /** Whether new direct messages are created encrypted. Default ON (see
     *  DEFAULT_ENCRYPT_DMS, user decision 2026-07-30). Account-scoped and only
     *  a fallback: an account that turned the toggle off stays off, because
     *  readAccountBool falls back only when nothing is stored. Existing DMs are
     *  never retro-encrypted, and the surfaces that create DMs still ask
     *  shouldEncryptNewDm(), which refuses when crypto didn't start. */
    encryptNewDms: readAccountBool("encryptNewDms", DEFAULT_ENCRYPT_DMS),
    /** How long (ms) this device stays quiet after ANOTHER device of this
     *  account was last focused. 0 = off (always notify). Defaults to
     *  DEFAULT_GRACE_MS via normalizeGraceMs. Account-scoped; localStorage is
     *  only the boot cache — the authoritative copy rides in the
     *  moe.crafty.matrix.active_session account-data blob, and a change made
     *  on another device is adopted here when that blob syncs. */
    activeSessionGraceMs: normalizeGraceMs(
        readAccountString("activeSessionGraceMs"),
    ),
    /** Refuse to send to unverified devices (globalBlacklistUnverifiedDevices).
     *  Default OFF: turning it on means messages silently fail to reach any
     *  device the user hasn't verified. */
    sendToVerifiedOnly: readAccountBool("sendToVerifiedOnly", false),
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
    /** Mirror the local camera self-view (horizontal flip). Local display
     *  only — remote participants always see you un-mirrored. */
    mirrorCamera: readAccountBool("mirrorCamera", true),
    /** Include system/tab audio when screen sharing. */
    shareSystemAudio: readAccountBool("shareSystemAudio", true),
    /** Screen-share capture target, applied when a share starts (a mid-share
     *  change would re-prompt the OS picker). Stored as strings for the
     *  <select>s; fps is parsed to a number at the call site. */
    screenShareResolution: readAccountString("screenShareResolution") ?? "1080",
    screenShareFps: readAccountString("screenShareFps") ?? "30",
    callSoundsEnabled: readAccountBool("callSoundsEnabled", true),
    callSoundsVolume: readAccountNumber("callSoundsVolume", 0.5),
    /** Ring for incoming DM calls. Deliberately independent of
     *  callSoundsEnabled: "no join/leave blips" and "never ring me" are
     *  different wishes. */
    ringEnabled: readAccountBool("ringEnabled", true),
    ringVolume: readAccountNumber("ringVolume", 1),
    /** Per-user call volume/mute, keyed by user id. */
    participantAudio: parseAudioMap(readAccountString("participantAudio")),
    /** Theme color presets. */
    themePresets: readThemePresets(),
    /** Active theme preset name. */
    activePreset: initialActivePreset,
});

/** The active base theme (dark/light/amoled), derived from activePreset. */
export function activeBase(): ThemeBase {
    return resolveActivePreset(
        settingsState.activePreset,
        settingsState.themePresets,
    ).base;
}

/** COMPAT SHIM: Get just the colors from a preset by name. Returns empty object if preset not found.
 * Use this in components that were written for the old colors-only themePresets. */
export function getPresetColors(name: string): ThemeColors {
    const preset = settingsState.themePresets[name];
    return preset?.colors ?? {};
}

// Boot apply: apply the active preset (base + colors)
const bootBase = activeBase();
const bootResolved = resolveActivePreset(
    settingsState.activePreset,
    settingsState.themePresets,
);
const bootColors =
    Object.keys(bootResolved.colors).length === 0 ? null : bootResolved.colors;
applyPreset(bootBase, bootColors);
writeString("themeBase", bootBase);

/** Returns the colors for the active preset, or null if none is active or it has no overrides. */
export function activePresetColors(): ThemeColors | null {
    const name = settingsState.activePreset;
    if (!name) return null;
    const resolved = resolveActivePreset(name, settingsState.themePresets);
    if (!resolved.colors || Object.keys(resolved.colors).length === 0)
        return null;
    return resolved.colors;
}

// ── Customization sync ──────────────────────────────────────────────────
// The transport registers a listener here at app mount. Inverting the
// dependency this way is deliberate: matrix/client already imports this
// store, so importing the client from here would close a module cycle.
// Until a listener is registered (e.g. before login) changes stay local.

let customizationListener: (() => void) | null = null;

export function setCustomizationListener(cb: (() => void) | null): void {
    customizationListener = cb;
}

function customizationChanged(): void {
    customizationListener?.();
}

/** The Customization panel's settings, in account-data wire form. */
export function customizationSnapshot(): ClientCustomization {
    return {
        theme: settingsState.theme,
        timeClock: settingsState.timeClock,
        dateStyle: settingsState.dateStyle,
        customDatePattern: settingsState.customDatePattern,
        alwaysAbsolute: settingsState.alwaysAbsolute,
        gifDefaultTab: settingsState.gifDefaultTab,
        keepSidebarOpen: settingsState.keepSidebarOpen,
        ownDoubleTapAction: settingsState.ownDoubleTapAction,
        otherDoubleTapAction: settingsState.otherDoubleTapAction,
        doubleTapReaction: settingsState.doubleTapReaction,
        doubleTapReactionBySpace: { ...settingsState.doubleTapReactionBySpace },
        themePresets: Object.fromEntries(
            Object.entries(settingsState.themePresets).map(([k, v]) => [
                k,
                { ...v },
            ]),
        ),
        activePreset: settingsState.activePreset,
    };
}

/**
 * Adopt customization settings from account data, normalizing each field the
 * same way a local read would. Writes state and the localStorage cache
 * directly rather than calling the setters, so applying a remote update does
 * not notify the transport and bounce straight back to the server. Omitted
 * fields keep their current value.
 */
export function applyCustomization(c: ClientCustomization): void {
    // Legacy theme field: migrate to activePreset if activePreset is not already set
    if (
        c.theme !== undefined &&
        !c.activePreset &&
        !settingsState.activePreset
    ) {
        const migrated = migrateThemeToPresetName(c.theme);
        settingsState.activePreset = migrated;
        writeString("activePreset", migrated);
        const resolved = resolveActivePreset(
            migrated,
            settingsState.themePresets,
        );
        writeString("themeBase", resolved.base);
        const colors =
            Object.keys(resolved.colors).length === 0 ? null : resolved.colors;
        applyPreset(resolved.base as Theme, colors);
    }
    if (c.timeClock !== undefined) {
        settingsState.timeClock = normalizeTimeClock(c.timeClock);
        writeString("timeClock", settingsState.timeClock);
    }
    if (c.dateStyle !== undefined) {
        settingsState.dateStyle = normalizeDateStyle(c.dateStyle);
        writeString("dateStyle", settingsState.dateStyle);
    }
    // Mirrors the guard in the settings UI: a pattern date-fns rejects would
    // blank every timestamp in the app, so never adopt one off the wire.
    if (
        c.customDatePattern &&
        previewDatePattern(c.customDatePattern) !== null
    ) {
        settingsState.customDatePattern = c.customDatePattern;
        writeString("customDatePattern", c.customDatePattern);
    }
    if (c.alwaysAbsolute !== undefined) {
        settingsState.alwaysAbsolute = c.alwaysAbsolute;
        writeBool("alwaysAbsolute", c.alwaysAbsolute);
    }
    if (c.gifDefaultTab !== undefined) {
        settingsState.gifDefaultTab = normalizeGifTab(c.gifDefaultTab);
        writeString("gifDefaultTab", settingsState.gifDefaultTab);
    }
    if (c.keepSidebarOpen !== undefined) {
        settingsState.keepSidebarOpen = c.keepSidebarOpen;
        writeBool("keepSidebarOpen", c.keepSidebarOpen);
    }
    if (c.ownDoubleTapAction !== undefined) {
        settingsState.ownDoubleTapAction = normalizeDoubleTapAction(
            c.ownDoubleTapAction,
            "none",
            true,
        );
        writeAccountString(
            "ownDoubleTapAction",
            settingsState.ownDoubleTapAction,
        );
    }
    if (c.otherDoubleTapAction !== undefined) {
        settingsState.otherDoubleTapAction = normalizeDoubleTapAction(
            c.otherDoubleTapAction,
            "none",
            false,
        );
        writeAccountString(
            "otherDoubleTapAction",
            settingsState.otherDoubleTapAction,
        );
    }
    if (c.doubleTapReaction) {
        settingsState.doubleTapReaction = c.doubleTapReaction;
        writeAccountString("doubleTapReaction", c.doubleTapReaction);
    }
    if (c.doubleTapReactionBySpace !== undefined) {
        settingsState.doubleTapReactionBySpace = {
            ...c.doubleTapReactionBySpace,
        };
        writeAccountString(
            "doubleTapReactionBySpace",
            JSON.stringify(settingsState.doubleTapReactionBySpace),
        );
    }
    if (c.themePresets !== undefined) {
        const clean: Record<string, CustomPreset> = {};
        for (const [name, preset] of Object.entries(c.themePresets)) {
            const sanitized = sanitizeCustomPreset(preset);
            if (sanitized !== null) {
                clean[name] = sanitized;
            }
        }
        settingsState.themePresets = clean;
        writeString("themePresets", JSON.stringify(clean));
    }
    if (c.activePreset !== undefined) {
        settingsState.activePreset = c.activePreset;
        writeString("activePreset", c.activePreset);
    }
    if (c.themePresets !== undefined || c.activePreset !== undefined) {
        const resolved = resolveActivePreset(
            settingsState.activePreset,
            settingsState.themePresets,
        );
        writeString("themeBase", resolved.base);
        const colors =
            Object.keys(resolved.colors).length === 0 ? null : resolved.colors;
        applyPreset(resolved.base as Theme, colors);
    }
}

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
    settingsState.activeSessionGraceMs = normalizeGraceMs(
        readAccountString("activeSessionGraceMs"),
    );
    settingsState.sendToVerifiedOnly = readAccountBool(
        "sendToVerifiedOnly",
        false,
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
    settingsState.mirrorCamera = readAccountBool("mirrorCamera", true);
    settingsState.shareSystemAudio = readAccountBool("shareSystemAudio", true);
    settingsState.screenShareResolution =
        readAccountString("screenShareResolution") ?? "1080";
    settingsState.screenShareFps = readAccountString("screenShareFps") ?? "30";
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

/** COMPAT SHIM: Legacy theme setter. Now switches to the matching built-in preset.
 * setTheme("dark") → activate "Default Dark", etc. */
export function setTheme(value: Theme): void {
    const presetName = migrateThemeToPresetName(value);
    setActivePreset(presetName);
}

export function setTimeClock(value: TimeClock): void {
    settingsState.timeClock = value;
    writeString("timeClock", value);
    customizationChanged();
}

export function setDateStyle(value: DateStyle): void {
    settingsState.dateStyle = value;
    writeString("dateStyle", value);
    customizationChanged();
}

export function setGifDefaultTab(value: GifTab): void {
    settingsState.gifDefaultTab = value;
    writeString("gifDefaultTab", value);
    customizationChanged();
}

export function setCustomDatePattern(value: string): void {
    settingsState.customDatePattern = value;
    writeString("customDatePattern", value);
    customizationChanged();
}

export function setAlwaysAbsolute(value: boolean): void {
    settingsState.alwaysAbsolute = value;
    writeBool("alwaysAbsolute", value);
    customizationChanged();
}

export function setOwnDoubleTapAction(value: DoubleTapAction): void {
    settingsState.ownDoubleTapAction = normalizeDoubleTapAction(
        value,
        "none",
        true,
    );
    writeAccountString("ownDoubleTapAction", settingsState.ownDoubleTapAction);
    customizationChanged();
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
    customizationChanged();
}

export function setDoubleTapReaction(value: string): void {
    if (!value) return;
    settingsState.doubleTapReaction = value;
    writeAccountString("doubleTapReaction", value);
    customizationChanged();
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
    customizationChanged();
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

export function setAutoUpdateEnabled(value: boolean): void {
    settingsState.autoUpdateEnabled = value;
    writeBool("autoUpdateEnabled", value);
}

export function setShowReadReceiptAvatars(value: boolean): void {
    settingsState.showReadReceiptAvatars = value;
    writeBool("showReadReceiptAvatars", value);
}

export function setLinkPreviewMedia(value: LinkPreviewMedia): void {
    const next = normalizeLinkPreviewMedia(value);
    settingsState.linkPreviewMedia = next;
    writeString("linkPreviewMedia", next);
}

export function setHideNotificationBody(value: boolean): void {
    settingsState.hideNotificationBody = value;
    writeBool("hideNotificationBody", value);
}

export function setKeepSidebarOpen(value: boolean): void {
    settingsState.keepSidebarOpen = value;
    writeBool("keepSidebarOpen", value);
    customizationChanged();
}

export function setPrivateReadReceipts(value: boolean): void {
    settingsState.privateReadReceipts = value;
    writeAccountBool("privateReadReceipts", value);
}

export function setEncryptNewDms(value: boolean): void {
    settingsState.encryptNewDms = value;
    writeAccountBool("encryptNewDms", value);
}

/** Persist the grace locally. Publishing it to account data (so other
 *  devices and the SW/Android readers see it) is the caller's job — this
 *  store deliberately holds no SDK dependency. */
export function setActiveSessionGraceMs(value: number): void {
    const grace = normalizeGraceMs(value);
    settingsState.activeSessionGraceMs = grace;
    writeAccountNumber("activeSessionGraceMs", grace);
}

export function setSendToVerifiedOnly(value: boolean): void {
    settingsState.sendToVerifiedOnly = value;
    writeAccountBool("sendToVerifiedOnly", value);
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

export function setMirrorCamera(value: boolean): void {
    settingsState.mirrorCamera = value;
    writeAccountBool("mirrorCamera", value);
}

export function setShareSystemAudio(value: boolean): void {
    settingsState.shareSystemAudio = value;
    writeAccountBool("shareSystemAudio", value);
}

export function setScreenShareResolution(value: string): void {
    settingsState.screenShareResolution = value;
    writeAccountString("screenShareResolution", value);
}

export function setScreenShareFps(value: string): void {
    settingsState.screenShareFps = value;
    writeAccountString("screenShareFps", value);
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

/** LEGACY: Save a theme preset (colors-only). Now wraps as {base:"dark", colors}.
 * Use saveCustomPreset for the new base+colors API. */
export function saveThemePreset(name: string, colors: ThemeColors): void {
    if (!name) return;
    const clean = sanitizeThemeColors(colors);
    const preset: CustomPreset = { base: "dark", colors: clean };
    settingsState.themePresets = {
        ...settingsState.themePresets,
        [name]: preset,
    };
    writeString("themePresets", JSON.stringify(settingsState.themePresets));
    if (settingsState.activePreset === name) applyThemeColors(clean);
    customizationChanged();
}

export function deleteThemePreset(name: string): void {
    const next = { ...settingsState.themePresets };
    delete next[name];
    settingsState.themePresets = next;
    writeString("themePresets", JSON.stringify(next));
    if (settingsState.activePreset === name) {
        setActivePreset("");
        return; // setActivePreset already notifies + applies
    }
    customizationChanged();
}

export function setActivePreset(name: string): void {
    settingsState.activePreset = name;
    writeString("activePreset", name);
    const resolved = resolveActivePreset(name, settingsState.themePresets);
    writeString("themeBase", resolved.base);
    const colors =
        Object.keys(resolved.colors).length === 0 ? null : resolved.colors;
    applyPreset(resolved.base as Theme, colors);
    customizationChanged();
}

/** Save a custom preset with base and color overrides. Refuses to shadow a built-in name. */
export function saveCustomPreset(
    name: string,
    base: ThemeBase,
    colors: Partial<Record<string, string>>,
): void {
    if (!name) return;
    if (isBuiltinPreset(name)) {
        throw new Error(`Cannot save a preset with built-in name: ${name}`);
    }
    const clean = sanitizeThemeColors(colors);
    const preset: CustomPreset = { base, colors: clean };
    settingsState.themePresets = {
        ...settingsState.themePresets,
        [name]: preset,
    };
    writeString("themePresets", JSON.stringify(settingsState.themePresets));
    if (settingsState.activePreset === name) {
        applyPreset(base as Theme, clean);
    }
    customizationChanged();
}

/** Delete a custom preset. Refuses to delete a built-in. Falls back to Default Dark if deleting the active preset. */
export function deleteCustomPreset(name: string): void {
    if (isBuiltinPreset(name)) return; // No-op for built-ins
    const next = { ...settingsState.themePresets };
    delete next[name];
    settingsState.themePresets = next;
    writeString("themePresets", JSON.stringify(next));
    if (settingsState.activePreset === name) {
        setActivePreset(defaultActivePresetName());
        return; // setActivePreset already notifies + applies
    }
    customizationChanged();
}

/** Fork the active preset with edited colors. Used for edit-a-builtin → fork workflow.
 * Inherits the active base, dedupes the name if it shadows a built-in, and saves the new preset. */
export function forkActivePreset(
    newName: string,
    editedColors: Partial<Record<string, string>>,
): void {
    const sourceBase = activeBase();
    const forked = forkFromEdit(sourceBase, editedColors, newName);
    saveCustomPreset(forked.name, forked.preset.base, forked.preset.colors);
}
