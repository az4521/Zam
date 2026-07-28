// Pure navigation model for the room/space settings dialog.
//
// Desktop renders a persistent category sidebar beside the active panel.
// Mobile (< 768px) instead drills down: a root list of categories that pushes
// a full-screen sub-page. Mirrors `settingsNav.ts` (the app-settings dialog),
// with the two things room settings needs and app settings does not: the
// visible tab set depends on whether the room is a space, and a selection that
// is invalid for the current room falls back instead of rendering nothing.
// No Svelte, no SDK imports.

export type RoomSettingsTab =
    | "general"
    | "access"
    | "security"
    | "permissions"
    | "members"
    | "emotes"
    | "rooms";

export interface RoomSettingsTabEntry {
    id: RoomSettingsTab;
    label: string;
}

/** Tab the desktop layout falls back to before the user picks one. */
export const DEFAULT_ROOM_SETTINGS_TAB: RoomSettingsTab = "general";

const LABELS: Record<RoomSettingsTab, string> = {
    general: "General",
    access: "Access",
    security: "Security",
    permissions: "Permissions",
    members: "Members",
    emotes: "Emotes",
    rooms: "Rooms",
};

/**
 * The categories this room offers, in display order.
 *
 * Encryption is a room concept, not a space one, so spaces hide Security;
 * only spaces have child rooms, so ordinary rooms hide Rooms.
 */
export function roomSettingsTabs(args: {
    isSpace: boolean;
}): readonly RoomSettingsTabEntry[] {
    const { isSpace } = args;
    const ids: RoomSettingsTab[] = [
        "general",
        "access",
        ...(isSpace ? [] : (["security"] as RoomSettingsTab[])),
        "permissions",
        "members",
        "emotes",
        ...(isSpace ? (["rooms"] as RoomSettingsTab[]) : []),
    ];
    return ids.map((id) => ({ id, label: LABELS[id] }));
}

/** Human label for a tab id; falls back to the id so a new tab can never
 *  render as an empty header. */
export function roomSettingsTabLabel(id: RoomSettingsTab): string {
    return LABELS[id] ?? id;
}

export type RoomSettingsNavView =
    /** Desktop: sidebar + panel side by side. */
    | { mode: "desktop"; tab: RoomSettingsTab }
    /** Mobile root: the vertical category list. */
    | { mode: "list" }
    /** Mobile sub-page: one category full-screen, with a back arrow. */
    | { mode: "detail"; tab: RoomSettingsTab };

/**
 * Decide which settings surface to render.
 *
 * `selectedTab === null` means "the user has not drilled in yet" — on desktop
 * that is simply the default tab (the sidebar is always visible), on mobile it
 * is the root list. WHICH TAB is selected survives a viewport change in both
 * directions, so rotating a phone or resizing a window keeps the same category
 * open.
 *
 * A selection the current room cannot show is treated as no selection at all.
 * The `room` prop can swap under a mounted dialog (AppShell renders one
 * `<RoomSettings>` inside a single `{#if}`, and RoomList closes and reopens it
 * in the same tick), so a space's "Rooms" selection can outlive the space.
 */
export function roomSettingsNavView(args: {
    isMobile: boolean;
    isSpace: boolean;
    selectedTab: RoomSettingsTab | null;
}): RoomSettingsNavView {
    const { isMobile, isSpace, selectedTab } = args;
    const visible = roomSettingsTabs({ isSpace }).some(
        (t) => t.id === selectedTab,
    );
    const tab = visible ? (selectedTab as RoomSettingsTab) : null;
    if (!isMobile) {
        return { mode: "desktop", tab: tab ?? DEFAULT_ROOM_SETTINGS_TAB };
    }
    if (tab === null) return { mode: "list" };
    return { mode: "detail", tab };
}
