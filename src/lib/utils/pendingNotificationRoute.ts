// A notification tapped for a signed-in account that isn't the active one:
// the app switches to that account (a full reload), and the room to open has
// to survive the reload. Stored for the account it belongs to, and only
// briefly, so a switch that never happened can't hijack a later boot.

export const PENDING_ROUTE_KEY = "zam:pendingNotificationRoute";

/** How long a pending route stays usable: the switch is a single reload. */
export const PENDING_ROUTE_TTL_MS = 2 * 60 * 1000;

export interface PendingNotificationRoute {
    userId: string;
    roomId: string;
    eventId?: string;
}

interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function savePendingRoute(
    storage: StorageLike,
    route: PendingNotificationRoute,
    now: number = Date.now(),
): void {
    try {
        storage.setItem(
            PENDING_ROUTE_KEY,
            JSON.stringify({ ...route, ts: now }),
        );
    } catch {
        /* storage unavailable: the switch still happens, without the jump */
    }
}

/**
 * The route saved for `userId`, removed whatever it holds: one that is stale,
 * malformed or for another account is dropped, never left for a later boot.
 */
export function takePendingRoute(
    storage: StorageLike,
    userId: string | null | undefined,
    now: number = Date.now(),
): PendingNotificationRoute | null {
    let raw: string | null;
    try {
        raw = storage.getItem(PENDING_ROUTE_KEY);
        storage.removeItem(PENDING_ROUTE_KEY);
    } catch {
        return null;
    }
    if (!raw || !userId) return null;
    try {
        const v = JSON.parse(raw) as Record<string, unknown>;
        if (
            v.userId !== userId ||
            typeof v.roomId !== "string" ||
            !v.roomId ||
            typeof v.ts !== "number" ||
            now - v.ts > PENDING_ROUTE_TTL_MS ||
            v.ts > now + PENDING_ROUTE_TTL_MS
        )
            return null;
        return {
            userId,
            roomId: v.roomId,
            ...(typeof v.eventId === "string" && v.eventId
                ? { eventId: v.eventId }
                : {}),
        };
    } catch {
        return null;
    }
}
