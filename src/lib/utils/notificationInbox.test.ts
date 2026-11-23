import { describe, expect, it } from "vitest";
import {
    capInbox,
    INBOX_MAX_ENTRIES,
    removeInboxEvents,
    type InboxEntry,
} from "./notificationInbox";

const n = (roomId: string, eventId: string, ts: number): InboxEntry => ({
    roomId,
    eventId,
    ts,
});

describe("removeInboxEvents", () => {
    it("removes only the redacted events, across rooms", () => {
        const byRoom = {
            "!a": [n("!a", "$1", 1), n("!a", "$2", 2)],
            "!b": [n("!b", "$3", 3)],
        };
        const next = removeInboxEvents(byRoom, [
            { roomId: "!a", eventId: "$2" },
            { roomId: "!b", eventId: "$3" },
        ]);
        expect(next).toEqual({ "!a": [n("!a", "$1", 1)] });
    });

    it("drops a room whose last entry went", () => {
        const next = removeInboxEvents({ "!a": [n("!a", "$1", 1)] }, [
            { roomId: "!a", eventId: "$1" },
        ]);
        expect(next).toEqual({});
    });

    it("matches on room and event id, not event id alone", () => {
        const byRoom = { "!a": [n("!a", "$1", 1)] };
        expect(
            removeInboxEvents(byRoom, [{ roomId: "!other", eventId: "$1" }]),
        ).toBeNull();
    });

    it("returns null when nothing matches, so no write happens", () => {
        const byRoom = { "!a": [n("!a", "$1", 1)] };
        expect(removeInboxEvents(byRoom, [])).toBeNull();
        expect(
            removeInboxEvents(byRoom, [{ roomId: "!a", eventId: "$9" }]),
        ).toBeNull();
    });
});

describe("capInbox", () => {
    it("returns null while the inbox is within the bound", () => {
        const byRoom = { "!a": [n("!a", "$1", 1), n("!a", "$2", 2)] };
        expect(capInbox(byRoom, 2)).toBeNull();
    });

    it("keeps the newest entries across rooms and preserves their order", () => {
        const byRoom = {
            "!a": [n("!a", "$1", 1), n("!a", "$4", 4)],
            "!b": [n("!b", "$2", 2), n("!b", "$3", 3)],
        };
        expect(capInbox(byRoom, 2)).toEqual({
            "!a": [n("!a", "$4", 4)],
            "!b": [n("!b", "$3", 3)],
        });
    });

    it("bounds the default inbox at INBOX_MAX_ENTRIES", () => {
        const list: InboxEntry[] = [];
        for (let i = 0; i < INBOX_MAX_ENTRIES + 50; i++)
            list.push(n("!a", `$${i}`, i));
        const capped = capInbox({ "!a": list });
        expect(capped).not.toBeNull();
        const kept = capped!["!a"];
        expect(kept).toHaveLength(INBOX_MAX_ENTRIES);
        expect(kept[0].eventId).toBe("$50");
        expect(kept[kept.length - 1].eventId).toBe(
            `$${INBOX_MAX_ENTRIES + 49}`,
        );
    });
});
