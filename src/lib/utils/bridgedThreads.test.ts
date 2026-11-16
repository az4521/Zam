import { describe, expect, it } from "vitest";
import {
    THREAD_PARENT_TYPE,
    buildBridgedThreadIndex,
    nestThreadRows,
    parseSpaceChildThreadParent,
    parseThreadParent,
    starterKey,
    stripThreadNamePrefix,
} from "./bridgedThreads";

describe("parseThreadParent", () => {
    it("reads the ZDMB state content", () => {
        expect(
            parseThreadParent({
                room_id: "!chan:example.org",
                via: ["example.org"],
                event_id: "$start",
            }),
        ).toEqual({
            roomId: "!chan:example.org",
            eventId: "$start",
            via: ["example.org"],
        });
    });

    it("treats event_id and via as optional", () => {
        expect(parseThreadParent({ room_id: "!chan:example.org" })).toEqual({
            roomId: "!chan:example.org",
            via: [],
        });
    });

    it("rejects malformed content", () => {
        expect(parseThreadParent(null)).toBeNull();
        expect(parseThreadParent([])).toBeNull();
        expect(parseThreadParent({})).toBeNull();
        expect(parseThreadParent({ room_id: 5 })).toBeNull();
        expect(parseThreadParent({ room_id: "#alias:example.org" })).toBeNull();
    });

    it("drops a bad event_id and non-string via entries", () => {
        expect(
            parseThreadParent({
                room_id: "!c:x",
                event_id: "nope",
                via: ["x", 3, ""],
            }),
        ).toEqual({ roomId: "!c:x", via: ["x"] });
    });
});

describe("parseSpaceChildThreadParent", () => {
    it("reads the key on a live m.space.child", () => {
        expect(
            parseSpaceChildThreadParent({
                via: ["x"],
                order: "a",
                [THREAD_PARENT_TYPE]: { room_id: "!c:x", event_id: "$e" },
            }),
        ).toEqual({ roomId: "!c:x", eventId: "$e", via: [] });
    });

    it("ignores a removed child (no via) and plain children", () => {
        expect(
            parseSpaceChildThreadParent({
                [THREAD_PARENT_TYPE]: { room_id: "!c:x" },
            }),
        ).toBeNull();
        expect(parseSpaceChildThreadParent({ via: ["x"] })).toBeNull();
    });
});

describe("buildBridgedThreadIndex", () => {
    it("indexes parents, children and starter events", () => {
        const idx = buildBridgedThreadIndex([
            {
                threadRoomId: "!t1",
                parent: { roomId: "!c", eventId: "$a", via: [] },
            },
            { threadRoomId: "!t2", parent: { roomId: "!c", via: [] } },
        ]);
        expect(idx.parentOf.get("!t1")?.roomId).toBe("!c");
        expect(idx.threadsOf.get("!c")).toEqual(["!t1", "!t2"]);
        expect(idx.byStarter.get(starterKey("!c", "$a"))).toBe("!t1");
        expect(idx.byStarter.size).toBe(1);
    });

    it("prefers the first source and fills gaps from a later one", () => {
        const idx = buildBridgedThreadIndex([
            { threadRoomId: "!t", parent: { roomId: "!c", via: ["x"] } },
            {
                threadRoomId: "!t",
                parent: { roomId: "!c", eventId: "$e", via: ["y"] },
            },
            { threadRoomId: "!t", parent: { roomId: "!other", via: [] } },
        ]);
        expect(idx.parentOf.get("!t")).toEqual({
            roomId: "!c",
            eventId: "$e",
            via: ["x"],
        });
        expect(idx.threadsOf.has("!other")).toBe(false);
    });

    it("ignores a room naming itself as its parent", () => {
        const idx = buildBridgedThreadIndex([
            { threadRoomId: "!c", parent: { roomId: "!c", via: [] } },
        ]);
        expect(idx.parentOf.size).toBe(0);
    });
});

describe("nestThreadRows", () => {
    const parents: Record<string, string> = {
        t1: "a",
        t2: "a",
        t3: "b",
        t4: "gone",
    };
    const parentOf = (id: string) => parents[id] ?? null;

    it("moves threads under their channel, keeping their order", () => {
        const rows = nestThreadRows(
            ["t2", "a", "b", "t1", "t3"],
            (x) => x,
            parentOf,
        );
        expect(rows).toEqual([
            { item: "a", depth: 0 },
            { item: "t2", depth: 1 },
            { item: "t1", depth: 1 },
            { item: "b", depth: 0 },
            { item: "t3", depth: 1 },
        ]);
    });

    it("leaves a thread top-level when its channel is not listed", () => {
        expect(nestThreadRows(["a", "t4"], (x) => x, parentOf)).toEqual([
            { item: "a", depth: 0 },
            { item: "t4", depth: 0 },
        ]);
    });

    it("nests only one level deep", () => {
        const deep: Record<string, string> = { b: "a", c: "b" };
        const rows = nestThreadRows(
            ["a", "b", "c"],
            (x) => x,
            (id) => deep[id],
        );
        expect(rows).toEqual([
            { item: "a", depth: 0 },
            { item: "b", depth: 1 },
            { item: "c", depth: 0 },
        ]);
    });
});

describe("stripThreadNamePrefix", () => {
    it("drops the public and private thread tags", () => {
        expect(stripThreadNamePrefix("[⛓️] cats")).toBe("cats");
        expect(stripThreadNamePrefix("[⛓] cats")).toBe("cats");
        expect(stripThreadNamePrefix("[🔒⛓️] secret cats")).toBe("secret cats");
    });

    it("leaves other names alone", () => {
        expect(stripThreadNamePrefix("cats [⛓️]")).toBe("cats [⛓️]");
        expect(stripThreadNamePrefix("[🔒] cats")).toBe("[🔒] cats");
        expect(stripThreadNamePrefix("[⛓️] ")).toBe("[⛓️] ");
    });
});
