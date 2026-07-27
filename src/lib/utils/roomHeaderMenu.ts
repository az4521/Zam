// Pure model for the mobile room-header overflow menu.
//
// At 412px the room header cannot fit eight buttons and still leave the room
// name and topic any width, so on mobile four of them (threads, pinned,
// notifications, member list) move into a "⋯" bottom sheet. Which rows exist,
// what they say and how they badge lives here so it can be tested without a
// DOM; MessageArea only supplies the numbers and renders the result.

/** The panels that move off the header and into the overflow menu. */
export type RoomHeaderMenuKey =
    | "threads"
    | "pinned"
    | "notifications"
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
            key: "members",
            label: "Member list",
            active: active("members"),
            badge: null,
            dot: false,
        },
    ];
}
