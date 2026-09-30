// Pure, data-driven index of searchable settings, plus a ranker. No Svelte,
// no SDK imports — so it is unit-testable and the later settings overhaul can
// extend the index without touching the search algorithm.
//
// `anchor` is an OPTIONAL scroll target: the id in a panel's
// `data-setting-anchor="<id>"` attribute. When present AND rendered, AppSettings
// scrolls to it and flashes it after navigating; when absent (or the control is
// conditionally hidden) selecting the result simply lands on the tab.
import { t } from "$lib/i18n";

import type { SettingsTab } from "$lib/utils/settingsNav";

export interface SettingsSearchEntry {
    /** The tab that owns this setting — navigation target. */
    tab: SettingsTab;
    /** User-facing label, matched against the query. */
    label: string;
    /** Extra synonyms a user might type (matched, never displayed). */
    keywords?: readonly string[];
    /** Optional `data-setting-anchor` id to scroll to within the panel. */
    anchor?: string;
}

/**
 * The searchable settings. Order is display + tie-break order (stable). Add
 * entries here as new settings ship — this is the single extension point.
 * `anchor` is wired only for the crowded, parked-branch-free panels
 * (customization, notifications) + the inline theme toggle; other tabs just
 * navigate. Anchor ids MUST match the `data-setting-anchor` attributes in the
 * corresponding components.
 */
