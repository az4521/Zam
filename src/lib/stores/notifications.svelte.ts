import type { Room } from "matrix-js-sdk";
import { getRoom, getRoomsInSpace, getSpaceChildIds } from "$lib/matrix/client";
import { auth } from "./auth.svelte";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";

export interface LoudNotification {
    roomId: string;
    eventId: string;
    ts: number;
    sender: string;
    body: string;
    // Whether this notification is "loud" (sound tweak) vs "silent" (notify
    // only). Silent ones show in the notifications panel but don't drive the
    // red-dot badges/counts. Legacy stored entries lack this field and are
    // treated as loud.
    loud: boolean;
}

/** A stored notification counts toward red-dot badges only when loud. */
function isLoud(n: LoudNotification): boolean {
    return n.loud !== false;
}

const STORAGE_KEY = "matrix_loud_notifications";

function loadFromStorage(): Record<string, LoudNotification[]> {
    try {
        return JSON.parse(readScoped(STORAGE_KEY, auth.userId) ?? "{}");
    } catch {
        return {};
    }
}

function persist(byRoom: Record<string, LoudNotification[]>): void {
    writeScoped(STORAGE_KEY, auth.userId, JSON.stringify(byRoom));
}

export const notificationsState = $state({
    // Populated by reloadNotificationsFromStorage() once auth is known —
    // module init runs before the active account is established.
    byRoom: {} as Record<string, LoudNotification[]>,
    tick: 0,
});

/** (Re)load the active account's persisted notifications. App-boot call. */
export function reloadNotificationsFromStorage(): void {
    notificationsState.byRoom = loadFromStorage();
    notificationsState.tick++;
}

function bump() {
    notificationsState.tick++;
    persist(notificationsState.byRoom);
}

export function markNotification(n: LoudNotification): void {
    const existing = notificationsState.byRoom[n.roomId] ?? [];
    if (existing.some((e) => e.eventId === n.eventId)) return;
    notificationsState.byRoom[n.roomId] = [...existing, n];
    bump();
}

export function clearReadNotifications(room: Room, userId: string): void {
    const existing = notificationsState.byRoom[room.roomId];
    if (!existing || existing.length === 0) return;
    const remaining = existing.filter((n) => {
        try {
            return !room.hasUserReadEvent(userId, n.eventId);
        } catch {
            return true;
        }
    });
    if (remaining.length === existing.length) return;
    if (remaining.length === 0) {
        delete notificationsState.byRoom[room.roomId];
    } else {
        notificationsState.byRoom[room.roomId] = remaining;
    }
    bump();
}

export function clearAllForRoom(roomId: string): void {
    if (!notificationsState.byRoom[roomId]) return;
    delete notificationsState.byRoom[roomId];
    bump();
}

export function hasLoudInRoom(roomId: string): boolean {
    void notificationsState.tick;
    return (notificationsState.byRoom[roomId] ?? []).some(isLoud);
}

export function getLoudEventIds(roomId: string): Set<string> {
    void notificationsState.tick;
    return new Set(
        (notificationsState.byRoom[roomId] ?? [])
            .filter(isLoud)
            .map((n) => n.eventId),
    );
}

export function hasLoudInSpace(
    spaceId: string,
    visited = new Set<string>(),
): boolean {
    void notificationsState.tick;
    if (visited.has(spaceId)) return false;
    visited.add(spaceId);
    for (const r of getRoomsInSpace(spaceId)) {
        if (hasLoudInRoom(r.roomId)) return true;
    }
    for (const childId of getSpaceChildIds(spaceId)) {
        const child = getRoom(childId);
        if (child?.isSpaceRoom() && hasLoudInSpace(childId, visited))
            return true;
    }
    return false;
}

/** All stored notifications (loud + silent), newest first — for the panel. */
export function getAllNotifications(): LoudNotification[] {
    void notificationsState.tick;
    const all: LoudNotification[] = [];
    for (const arr of Object.values(notificationsState.byRoom)) {
        all.push(...arr);
    }
    return all.sort((a, b) => b.ts - a.ts);
}

/** Count of loud notifications only — drives the red-dot badge. */
export function getLoudNotificationCount(): number {
    void notificationsState.tick;
    let n = 0;
    for (const arr of Object.values(notificationsState.byRoom)) {
        n += arr.filter(isLoud).length;
    }
    return n;
}
