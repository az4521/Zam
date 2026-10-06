import { describe, expect, it } from "vitest";
import {
    PENDING_ROUTE_KEY,
    PENDING_ROUTE_TTL_MS,
    savePendingRoute,
    takePendingRoute,
} from "./pendingNotificationRoute";

function memoryStorage() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => void m.set(k, v),
        removeItem: (k: string) => void m.delete(k),
        has: (k: string) => m.has(k),
    };
}

const route = { userId: "@b:hs", roomId: "!room:hs", eventId: "$ev" };

describe("pending notification route", () => {
    it("hands the route to the account it was saved for, once", () => {
        const s = memoryStorage();
        savePendingRoute(s, route, 1000);
        expect(takePendingRoute(s, "@b:hs", 2000)).toEqual(route);
        expect(takePendingRoute(s, "@b:hs", 2000)).toBeNull();
    });

    it("drops a route for another account", () => {
        const s = memoryStorage();
        savePendingRoute(s, route, 1000);
        expect(takePendingRoute(s, "@a:hs", 2000)).toBeNull();
        expect(s.has(PENDING_ROUTE_KEY)).toBe(false);
    });

    it("drops a stale route", () => {
        const s = memoryStorage();
        savePendingRoute(s, route, 1000);
        expect(
            takePendingRoute(s, "@b:hs", 1000 + PENDING_ROUTE_TTL_MS + 1),
        ).toBeNull();
    });

    it("drops malformed values and a missing user", () => {
        const s = memoryStorage();
        s.setItem(PENDING_ROUTE_KEY, "not json");
        expect(takePendingRoute(s, "@b:hs")).toBeNull();
        s.setItem(PENDING_ROUTE_KEY, JSON.stringify({ userId: "@b:hs" }));
        expect(takePendingRoute(s, "@b:hs")).toBeNull();
        savePendingRoute(s, route);
        expect(takePendingRoute(s, null)).toBeNull();
    });

    it("omits an empty event id", () => {
        const s = memoryStorage();
        savePendingRoute(s, { ...route, eventId: "" }, 1000);
        expect(takePendingRoute(s, "@b:hs", 1000)).toEqual({
            userId: "@b:hs",
            roomId: "!room:hs",
        });
    });
});
