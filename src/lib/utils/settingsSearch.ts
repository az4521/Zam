// Pure, data-driven index of searchable settings, plus a ranker. No Svelte,
// no SDK imports — so it is unit-testable and the later settings overhaul can
// extend the index without touching the search algorithm.
//
// `anchor` is an OPTIONAL scroll target: the id in a panel's
// `data-setting-anchor="<id>"` attribute. When present AND rendered, AppSettings
// scrolls to it and flashes it after navigating; when absent (or the control is
// conditionally hidden) selecting the result simply lands on the tab.

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
        label: "Display name",
        keywords: ["name", "nickname", "username"],
    },
    {
        tab: "account",
        label: "Avatar",
        keywords: ["photo", "picture", "profile pic", "image"],
    },
    {
        tab: "account",
        label: "Presence",
        keywords: ["online", "away", "busy", "status", "availability"],
    },
    {
        tab: "account",
        label: "Change password",
        keywords: ["password", "credentials"],
    },
    { tab: "account", label: "Log out", keywords: ["sign out", "logout"] },
    {
        tab: "account",
        label: "Deactivate account",
        keywords: ["delete account", "close account", "remove account"],
    },
    // security (sessions subsection)
    {
        tab: "security",
        label: "Sessions",
        keywords: ["devices", "logins", "sign out other"],
    },
    {
        tab: "security",
        label: "Encrypt new direct messages",
        keywords: ["encryption", "e2e", "dm", "private"],
    },
    {
        tab: "security",
        label: "Only send to verified devices",
        keywords: ["verified", "trust", "cross-signing"],
    },
    // security
    {
        tab: "security",
        label: "Set up recovery",
        keywords: ["backup", "recovery key", "cross-signing", "4s"],
    },
    {
        tab: "security",
        label: "Restore message history",
        keywords: ["key backup", "unlock", "passphrase", "recovery"],
    },
    {
        tab: "security",
        label: "Verify this session",
        keywords: ["verification", "verify device"],
    },
    // appearance
    {
        tab: "appearance",
        label: "Right-align my messages",
        keywords: ["bubble", "layout", "alignment", "imessage"],
        anchor: "theme-rightalign",
    },
    {
        tab: "appearance",
        label: "Text size",
        keywords: ["font size", "zoom", "bigger text", "message size"],
    },
    { tab: "appearance", label: "Font", keywords: ["typeface", "font family"] },
    {
        tab: "appearance",
        label: "Theme presets",
        keywords: ["dark mode", "light mode", "amoled", "colors", "preset"],
    },
    {
        tab: "appearance",
        label: "Import / export theme",
        keywords: ["theme code", "share theme", "copy theme", "paste"],
    },
    // appearance (timestamps)
    {
        tab: "appearance",
        label: "Time format",
        keywords: ["clock", "12 hour", "24 hour", "timestamp"],
        anchor: "cust-timestamps",
    },
    {
        tab: "appearance",
        label: "Date format",
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
        label: "Show Matrix IDs",
        keywords: ["mxid", "username", "server name"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: "Read receipt avatars",
        keywords: ["seen by", "read receipts"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: "Link previews",
        keywords: ["preview", "embed", "unfurl", "url"],
        anchor: "cust-messages",
    },
    {
        tab: "messages-media",
        label: "Pause videos off-screen",
        keywords: ["autoplay", "battery", "video"],
        anchor: "cust-messages",
    },
    // messages-media (gifs)
    {
        tab: "messages-media",
        label: "GIF default tab",
        keywords: ["gif", "picker", "tenor", "klipy"],
        anchor: "cust-gifs",
    },
    // general (behavior)
    {
        tab: "general",
        label: "Keep room list open",
        keywords: ["sidebar", "drawer"],
        anchor: "cust-behavior",
    },
    {
        tab: "general",
        label: "Hold to open message menu",
        keywords: ["touch", "long press", "tap"],
        anchor: "cust-behavior",
    },
    {
        tab: "general",
        label: "Minimise to tray on close",
        keywords: ["system tray", "background", "desktop"],
        anchor: "cust-behavior",
    },
    // appearance (reduce motion)
    {
        tab: "appearance",
        label: "Reduce motion",
        keywords: ["animations", "accessibility", "battery"],
        anchor: "appearance-reducemotion",
    },
    // emotes
    {
        tab: "emotes",
        label: "Custom emotes",
        keywords: ["emoji", "sticker", "emoticon", "upload"],
    },
    // notifications
    {
        tab: "notifications",
        label: "Push notifications permission",
        keywords: ["enable notifications", "allow", "system"],
        anchor: "notif-system",
    },
    {
        tab: "notifications",
        label: "Notification sound",
        keywords: ["sound", "audio", "mute"],
        anchor: "notif-sound",
    },
    {
        tab: "notifications",
        label: "Quiet on my other devices",
        keywords: ["active session", "grace", "suppress", "multi-device"],
        anchor: "notif-devices",
    },
    // privacy (notification privacy)
    {
        tab: "privacy",
        label: "Private read receipts",
        keywords: ["hide read status", "privacy"],
        anchor: "notif-privacy",
    },
    {
        tab: "privacy",
        label: "Hide message text in notifications",
        keywords: ["notification content", "preview", "privacy"],
        anchor: "notif-privacy",
    },
    {
        tab: "notifications",
        label: "Notification rules",
        keywords: ["mentions", "dms", "invites", "loud", "silent"],
        anchor: "notif-rules",
    },
    {
        tab: "notifications",
        label: "Keyword highlights",
        keywords: ["highlight", "alerts", "keywords", "patterns"],
        anchor: "notif-keywords",
    },
    // voice
    { tab: "voice", label: "Input device", keywords: ["microphone", "mic"] },
    {
        tab: "voice",
        label: "Output device",
        keywords: ["speaker", "audio output"],
    },
    { tab: "voice", label: "Camera", keywords: ["webcam", "video"] },
    {
        tab: "voice",
        label: "Noise suppression",
        keywords: ["denoise", "filter"],
    },
    {
        tab: "voice",
        label: "Echo cancellation",
        keywords: ["echo", "feedback"],
    },
    {
        tab: "voice",
        label: "Auto gain control",
        keywords: ["agc", "volume normalization"],
    },
    {
        tab: "voice",
        label: "Mirror my camera",
        keywords: ["flip", "mirror video"],
    },
    { tab: "voice", label: "Call volume", keywords: ["volume", "loudness"] },
    {
        tab: "voice",
        label: "Play call sounds",
        keywords: ["ringtone", "sound effects", "blips"],
    },
    {
        tab: "voice",
        label: "Ring for incoming DM calls",
        keywords: ["ringtone", "incoming call"],
    },
    // privacy (blocked users)
    {
        tab: "privacy",
        label: "Blocked users",
        keywords: ["ignore", "unblock", "block a user"],
    },
    // server
    {
        tab: "server",
        label: "Server capabilities",
        keywords: ["homeserver", "features", "support"],
    },
    // plugins
    {
        tab: "plugins",
        label: "Plugins",
        keywords: ["extensions", "add-ons", "install plugin"],
    },
    {
        tab: "plugins",
        label: "Plugin repositories",
        keywords: ["repo", "third-party", "add repo"],
    },
    {
        tab: "plugins",
        label: "Sync plugins",
        keywords: ["sync settings", "push", "pull"],
    },
    // about
    {
        tab: "about",
        label: "Check for updates",
        keywords: ["update", "version", "upgrade"],
    },
    {
        tab: "about",
        label: "Clear cache",
        keywords: ["resync", "fix rooms", "reload", "troubleshoot"],
    },
    // debug
    {
        tab: "debug",
        label: "Show all events",
        keywords: ["timeline events", "raw events", "developer"],
    },
    {
        tab: "debug",
        label: "Push diagnostics",
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
