// Rooms bridged from Discord threads by ZDMB, shown the way Discord shows
// threads: nested under their channel, as a chip on the message that started
// them, and in the channel's Threads panel. Format and pure rules live in
// utils/bridgedThreads.ts; this module caches the index per roomsTick.

import type { Room } from "matrix-js-sdk";
import { t } from "$lib/i18n";
import {
    findCachedHierarchyEntry,
    getRoom,
    getRoomDisplayName,
    joinRoom,
    readBridgedThreadIndex,
} from "$lib/matrix/client";
import {
    starterKey,
    stripThreadNamePrefix,
    type BridgedThreadIndex,
    type BridgedThreadParent,
} from "$lib/utils/bridgedThreads";
import { auth } from "$lib/stores/auth.svelte";
import { bridgedChannelName } from "$lib/stores/bridgedChannels.svelte";
import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";
import { showErrorToast } from "$lib/stores/toasts.svelte";

let cache: {
    tick: number;
    userId: string | null;
    index: BridgedThreadIndex;
} | null = null;

/**
 * The bridged-thread index. Reads roomsTick, so a `$derived` calling this
 * re-runs when room or space state changes; the walk itself runs once per tick.
 */
export function bridgedThreadIndex(): BridgedThreadIndex {
    const tick = roomsState.roomsTick;
    const userId = auth.userId ?? null;
    if (cache && cache.tick === tick && cache.userId === userId)
        return cache.index;
    const index = readBridgedThreadIndex();
    cache = { tick, userId, index };
    return index;
}

/** The parent of a bridged thread room, or null for any other room. */
export function bridgedThreadParent(
    roomId: string,
): BridgedThreadParent | null {
    return bridgedThreadIndex().parentOf.get(roomId) ?? null;
}

/** The parent's room id, for nesting rows (see nestThreadRows). Forum posts
 *  (whose parent is a space) have none: their forum renders as a category. */
export function bridgedThreadParentChannelId(roomId: string): string | null {
    const parent = bridgedThreadParent(roomId);
    if (!parent) return null;
    return getRoom(parent.roomId)?.isSpaceRoom() ? null : parent.roomId;
}

export interface BridgedThreadInfo {
    roomId: string;
    name: string;
    joined: boolean;
    room: Room | null;
    via: string[];
    numMembers: number | null;
    parent: BridgedThreadParent;
}

/** Everything a row or chip needs about one bridged thread room. */
export function bridgedThreadInfo(roomId: string): BridgedThreadInfo | null {
    const parent = bridgedThreadParent(roomId);
    if (!parent) return null;
    const room = getRoom(roomId);
    const joined = room?.getMyMembership() === "join";
    const listed = findCachedHierarchyEntry(roomId);
    const via = listed?.via.length ? listed.via : parent.via;
    return {
        roomId,
        name:
            room && joined
                ? getRoomDisplayName(room)
                : (bridgedChannelName(roomId) ??
                  (listed?.name ? stripThreadNamePrefix(listed.name) : roomId)),
        joined,
        room: joined ? room : null,
        via,
        numMembers: joined
            ? (room?.getJoinedMemberCount() ?? null)
            : (listed?.numMembers ?? null),
        parent,
    };
}

/** The thread started from `eventId` in `parentRoomId`, if any. */
export function bridgedThreadForEvent(
    parentRoomId: string,
    eventId: string,
): BridgedThreadInfo | null {
    const id = bridgedThreadIndex().byStarter.get(
        starterKey(parentRoomId, eventId),
    );
    return id ? bridgedThreadInfo(id) : null;
}

/** Every bridged thread of a channel, newest activity first for joined ones,
 *  then the unjoined ones in the bridge's order. */
export function bridgedThreadsOf(parentRoomId: string): BridgedThreadInfo[] {
    const ids = bridgedThreadIndex().threadsOf.get(parentRoomId) ?? [];
    const infos = ids
        .map((id) => bridgedThreadInfo(id))
        .filter((i): i is BridgedThreadInfo => i !== null);
    return infos
        .map((info, pos) => ({
            info,
            pos,
            ts: info.room ? info.room.getLastActiveTimestamp() : 0,
        }))
        .sort((a, b) => {
            if (a.info.joined !== b.info.joined) return a.info.joined ? -1 : 1;
            return b.ts - a.ts || a.pos - b.pos;
        })
        .map((x) => x.info);
}

const joining = new Set<string>();

/** Open a bridged thread, joining it first when needed. */
export async function openBridgedThread(roomId: string): Promise<void> {
    const info = bridgedThreadInfo(roomId);
    if (!info || info.joined) {
        navigateToRoom(roomId);
        return;
    }
    if (joining.has(roomId)) return;
    joining.add(roomId);
    try {
        await joinRoom(roomId, info.via);
        navigateToRoom(roomId);
    } catch (err) {
        console.error("Failed to join thread:", err);
        showErrorToast(t("bridgedThreads.joinFailed"));
    } finally {
        joining.delete(roomId);
    }
}
