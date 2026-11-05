// Trims the history held for rooms the user isn't looking at (see
// utils/historyTrim and client.ts trimRoomHistory), one room at a time every
// HISTORY_TRIM_INTERVAL_MS. A trimmed room opens on its newest messages as
// usual; scrolling up fetches the rest again.

import { HISTORY_TRIM_INTERVAL_MS, mayTrimRoom } from "$lib/utils/historyTrim";
import {
    getRoom,
    getRooms,
    getTimelineMessages,
    trimRoomHistory,
} from "$lib/matrix/client";
import { roomsState } from "$lib/stores/rooms.svelte";
import { setMessages, setCanLoadMore } from "$lib/stores/messages.svelte";

let openRoomId: string | null = null;
/** When each room stopped being the open one. */
const leftAt = new Map<string, number>();

/** Called whenever the open room changes. */
export function noteOpenRoom(roomId: string | null): void {
    if (roomId === openRoomId) return;
    if (openRoomId) leftAt.set(openRoomId, Date.now());
    openRoomId = roomId;
}

function trimmable(roomId: string): boolean {
    return mayTrimRoom(
        roomId,
        roomsState.activeRoomId,
        leftAt.get(roomId),
        Date.now(),
    );
}

async function sweep(): Promise<void> {
    for (const room of getRooms()) {
        const id = room.roomId;
        if (!trimmable(id)) continue;
        try {
            if (!(await trimRoomHistory(id, () => trimmable(id)))) continue;
        } catch (err) {
            console.warn("Trimming room history failed:", id, err);
            continue;
        }
        // The cached list for the room would otherwise keep every dropped
        // event alive, and show them when the room is opened.
        const trimmed = getRoom(id);
        if (trimmed) {
            setMessages(id, getTimelineMessages(trimmed));
            setCanLoadMore(id, true);
        }
    }
}

/** Start trimming. Returns the teardown. */
export function initHistoryTrim(): () => void {
    let running = false;
    const timer = setInterval(() => {
        if (running) return;
        running = true;
        sweep().finally(() => (running = false));
    }, HISTORY_TRIM_INTERVAL_MS);
    return () => {
        clearInterval(timer);
        leftAt.clear();
    };
}
