// Pure navigation model for the app-settings dialog.
//
// Desktop renders a persistent category sidebar beside the active panel.
// Mobile (< 768px) instead drills down: a root list of categories that pushes
// a full-screen sub-page. `settingsNavView` is the single place that decides
// which of those three surfaces is showing, so the component stays declarative
// and the behaviour is unit-testable. No Svelte, no SDK imports.

export type SettingsTab =
    | "account"
    | "sessions"
    | "security"
    | "theme"
    | "customization"
    | "emotes"
    | "notifications"
    | "voice"
    | "blocked"
    | "server"
    | "about"
    | "debug";

export interface SettingsTabEntry {
    id: SettingsTab;
    label: string;
}

/** The settings categories, in display order (shared by both layouts). */
export const SETTINGS_TABS: readonly SettingsTabEntry[] = [
    { id: "account", label: "Account" },
    { id: "sessions", label: "Sessions" },
    { id: "security", label: "Security" },
    { id: "theme", label: "Theme" },
    { id: "customization", label: "Customization" },
    { id: "emotes", label: "My Emotes" },
    { id: "notifications", label: "Notifications" },
    { id: "voice", label: "Voice & Audio" },
    { id: "blocked", label: "Blocked Users" },
    { id: "server", label: "Server" },
    { id: "about", label: "About" },
    { id: "debug", label: "Debug Info" },
];

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
