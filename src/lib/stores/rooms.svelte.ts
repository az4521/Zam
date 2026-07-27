import type { Room } from "matrix-js-sdk";
import { findSpaceForRoom, getRoom, isVideoRoom } from "$lib/matrix/client";
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
    // Booting and switching account are location changes like any other: a
    // restored video room belongs on its call surface, and a call view left
    // open by the previous account must not outlive that account's rooms.
    applyDefaultSurface(roomsState.activeRoomId);
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
    /** Levels below the joined ancestor (1 = direct child, 2 = nested, …). */
    spaceDrillDepth: 0,
    hierarchyLoading: false,
    isLoading: false,
    unreadTick: 0,
    roomsTick: 0,
    spaceLayout: { order: [], folders: {} } as SpaceLayout,
});

export function bumpUnreadTick(): void {
    roomsState.unreadTick++;
}

/**
 * A surface choice we could not make yet because the room was not loaded.
 * Deliberately a plain `let`, not part of `roomsState`: reading it must never
 * make a tracked scope depend on it, or settling a boot choice would ripple
 * through the whole app's reactivity for something no UI renders.
 */
let pendingSurfaceRoomId: string | null = null;

/**
 * Pick the surface a room opens on. A video room's purpose IS the call, so it
 * lands on the call view — peeking, never auto-joining (`showCallView`'s own
 * contract) — while everything else lands on its timeline. Every navigation
 * entry point routes through here so a video room behaves the same however you
 * reach it: sidebar click, space switch, inbox jump, boot restore, or account
 * switch.
 *
 * Boot restore does NOT resolve here, and cannot: the app shell mounts as soon
 * as the session is authenticated, and at that moment the SDK has no `Room`
 * objects at all — the persisted sync is only turned into rooms once
 * `startClient` runs its first sync pass. So an unknown room id is *remembered*
 * rather than decided, the timeline stands in meanwhile (the pre-existing
 * behaviour, never worse), and `resolvePendingSurface` settles it as soon as
 * the room actually exists.
 */
function applyDefaultSurface(roomId: string | null): void {
    const room = roomId ? getRoom(roomId) : null;
    if (roomId && !room) {
        pendingSurfaceRoomId = roomId;
        interfaceState.callViewRoomId = null;
        return;
    }
    pendingSurfaceRoomId = null;
    interfaceState.callViewRoomId =
        room && isVideoRoom(room) ? room.roomId : null;
}

/**
 * Settle a surface choice that boot could not make. Cheap enough to call on
 * every room-list rebuild, and guarded so it can only ever help: it does
 * nothing unless the user is still sitting on the very room whose surface was
 * deferred, so someone who flipped to the timeline or navigated away is never
 * yanked into a call view after the fact. Resolving once clears the deferral;
 * a room that still is not loaded stays pending for the next rebuild.
 */
export function resolvePendingSurface(): void {
    if (pendingSurfaceRoomId === null) return;
    if (pendingSurfaceRoomId !== roomsState.activeRoomId) {
        pendingSurfaceRoomId = null;
        return;
    }
    if (!getRoom(pendingSurfaceRoomId)) return;
    applyDefaultSurface(pendingSurfaceRoomId);
}

export function setActiveSpace(
    spaceId: string | null,
    drill?: { parentId: string; name?: string; depth?: number },
): void {
    if (spaceId === roomsState.activeSpaceId) return;
    roomsState.activeSpaceId = spaceId;
    roomsState.activeRoomId = getLastRoom(spaceId);
    // Restoring a space's last room is a navigation too: if that room is a
    // video room it must land on the call surface, not a stale timeline.
    applyDefaultSurface(roomsState.activeRoomId);
    roomsState.spaceHierarchy = [];
    roomsState.spaceDrillParentId = drill?.parentId ?? null;
    roomsState.spaceDrillName = drill?.name ?? null;
    roomsState.spaceDrillDepth = drill ? (drill.depth ?? 1) : 0;
    // When drilling into a sub-space, persist the ancestor: booting into a
    // possibly-unjoined sub-space would strand the user in an empty view
    // (no parent context for the hierarchy fallback).
    saveLastSpace(drill ? drill.parentId : spaceId);
    // Switching space/Home only swaps the room list — keep the mobile drawer
    // open for browsing when pinned in Settings > Customization.
    if (interfaceState.isMobile && !settingsState.keepSidebarOpen)
        interfaceState.leftOpen = false;
}

export function setActiveRoom(roomId: string): void {
    roomsState.activeRoomId = roomId;
    roomsState.showInbox = false;
    // Ordinary rooms show their timeline; video rooms show their call. The
    // three call-view entry points re-set this immediately after their own
    // setActiveRoom/navigateToRoom call, which still works either way.
    applyDefaultSurface(roomId);
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
        roomsState.spaceDrillDepth = 0;
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
