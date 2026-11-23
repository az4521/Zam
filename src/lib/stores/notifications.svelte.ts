import type { Room } from "matrix-js-sdk";
import { getRoom, getRoomsInSpace, getSpaceChildIds } from "$lib/matrix/client";
import { auth } from "./auth.svelte";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
import { isLoudNotificationRead } from "$lib/utils/loudNotifications";
import { capInbox, removeInboxEvents } from "$lib/utils/notificationInbox";

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
    const loaded = loadFromStorage();
    const capped = capInbox(loaded);
    notificationsState.byRoom = capped ?? loaded;
    notificationsState.tick++;
    // Trimmed on load so an oversized stash from an older build shrinks once.
    if (capped) persist(notificationsState.byRoom);
}

function bump() {
    notificationsState.tick++;
    persist(notificationsState.byRoom);
}

export function markNotification(n: LoudNotification): void {
    const existing = notificationsState.byRoom[n.roomId] ?? [];
    if (existing.some((e) => e.eventId === n.eventId)) return;
    notificationsState.byRoom[n.roomId] = [...existing, n];
    // Bounded: the oldest bodies go once the inbox is full.
    const capped = capInbox(notificationsState.byRoom);
    if (capped) notificationsState.byRoom = capped;
    bump();
}

/**
 * Drop the inbox entries for events that were redacted. One persist for the
 * whole batch, however many events it names.
 */
export function forgetNotificationEvents(
    refs: readonly { roomId: string; eventId: string }[],
): void {
    const next = removeInboxEvents(notificationsState.byRoom, refs);
    if (!next) return;
    notificationsState.byRoom = next;
    bump();
}

// Redactions arrive one at a time; batch them into one forget (one write).
const FORGET_BATCH_MS = 250;
let forgetQueue: { roomId: string; eventId: string }[] = [];
let forgetTimer: ReturnType<typeof setTimeout> | null = null;

/** Queue a redacted event for removal from the inbox (batched). */
export function queueNotificationForget(roomId: string, eventId: string): void {
    forgetQueue.push({ roomId, eventId });
    if (forgetTimer) return;
    forgetTimer = setTimeout(() => {
        forgetTimer = null;
        const batch = forgetQueue;
        forgetQueue = [];
        forgetNotificationEvents(batch);
    }, FORGET_BATCH_MS);
}

export function clearReadNotifications(room: Room, userId: string): void {
    const existing = notificationsState.byRoom[room.roomId];
    if (!existing || existing.length === 0) return;
    // Latest read position, across public + private receipts. hasUserReadEvent
    // alone can't clear a notification whose event has aged out of the loaded
    // timeline (it returns false for events it can't locate), so entries older
    // than this timestamp are cleared regardless — see isLoudNotificationRead.
    const receiptTsOf = (type?: string) => {
        try {
            return (
                room.getReadReceiptForUserId(userId, false, type as never)?.data
                    ?.ts ?? 0
            );
        } catch {
            return 0;
        }
    };
    const readReceiptTs =
        Math.max(receiptTsOf(), receiptTsOf("m.read.private")) || null;
    const remaining = existing.filter(
        (n) =>
            !isLoudNotificationRead(n, {
                hasReadEvent: (id) => room.hasUserReadEvent(userId, id),
                readReceiptTs,
            }),
    );
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

/** Count of unread events that appear in the notifications inbox. */
export function getNotificationCount(): number {
    void notificationsState.tick;
    let count = 0;
    for (const entries of Object.values(notificationsState.byRoom)) {
        count += entries.length;
    }
    return count;
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
