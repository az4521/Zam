import type { Room } from "matrix-js-sdk";
import { findSpaceForRoom } from "$lib/matrix/client";
import type { SpaceChildInfo, SpaceLayout } from "$lib/matrix/client";
import { interfaceState } from "./interface.svelte";
import { settingsState } from "./settings.svelte";
import { auth } from "./auth.svelte";
import {
    readScoped,
    writeScoped,
    removeScoped,
} from "$lib/utils/scopedStorage";

const STORAGE_KEY = "matrix_last_room_by_space";
const SPACE_KEY = "matrix_last_space";
const HOME_KEY = "__home__";

function loadLastRooms(): Record<string, string> {
    try {
        return JSON.parse(readScoped(STORAGE_KEY, auth.userId) ?? "{}");
    } catch {
        return {};
    }
}

function saveLastRoom(spaceId: string | null, roomId: string): void {
    const map = loadLastRooms();
    map[spaceId ?? HOME_KEY] = roomId;
    writeScoped(STORAGE_KEY, auth.userId, JSON.stringify(map));
}

function getLastRoom(spaceId: string | null): string | null {
    return loadLastRooms()[spaceId ?? HOME_KEY] ?? null;
}

function loadLastSpace(): string | null {
    return readScoped(SPACE_KEY, auth.userId);
}

function saveLastSpace(spaceId: string | null): void {
    if (spaceId === null) {
        removeScoped(SPACE_KEY, auth.userId);
    } else {
        writeScoped(SPACE_KEY, auth.userId, spaceId);
    }
}

/**
 * Re-read the active account's persisted last space and room. Module init
 * runs before the account is known, so the app shell calls this on boot.
 */
export function reloadLastLocationFromStorage(): void {
    roomsState.activeSpaceId = loadLastSpace();
    roomsState.activeRoomId = getLastRoom(roomsState.activeSpaceId);
}

export const roomsState = $state({
    spaces: [] as Room[],
    orphanRooms: [] as Room[],
    directRooms: [] as Room[],
    invitedRooms: [] as Room[],
    knockedRooms: [] as Room[],
    activeSpaceId: loadLastSpace() as string | null,
    activeRoomId: getLastRoom(loadLastSpace()) as string | null,
    showInbox: false,
    roomsInSpace: [] as Room[],
    spaceHierarchy: [] as SpaceChildInfo[],
    /**
     * Set while browsing a sub-space reached from inside another space: the
     * nearest *joined* ancestor (for the hierarchy-via-parent fallback and
     * the sidebar highlight) and the sub-space's display name (unjoined
     * sub-spaces have no local Room to read a name from).
     */
    spaceDrillParentId: null as string | null,
    spaceDrillName: null as string | null,
    hierarchyLoading: false,
    isLoading: false,
    unreadTick: 0,
    roomsTick: 0,
    spaceLayout: { order: [], folders: {} } as SpaceLayout,
});

export function bumpUnreadTick(): void {
    roomsState.unreadTick++;
}

export function setActiveSpace(
    spaceId: string | null,
    drill?: { parentId: string; name?: string },
): void {
    if (spaceId === roomsState.activeSpaceId) return;
    roomsState.activeSpaceId = spaceId;
    roomsState.activeRoomId = getLastRoom(spaceId);
    roomsState.spaceHierarchy = [];
    roomsState.spaceDrillParentId = drill?.parentId ?? null;
    roomsState.spaceDrillName = drill?.name ?? null;
    // When drilling into a sub-space, persist the ancestor: booting into a
    // possibly-unjoined sub-space would strand the user in an empty view
    // (no parent context for the hierarchy fallback).
    saveLastSpace(drill ? drill.parentId : spaceId);
    // Switching space/Home only swaps the room list — keep the mobile drawer
    // open for browsing when the user has pinned it in Settings > Behavior.
    if (interfaceState.isMobile && !settingsState.keepSidebarOpen)
        interfaceState.leftOpen = false;
}

export function setActiveRoom(roomId: string): void {
    roomsState.activeRoomId = roomId;
    roomsState.showInbox = false;
    saveLastRoom(roomsState.activeSpaceId, roomId);
    // Picking a room/DM is a destination: always dismiss the mobile drawer,
    // regardless of the keep-open setting.
    if (interfaceState.isMobile) interfaceState.leftOpen = false;
}

/**
 * Navigate to a room, also switching to the space that contains it (or Home if
 * it's a DM/orphan). Use this when jumping to a room that may not be in the
 * currently-selected space — e.g. from the notifications inbox.
 */
export function navigateToRoom(roomId: string): void {
    const targetSpace = findSpaceForRoom(roomId);
    if (targetSpace !== roomsState.activeSpaceId) {
        roomsState.activeSpaceId = targetSpace;
        roomsState.spaceHierarchy = [];
        roomsState.spaceDrillParentId = null;
        roomsState.spaceDrillName = null;
        saveLastSpace(targetSpace);
    }
    setActiveRoom(roomId);
}

export function getActiveRoom(): Room | undefined {
    const allRooms = [
        ...roomsState.roomsInSpace,
        ...roomsState.orphanRooms,
        ...roomsState.directRooms,
    ];
    return allRooms.find((r) => r.roomId === roomsState.activeRoomId);
}
