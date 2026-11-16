// ZDMB's Discord channel tags (utils/bridgedChannels.ts), indexed once per
// roomsTick: what kind of channel a room is, and its name without the
// bridge's prefix, for joined rooms and for space children not yet joined.

import { readBridgedChannelIndex } from "$lib/matrix/client";
import type { BridgedChannel } from "$lib/utils/bridgedChannels";
import { auth } from "$lib/stores/auth.svelte";
import { roomsState } from "$lib/stores/rooms.svelte";

let cache: {
    tick: number;
    userId: string | null;
    index: Map<string, BridgedChannel>;
} | null = null;

function index(): Map<string, BridgedChannel> {
    const tick = roomsState.roomsTick;
    const userId = auth.userId ?? null;
    if (cache && cache.tick === tick && cache.userId === userId)
        return cache.index;
    const next = readBridgedChannelIndex();
    cache = { tick, userId, index: next };
    return next;
}

/** The room's channel tag, or null for a room the bridge did not tag. Reads
 *  roomsTick, so a `$derived` calling it follows state changes. */
export function bridgedChannel(roomId: string): BridgedChannel | null {
    return index().get(roomId) ?? null;
}

/** The bridge's clean name for a room, or null when it gave none. */
export function bridgedChannelName(roomId: string): string | null {
    return bridgedChannel(roomId)?.name || null;
}
