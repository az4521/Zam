import { observeRoomRow } from "$lib/stores/roomPrefetch.svelte";

/**
 * Reports a room row's on-screen state to the room prefetch
 * (stores/roomPrefetch.svelte.ts). Use on each channel or DM row.
 */
export function roomPrefetchRow(node: HTMLElement, roomId: string) {
    let release = observeRoomRow(node, roomId);
    return {
        update(next: string) {
            release();
            release = observeRoomRow(node, next);
        },
        destroy() {
            release();
        },
    };
}