export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchEntry[] = [
    // account
    {
        tab: "account",
        label: t("settingsSearch.displayName"),
        keywords: ["name", "nickname", "username"],
    },
    {
        tab: "account",
        label: t("settingsSearch.avatar"),
        keywords: ["photo", "picture", "profile pic", "image"],
    },
    {
        tab: "account",
        label: t("settingsSearch.presence"),
        keywords: ["online", "away", "busy", "status", "availability"],
    },
    {
        tab: "account",
        label: t("settingsSearch.changePassword"),
        keywords: ["password", "credentials"],
    },
    {
        tab: "account",
        label: t("settingsSearch.logOut"),
        keywords: ["sign out", "logout"],
    },
    {
        tab: "account",
        label: t("settingsSearch.deactivateAccount"),
        keywords: ["delete account", "close account", "remove account"],
    },
    // security (sessions subsection)
    {
        tab: "security",
        label: t("settingsSearch.sessions"),
        keywords: ["devices", "logins", "sign out other"],
    },
    {
        tab: "security",
        label: t("settingsSearch.encryptNewDirectMessages"),
        keywords: ["encryption", "e2e", "dm", "private"],
    },
    {
        tab: "security",
        label: t("settingsSearch.onlySendToVerifiedDevices"),
        keywords: ["verified", "trust", "cross-signing"],
    },
    // security
    {
        tab: "security",
        label: t("settingsSearch.setUpRecovery"),
        keywords: ["backup", "recovery key", "cross-signing", "4s"],
    },
    {
        tab: "security",
        label: t("settingsSearch.restoreMessageHistory"),
        keywords: ["key backup", "unlock", "passphrase", "recovery"],
    },
    {
        tab: "security",
        label: t("settingsSearch.verifyThisSession"),
        keywords: ["verification", "verify device"],
    },
    // appearance
    {
        tab: "appearance",
        label: t("settingsSearch.rightAlignMyMessages"),
        keywords: ["bubble", "layout", "alignment", "imessage"],
        anchor: "theme-rightalign",
    },
    {
        tab: "account",
        label: t("settingsSearch.showWhenIAmInA"),
        keywords: ["call status", "in a call", "presence", "profile"],
    },
    {
        tab: "appearance",
        label: t("settingsSearch.showNameColours"),
        keywords: ["username colour", "name color", "profile colour"],
        anchor: "appearance-namecolours",
    },
    {
        tab: "appearance",
        label: t("settingsSearch.textSize"),
        keywords: ["font size", "zoom", "bigger text", "message size"],
    },
    {
        tab: "appearance",
        label: t("settingsSearch.font"),
        keywords: ["typeface", "font family"],
    },
    {
        tab: "appearance",
        label: t("settingsSearch.themePresets"),
        keywords: ["dark mode", "light mode", "amoled", "colors", "preset"],
    },
    {
        tab: "appearance",
        label: t("settingsSearch.importExportTheme"),
        keywords: ["theme code", "share theme", "copy theme", "paste"],
    },
    // appearance (timestamps)
    {
        tab: "appearance",
        label: t("settingsSearch.timeFormat"),
        keywords: ["clock", "12 hour", "24 hour", "timestamp"],
        anchor: "cust-timestamps",
    },
    {
        tab: "appearance",
        label: t("settingsSearch.dateFormat"),
        keywords: ["date", "calendar"],
        anchor: "cust-timestamps",
    },
    {
        tab: "appearance",
        label: "Always show absolute dates",
        keywords: ["relative", "today", "yesterday"],
        anchor: "cust-timestamps",
    },
    // messages-media (messages)
    {
        tab: "messages-media",
        label: t("settingsSearch.showMatrixIds"),
        keywords: ["mxid", "username", "server name"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: t("settingsSearch.readReceiptAvatars"),
        keywords: ["seen by", "read receipts"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: t("settingsSearch.linkPreviews"),
        keywords: ["preview", "embed", "unfurl", "url"],
        anchor: "cust-messages",
    },
    {
        tab: "privacy",
        label: t("settingsSearch.linkPreviewMedia"),
        keywords: ["preview", "media", "ip", "tracking", "proxied", "embed"],
        anchor: "notif-privacy",
    },
    {
        tab: "messages-media",
        label: t("settingsSearch.pauseVideosOffScreen"),
        keywords: ["autoplay", "battery", "video"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: t("settingsSearch.holdToOpenMessageMenu"),
        keywords: ["touch", "long press", "tap"],
        anchor: "cust-messages",
    },
    // messages-media (gifs)
    {
        tab: "messages-media",
        label: t("settingsSearch.gifDefaultTab"),
        keywords: ["gif", "picker", "tenor", "klipy"],
        anchor: "cust-gifs",
    },
    // general (behavior)
    {
        tab: "general",
        label: t("settingsSearch.minimiseToTrayOnClose"),
        keywords: ["system tray", "background", "desktop"],
        anchor: "cust-behavior",
    },
    // appearance (language)
    {
        tab: "appearance",
        label: t("settingsSearch.language"),
        keywords: [
            "language",
            "translation",
            "locale",
            "english",
            "assyrian",
            "aramaic",
            "suret",
            "sureth",
            "ܣܘܪܝܬ",
            "ܠܫܢܐ",
        ],
        anchor: "appearance-language",
    },
    // appearance (reduce motion)
    {
        tab: "appearance",
        label: t("settingsSearch.reduceMotion"),
        keywords: ["animations", "accessibility", "battery"],
        anchor: "appearance-reducemotion",
    },
    // appearance (sidebar)
    {
        tab: "appearance",
        label: t("settingsSearch.keepRoomListOpen"),
        keywords: ["sidebar", "drawer"],
        anchor: "appearance-keepsidebar",
    },
    // emotes
    {
        tab: "emotes",
        label: t("settingsSearch.customEmotes"),
        keywords: ["emoji", "sticker", "emoticon", "upload"],
    },
    // notifications
    {
        tab: "notifications",
        label: t("settingsSearch.pushNotificationsPermission"),
        keywords: ["enable notifications", "allow", "system"],
        anchor: "notif-system",
    },
    {
        tab: "notifications",
        label: t("settingsSearch.notificationSound"),
        keywords: ["sound", "audio", "mute"],
        anchor: "notif-sound",
    },
    {
        tab: "notifications",
        label: t("settingsSearch.desktopAlertsPopUpAndTaskbar"),
        keywords: [
            "popup",
            "taskbar",
            "flash",
            "desktop notification",
            "toast",
        ],
        anchor: "notif-desktop",
    },
    {
        tab: "notifications",
        label: t("settingsSearch.quietOnMyOtherDevices"),
        keywords: ["active session", "grace", "suppress", "multi-device"],
        anchor: "notif-devices",
    },
    // privacy (notification privacy)
    {
        tab: "privacy",
        label: t("settingsSearch.privateReadReceipts"),
        keywords: ["hide read status", "privacy"],
        anchor: "notif-privacy",
    },
    {
        tab: "privacy",
        label: t("privacySafetySettings.sendTypingIndicators"),
        keywords: ["typing", "is typing", "indicator", "privacy"],
        anchor: "notif-privacy",
    },
    {
        tab: "privacy",
        label: t("settingsSearch.hideMessageTextInNotifications"),
        keywords: ["notification content", "preview", "privacy"],
        anchor: "notif-privacy",
    },
    {
        tab: "notifications",
        label: t("settingsSearch.notificationRules"),
        keywords: ["mentions", "dms", "invites", "loud", "silent"],
        anchor: "notif-rules",
    },
    {
        tab: "notifications",
        label: t("settingsSearch.keywordHighlights"),
        keywords: ["highlight", "alerts", "keywords", "patterns"],
        anchor: "notif-keywords",
    },
    // voice
    {
        tab: "voice",
        label: t("settingsSearch.inputDevice"),
        keywords: ["microphone", "mic"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.outputDevice"),
        keywords: ["speaker", "audio output"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.camera"),
        keywords: ["webcam", "video"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.noiseSuppression"),
        keywords: ["denoise", "filter"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.echoCancellation"),
        keywords: ["echo", "feedback"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.autoGainControl"),
        keywords: ["agc", "volume normalization"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.mirrorMyCamera"),
        keywords: ["flip", "mirror video"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.callVolume"),
        keywords: ["volume", "loudness"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.playCallSounds"),
        keywords: ["ringtone", "sound effects", "blips"],
    },
    {
        tab: "voice",
        label: t("settingsSearch.ringForIncomingDmCalls"),
        keywords: ["ringtone", "incoming call"],
    },
    // privacy (blocked users)
    {
        tab: "privacy",
        label: t("settingsSearch.blockedUsers"),
        keywords: ["ignore", "unblock", "block a user"],
    },
    // server
    {
        tab: "server",
        label: t("settingsSearch.serverCapabilities"),
        keywords: ["homeserver", "features", "support"],
    },
    // plugins
    {
        tab: "plugins",
        label: t("settingsSearch.plugins"),
        keywords: ["extensions", "add-ons", "install plugin"],
    },
    {
        tab: "plugins",
        label: t("settingsSearch.pluginRepositories"),
        keywords: ["repo", "third-party", "add repo"],
    },
    {
        tab: "plugins",
        label: t("settingsSearch.syncPlugins"),
        keywords: ["sync settings", "push", "pull"],
    },
    // about
    {
        tab: "about",
        label: t("settingsSearch.checkForUpdates"),
        keywords: ["update", "version", "upgrade"],
    },
    {
        tab: "about",
        label: t("settingsSearch.clearCache"),
        keywords: ["resync", "fix rooms", "reload", "troubleshoot"],
    },
    // debug
    {
        tab: "debug",
        label: t("settingsSearch.showAllEvents"),
        keywords: ["timeline events", "raw events", "developer"],
    },
    {
        tab: "debug",
        label: t("settingsSearch.pushDiagnostics"),
        keywords: ["push status", "fcm", "gateway", "troubleshoot"],
        anchor: "debug-push",
    },
];

function scoreEntry(entry: SettingsSearchEntry, q: string): number | null {
    const label = entry.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    if (entry.tab.toLowerCase().includes(q)) return 2;
    if (entry.keywords?.some((k) => k.toLowerCase().includes(q))) return 2;
    return null;
}

/**
 * Rank the index against a query. Empty/whitespace → []. Stable within a score
 * band (declaration order breaks ties). Capped at 20.
 */
export function searchSettings(
    query: string,
    index: readonly SettingsSearchEntry[] = SETTINGS_SEARCH_INDEX,
): SettingsSearchEntry[] {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    const scored: { entry: SettingsSearchEntry; score: number; i: number }[] =
        [];
    index.forEach((entry, i) => {
        const score = scoreEntry(entry, q);
        if (score !== null) scored.push({ entry, score, i });
    });
    scored.sort((a, b) => a.score - b.score || a.i - b.i);
    return scored.slice(0, 20).map((s) => s.entry);
}

export type SettingsSearchKeyAction = "clear" | "open-first";

/**
 * What a keypress in the settings search box should do. Escape clears a
 * non-empty query (a second Escape then closes the dialog as usual); Enter
 * opens the top result. Keys pressed mid-IME-composition belong to the IME.
 */
export function settingsSearchKeyAction(
    e: { key: string; isComposing?: boolean; keyCode?: number },
    query: string,
    resultCount: number,
): SettingsSearchKeyAction | null {
    // Safari reports the composition-committing Enter with isComposing false
    // but keyCode 229 (same guard as MessageInput).
    if (e.isComposing || e.keyCode === 229) return null;
    const hasQuery = query.trim() !== "";
    if (e.key === "Escape" && hasQuery) return "clear";
    if (e.key === "Enter" && hasQuery && resultCount > 0) return "open-first";
    return null;
}
