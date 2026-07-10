import type { Room } from "matrix-js-sdk";
import { findSpaceForRoom } from "$lib/matrix/client";
import type { SpaceChildInfo, SpaceLayout } from "$lib/matrix/client";

const STORAGE_KEY = "matrix_last_room_by_space";
const SPACE_KEY = "matrix_last_space";
const HOME_KEY = "__home__";

function loadLastRooms(): Record<string, string> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function saveLastRoom(spaceId: string | null, roomId: string): void {
    const map = loadLastRooms();
    map[spaceId ?? HOME_KEY] = roomId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function getLastRoom(spaceId: string | null): string | null {
    return loadLastRooms()[spaceId ?? HOME_KEY] ?? null;
}

function loadLastSpace(): string | null {
    return localStorage.getItem(SPACE_KEY);
}

function saveLastSpace(spaceId: string | null): void {
    if (spaceId === null) {
        localStorage.removeItem(SPACE_KEY);
    } else {
        localStorage.setItem(SPACE_KEY, spaceId);
    }
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
    hierarchyLoading: false,
    isLoading: false,
    unreadTick: 0,
    roomsTick: 0,
    spaceLayout: { order: [], folders: {} } as SpaceLayout,
});

export function bumpUnreadTick(): void {
    roomsState.unreadTick++;
}

export function setActiveSpace(spaceId: string | null): void {
    if (spaceId === roomsState.activeSpaceId) return;
    roomsState.activeSpaceId = spaceId;
    roomsState.activeRoomId = getLastRoom(spaceId);
    roomsState.spaceHierarchy = [];
    saveLastSpace(spaceId);
}

export function setActiveRoom(roomId: string): void {
    roomsState.activeRoomId = roomId;
    roomsState.showInbox = false;
    saveLastRoom(roomsState.activeSpaceId, roomId);
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
