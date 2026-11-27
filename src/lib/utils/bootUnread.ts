/**
 * Unread state held over from the previous run while sync catches up.
 *
 * At boot the sidebar is painted from the saved room list, and rooms then
 * arrive from sync one response at a time. The unread check needs our read
 * receipt, which a cached room does not have and a freshly synced room may
 * not have yet, so computing it then calls every room with a message from
 * someone else "unread" until the receipt lands. Instead each room keeps the
 * verdict it had when the app last ran, until sync has delivered that room
 * (or the whole list), and a room a notification was tapped for is unread.
 */

export interface UnreadVerdict {
    unread: boolean;
    highlight: number;
}

export class BootUnread {
    private saved = new Map<string, UnreadVerdict>();
    private launched = new Set<string>();

    /** Replace the verdicts restored from the saved room list. */
    restore(entries: Iterable<[string, UnreadVerdict]>): void {
        this.saved = new Map(entries);
    }

    /** A notification for this room opened the app: it is unread. */
    markLaunched(roomId: string): void {
        this.launched.add(roomId);
    }

    /** The verdict to show for the room, or null to compute it from the room. */
    get(roomId: string): UnreadVerdict | null {
        const saved = this.saved.get(roomId);
        if (this.launched.has(roomId))
            return { unread: true, highlight: saved?.highlight ?? 0 };
        return saved ?? null;
    }

    /** Sync has delivered these rooms: their own state is authoritative now. */
    release(roomIds: Iterable<string>): boolean {
        let changed = false;
        for (const id of roomIds) {
            if (this.saved.delete(id)) changed = true;
            if (this.launched.delete(id)) changed = true;
        }
        return changed;
    }

    /** The whole room list is in: nothing is held over any more. */
    releaseAll(): boolean {
        const changed = this.saved.size > 0 || this.launched.size > 0;
        this.saved.clear();
        this.launched.clear();
        return changed;
    }

    /** Drop the saved verdicts only (a new cache load); launches stay. */
    clearSaved(): void {
        this.saved.clear();
    }
}
