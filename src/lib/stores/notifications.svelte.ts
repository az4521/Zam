import type { Room } from "matrix-js-sdk";
import { getRoom, getRoomsInSpace, getSpaceChildIds } from "$lib/matrix/client";

export interface LoudNotification {
    roomId: string;
    eventId: string;
    ts: number;
    sender: string;
    body: string;
}

const STORAGE_KEY = "matrix_loud_notifications";

function loadFromStorage(): Record<string, LoudNotification[]> {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
        return {};
    }
}

function persist(byRoom: Record<string, LoudNotification[]>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(byRoom));
    } catch {
        // ignore
    }
}

export const notificationsState = $state({
    byRoom: loadFromStorage() as Record<string, LoudNotification[]>,
    tick: 0,
});

function bump() {
    notificationsState.tick++;
    persist(notificationsState.byRoom);
}

export function markLoudNotification(n: LoudNotification): void {
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
    return (notificationsState.byRoom[roomId]?.length ?? 0) > 0;
}

export function getLoudEventIds(roomId: string): Set<string> {
    void notificationsState.tick;
    return new Set(
        (notificationsState.byRoom[roomId] ?? []).map((n) => n.eventId),
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

export function getAllLoudNotifications(): LoudNotification[] {
    void notificationsState.tick;
    const all: LoudNotification[] = [];
    for (const arr of Object.values(notificationsState.byRoom)) {
        all.push(...arr);
    }
    return all.sort((a, b) => b.ts - a.ts);
}

export function getLoudNotificationCount(): number {
    void notificationsState.tick;
    let n = 0;
    for (const arr of Object.values(notificationsState.byRoom)) n += arr.length;
    return n;
}
