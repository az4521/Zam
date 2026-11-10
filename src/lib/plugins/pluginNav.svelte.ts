/**
 * The room the user is looking at, for plugins: `zam.navigation` and the
 * "room-enter" event. A room counts only while its timeline is the main view
 * (not the inbox, space home or a DM draft over it).
 */
import { untrack } from "svelte";
import { roomsState } from "$lib/stores/rooms.svelte";

export function viewedRoomId(): string | null {
    if (roomsState.showInbox || roomsState.showSpaceHome || roomsState.draftDm)
        return null;
    return roomsState.activeRoomId;
}

/** Call `cb` whenever the viewed room changes. Returns the unsubscribe. */
export function watchActiveRoom(
    cb: (roomId: string | null, previousRoomId: string | null) => void,
): () => void {
    let previous = viewedRoomId();
    return $effect.root(() => {
        $effect(() => {
            const now = viewedRoomId();
            untrack(() => {
                if (now === previous) return;
                const before = previous;
                previous = now;
                cb(now, before);
            });
        });
    });
}
