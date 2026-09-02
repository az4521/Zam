// Pure navigation model for the app-settings dialog.
//
// Settings are organized into three groups (Account / App / Advanced), each
// containing related tabs. Desktop renders a persistent grouped sidebar beside
// the active panel. Mobile (< 768px) instead drills down: a root list of grouped
// categories that pushes a full-screen sub-page. `settingsNavView` is the single
// place that decides which of those three surfaces is showing, so the component
// stays declarative and the behaviour is unit-testable. No Svelte, no SDK imports.

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
        title: "Account",
        tabs: [
            { id: "account", label: "Account" },
            { id: "security", label: "Security & Sessions" },
            { id: "privacy", label: "Privacy & Safety" },
        ],
    },
    {
        title: "App",
        tabs: [
            { id: "appearance", label: "Appearance" },
            { id: "messages-media", label: "Messages & Media" },
            { id: "notifications", label: "Notifications" },
            { id: "voice", label: "Voice & Video" },
            { id: "emotes", label: "Emotes" },
        ],
    },
    {
        title: "Advanced",
        tabs: [
            { id: "general", label: "General" },
            { id: "plugins", label: "Plugins" },
            { id: "server", label: "Server" },
            { id: "about", label: "About" },
            { id: "debug", label: "Debug" },
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
