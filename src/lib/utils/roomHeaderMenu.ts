// Pure model for the mobile room-header overflow menu.
//
// At 412px the room header cannot fit eight buttons and still leave the room
// name and topic any width, so on mobile five of them (threads, pinned,
// notifications, media, member list) move into a "⋯" bottom sheet. Which rows
// exist, what they say and how they badge lives here so it can be tested
// without a DOM; MessageArea only supplies the numbers and renders the result.

import type { RegistryEntry } from "$lib/plugins/registry";
import type { HeaderButton } from "$lib/plugins/types";

/** The panels that move off the header and into the overflow menu. */
export type RoomHeaderMenuKey =
    | "threads"
    | "pinned"
    | "notifications"
    | "media"
    | "members";

export interface RoomHeaderMenuInput {
    /** `interfaceState.sidebar` — may name a panel that stays in the header. */
    activeSidebar: string | null;
    /** Unread thread mentions across the room (the loud count). */
    threadMentions: number;
    /** Any unread thread activity at all (the quiet signal). */
    threadAnyUnread: boolean;
    pinnedCount: number;
}

export interface RoomHeaderMenuRow {
    key: RoomHeaderMenuKey;
    label: string;
    /** The row's panel is open — render it in the accent colour. */
    active: boolean;
    /** Count pill text, or null when there is nothing to count. */
    badge: string | null;
    /** Quiet unread dot, shown only when there is no badge to show instead. */
    dot: boolean;
}

/** Count pill text, or null below 1. Mirrors the header badges' 99+ cap. */
function badgeFor(count: number): string | null {
    if (!Number.isFinite(count) || count < 1) return null;
    const n = Math.floor(count);
    return n > 99 ? "99+" : String(n);
}

/**
 * Build the overflow menu's rows. The order is fixed and matches the order the
 * buttons appear in on the desktop header, so the two layouts stay learnable.
 */
export function roomHeaderMenuRows(
    input: RoomHeaderMenuInput,
): RoomHeaderMenuRow[] {
    const mentions = badgeFor(input.threadMentions);
    const active = (key: RoomHeaderMenuKey) => input.activeSidebar === key;
    return [
        {
            key: "threads",
            label: "Threads",
            active: active("threads"),
            badge: mentions,
            // A mention count already says "unread" — don't say it twice.
            dot: mentions === null && input.threadAnyUnread,
        },
        {
            key: "pinned",
            label: "Pinned messages",
            active: active("pinned"),
            badge: badgeFor(input.pinnedCount),
            dot: false,
        },
        {
            key: "notifications",
            label: "Notifications inbox",
            active: active("notifications"),
            badge: null,
            dot: false,
        },
        {
            key: "media",
            label: "Media and files",
            active: active("media"),
            badge: null,
            dot: false,
        },
        {
            key: "members",
            label: "Member list",
            active: active("members"),
            badge: null,
            dot: false,
        },
    ];
}

/**
 * Plugin room-header button exports (zam.room.addHeaderButton, spec §6).
 * Pure adapters for the plugin header-button registry → UI views, tested
 * without a DOM. The overflow menu's plugin rows reuse the same structure.
 */

/**
 * Stable key for a plugin's header button, namespaced by plugin + button id.
 * Mirrors pluginComposer.pluginContribKey.
 */
export function pluginHeaderKey(pluginId: string, id: string): string {
    return `plugin:${pluginId}:${id}`;
}

/**
 * UI view of a plugin header button — the stable key + label + icon + render.
 * Matches PluginPanelState's render signature (HTMLElement + roomId context).
 */
export interface PluginHeaderButtonView {
    key: string;
    label: string;
    icon?: string;
    render(el: HTMLElement, ctx: { roomId: string }): void | (() => void);
}

/**
 * Map plugin header-button registry entries to UI views, deduplicating by key
 * (first registration wins). Preserves order — the desktop inline buttons and
 * mobile overflow rows render in registration order.
 */
export function pluginHeaderButtons(
    entries: RegistryEntry<HeaderButton>[],
): PluginHeaderButtonView[] {
    const seen = new Set<string>();
    const views: PluginHeaderButtonView[] = [];

    for (const entry of entries) {
        const key = pluginHeaderKey(entry.pluginId, entry.value.id);
        if (seen.has(key)) continue;
        seen.add(key);

        views.push({
            key,
            label: entry.value.label,
            icon: entry.value.icon,
            render: entry.value.render,
        });
    }

    return views;
}

/**
 * Row model for the mobile overflow menu's plugin section (matches the core
 * RoomHeaderMenuRow structure but without badge/dot — plugins use a fixed icon).
 */
export interface PluginHeaderMenuRow {
    key: string;
    label: string;
    active: boolean;
}

/**
 * Build overflow-menu rows for plugin header buttons, marking the active row
 * (the panel whose header button is currently open). Used by RoomHeaderOverflowMenu.
 */
export function pluginHeaderMenuRows(
    buttons: { key: string; label: string }[],
    activeKey: string | null,
): PluginHeaderMenuRow[] {
    return buttons.map((btn) => ({
        key: btn.key,
        label: btn.label,
        active: btn.key === activeKey,
    }));
}
