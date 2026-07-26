import { describe, it, expect } from "vitest";
import {
    notificationsToClose,
    appendPostedEventId,
    POSTED_EVENT_CAP,
} from "./notificationDismiss";

const room = (roomId: string, eventIds: string[]) => ({ roomId, eventIds });

describe("notificationsToClose", () => {
    it("closes nothing while nothing has been read", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1", "$2"])],
                readEventIds: new Set<string>(),
            }),
        ).toEqual([]);
    });

    it("closes a room once every event it covers has been read", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1", "$2"])],
                readEventIds: new Set(["$1", "$2"]),
            }),
        ).toEqual(["!a"]);
    });

    it("keeps a room that still has one unread event", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1", "$2"])],
                readEventIds: new Set(["$1"]),
            }),
        ).toEqual([]);
    });

    it("closes only the rooms that are fully read", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1"]), room("!b", ["$2"])],
                readEventIds: new Set(["$2"]),
            }),
        ).toEqual(["!b"]);
    });

    it("closes the room the user just opened, read or not", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1"]), room("!b", ["$2"])],
                readEventIds: new Set<string>(),
                openRoomId: "!a",
            }),
        ).toEqual(["!a"]);
    });

    it("treats a null openRoomId as 'no room open'", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1"])],
                readEventIds: new Set<string>(),
                openRoomId: null,
            }),
        ).toEqual([]);
    });

    // every([]) is true — that would close a notification nothing proves is
    // read. Closing an unread notification is the one bad direction here.
    it("never closes an entry with no event ids on the read rule", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", [])],
                readEventIds: new Set(["$1"]),
            }),
        ).toEqual([]);
    });

    it("still closes an empty entry when it is the open room", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", [])],
                readEventIds: new Set<string>(),
                openRoomId: "!a",
            }),
        ).toEqual(["!a"]);
    });

    it("returns each room id once when it qualifies twice", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1"]), room("!a", ["$1"])],
                readEventIds: new Set(["$1"]),
                openRoomId: "!a",
            }),
        ).toEqual(["!a"]);
    });

    // A room may be listed more than once with different coverage. Only the
    // entries that actually qualify may be deduped against, so a room that
    // FAILS at one index and PASSES at a later one must still be emitted —
    // marking it seen before the qualification check would swallow it.
    it("emits a room that fails at one index and passes at a later one", () => {
        expect(
            notificationsToClose({
                posted: [room("!a", ["$1", "$2"]), room("!a", ["$1"])],
                readEventIds: new Set(["$1"]),
            }),
        ).toEqual(["!a"]);
    });
});

describe("appendPostedEventId", () => {
    it("appends the new id at the end", () => {
        expect(appendPostedEventId(["$1"], "$2")).toEqual(["$1", "$2"]);
    });

    it("does not duplicate an id it already holds", () => {
        expect(appendPostedEventId(["$1", "$2"], "$2")).toEqual(["$1", "$2"]);
    });

    // Dropping the OLDEST is safe: Matrix read receipts are positional, so a
    // receipt covering a newer event covers the dropped ones too.
    it("drops the oldest id past the cap", () => {
        expect(appendPostedEventId(["$1", "$2", "$3"], "$4", 3)).toEqual([
            "$2",
            "$3",
            "$4",
        ]);
    });

    it("defaults to POSTED_EVENT_CAP", () => {
        let ids: string[] = [];
        for (let i = 0; i <= POSTED_EVENT_CAP; i++)
            ids = appendPostedEventId(ids, `$e${i}`);
        expect(ids.length).toBe(POSTED_EVENT_CAP);
        expect(ids.includes("$e0")).toBe(false);
    });

    // The bound is a promise about the result, not just about the append path:
    // an array that arrives over-cap must come back trimmed even when the id is
    // one it already holds, or it would stay over-cap forever.
    it("applies the cap even when the id is already held", () => {
        expect(appendPostedEventId(["$1", "$2", "$3"], "$1", 2)).toEqual([
            "$2",
            "$3",
        ]);
    });

    it("does not mutate the array it was given", () => {
        const existing = ["$1"];
        appendPostedEventId(existing, "$2");
        expect(existing).toEqual(["$1"]);
    });
});
