import { describe, expect, it } from "vitest";
import {
    isLoudNotification,
    pickNewNotifications,
    type ServerNotification,
} from "./accountNotifications";

const n = (
    id: string,
    ts: number,
    over: Partial<ServerNotification> = {},
): ServerNotification => ({
    actions: ["notify"],
    event: { event_id: id, type: "m.room.message", sender: "@a:hs" },
    read: false,
    room_id: "!r:hs",
    ts,
    ...over,
});

const none = () => false;

describe("pickNewNotifications", () => {
    it("only sets the cursor on the first poll", () => {
        const r = pickNewNotifications([n("$a", 10), n("$b", 20)], null, none);
        expect(r).toEqual({ fresh: [], cursor: 20 });
    });

    it("returns unread notifications newer than the cursor, oldest first", () => {
        const r = pickNewNotifications(
            [n("$c", 30), n("$b", 20), n("$a", 10)],
            10,
            none,
        );
        expect(r.fresh.map((x) => x.event?.event_id)).toEqual(["$b", "$c"]);
        expect(r.cursor).toBe(30);
    });

    it("skips read, already shown and malformed entries", () => {
        const r = pickNewNotifications(
            [
                n("$read", 20, { read: true }),
                n("$shown", 21),
                n("$noroom", 22, { room_id: undefined }),
                { ts: 23, room_id: "!r:hs" },
                n("$ok", 24),
            ],
            10,
            (id) => id === "$shown",
        );
        expect(r.fresh.map((x) => x.event?.event_id)).toEqual(["$ok"]);
    });

    it("keeps the newest few of a burst", () => {
        const list = Array.from({ length: 8 }, (_, i) => n(`$${i}`, 100 + i));
        const r = pickNewNotifications(list, 0, none, 3);
        expect(r.fresh.map((x) => x.event?.event_id)).toEqual([
            "$5",
            "$6",
            "$7",
        ]);
    });

    it("never moves the cursor backwards", () => {
        expect(pickNewNotifications([n("$a", 5)], 50, none).cursor).toBe(50);
    });
});

describe("isLoudNotification", () => {
    it("is loud only with a sound tweak", () => {
        expect(
            isLoudNotification(["notify", { set_tweak: "sound", value: "x" }]),
        ).toBe(true);
        expect(isLoudNotification(["notify"])).toBe(false);
        expect(isLoudNotification(undefined)).toBe(false);
    });
});
