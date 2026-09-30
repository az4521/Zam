// Pure navigation model for the app-settings dialog.
//
// Settings are organized into three groups (Account / App / Advanced), each
// containing related tabs. Desktop renders a persistent grouped sidebar beside
// the active panel. Mobile (< 768px) instead drills down: a root list of grouped
// categories that pushes a full-screen sub-page. `settingsNavView` is the single
// place that decides which of those three surfaces is showing, so the component
// stays declarative and the behaviour is unit-testable. No Svelte, no SDK imports.
import { t } from "$lib/i18n";

export type SettingsTab =
    | "account"
    | "security"
    | "privacy"
    | "appearance"
    | "messages-media"
    | "notifications"
    | "voice"
    | "emotes"
    | "general"
    | "plugins"
    | "server"
    | "about"
    | "debug";

export interface SettingsTabEntry {
    id: SettingsTab;
    label: string;
}

/**
 * The settings groups and their tabs, in display order. This is the source of truth
 * for the grouped navigation structure (Account / App / Advanced).
 */
export const SETTINGS_GROUPS: readonly {
    title: string;
    tabs: readonly SettingsTabEntry[];
}[] = [
    {
        title: t("settingsNav.account"),
        tabs: [
            { id: "account", label: t("settingsNav.account") },
            { id: "security", label: t("settingsNav.securitySessions") },
            { id: "privacy", label: t("settingsNav.privacySafety") },
        ],
    },
    {
        title: t("settingsNav.app"),
        tabs: [
            { id: "appearance", label: t("settingsNav.appearance") },
            { id: "messages-media", label: t("settingsNav.messagesMedia") },
            { id: "notifications", label: t("common.notifications") },
            { id: "voice", label: t("settingsNav.voiceVideo") },
            { id: "emotes", label: t("settingsNav.emotes") },
        ],
    },
    {
        title: t("settingsNav.advanced"),
        tabs: [
            { id: "general", label: t("settingsNav.general") },
            { id: "plugins", label: t("settingsNav.plugins") },
            { id: "server", label: t("settingsNav.server") },
            { id: "about", label: t("settingsNav.about") },
            { id: "debug", label: t("settingsNav.debug") },
        ],
    },
];

/** The settings categories, in display order (derived from groups). */
export const SETTINGS_TABS: readonly SettingsTabEntry[] =
    SETTINGS_GROUPS.flatMap((g) => g.tabs);

/** Tab the desktop layout falls back to before the user picks one. */
export const DEFAULT_SETTINGS_TAB: SettingsTab = "account";

/** Human label for a tab id; falls back to the id so a new tab can never
 *  render as an empty header. */
export function settingsTabLabel(id: SettingsTab): string {
    return SETTINGS_TABS.find((t) => t.id === id)?.label ?? id;
}

export type SettingsNavView =
    /** Desktop: sidebar + panel side by side. */
    | { mode: "desktop"; tab: SettingsTab }
    /** Mobile root: the vertical category list. */
    | { mode: "list" }
    /** Mobile sub-page: one category full-screen, with a back arrow. */
    | { mode: "detail"; tab: SettingsTab };

/**
 * Decide which settings surface to render.
 *
 * `selectedTab === null` means "the user has not drilled in yet" — on desktop
 * that is simply the default tab (the sidebar is always visible), on mobile it
 * is the root list. WHICH TAB is selected survives a viewport change in both
 * directions, so rotating a phone or resizing a window keeps the same category
 * open. The panel itself does NOT survive: crossing 768px swaps `{#if}`
 * branches in AppSettings, remounting the panel subtree, so panel-local
 * unsaved state is lost.
 */
export function settingsNavView(args: {
    isMobile: boolean;
    selectedTab: SettingsTab | null;
}): SettingsNavView {
    const { isMobile, selectedTab } = args;
    if (!isMobile) {
        return { mode: "desktop", tab: selectedTab ?? DEFAULT_SETTINGS_TAB };
    }
    if (selectedTab === null) return { mode: "list" };
    return { mode: "detail", tab: selectedTab };
}

/** Platform facts that decide which tabs have any content. */
export interface SettingsPlatform {
    /** Packaged Electron with the tray bridge (`isDesktopTray()`). */
    desktopTray: boolean;
}

/**
 * Whether a tab has content on this platform. General only holds the
 * desktop tray toggle, so web and Android hide it (and its search entries)
 * instead of showing an empty panel.
 */
export function isSettingsTabAvailable(
    tab: SettingsTab,
    platform: SettingsPlatform,
): boolean {
    return tab !== "general" || platform.desktopTray;
}

/** SETTINGS_GROUPS minus tabs this platform can't show; empty groups dropped. */
export function visibleSettingsGroups(
    platform: SettingsPlatform,
): typeof SETTINGS_GROUPS {
    if (platform.desktopTray) return SETTINGS_GROUPS;
    return SETTINGS_GROUPS.map((g) => ({
        title: g.title,
        tabs: g.tabs.filter((t) => isSettingsTabAvailable(t.id, platform)),
    })).filter((g) => g.tabs.length > 0);
}
