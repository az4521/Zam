import { describe, it, expect } from "vitest";
import { countReactions, type ReactionAnnotation } from "./reactionCounts";

const ann = (over: Partial<ReactionAnnotation>): ReactionAnnotation => ({
    sender: "@a:hs",
    key: "👍",
    id: "$r1",
    status: null,
    isRedacted: false,
    ...over,
});

describe("countReactions — spec dedupe + own-reaction bookkeeping", () => {
    it("counts distinct senders of the same key", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", id: "$1" }),
                ann({ sender: "@b:hs", id: "$2" }),
                ann({ sender: "@c:hs", id: "$3" }),
            ],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 3,
                isMine: false,
                myEventId: null,
                reactorIds: ["@a:hs", "@b:hs", "@c:hs"],
            },
        ]);
    });

    it("counts a duplicate (same sender + same key) only once", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", id: "$1" }),
                ann({ sender: "@a:hs", id: "$2" }), // federation dupe
                ann({ sender: "@b:hs", id: "$3" }),
            ],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 2,
                isMine: false,
                myEventId: null,
                reactorIds: ["@a:hs", "@b:hs"],
            },
        ]);
    });

    it("keeps distinct keys from one sender as separate groups", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", key: "👍", id: "$1" }),
                ann({ sender: "@a:hs", key: "🎉", id: "$2" }),
            ],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 1,
                isMine: false,
                myEventId: null,
                reactorIds: ["@a:hs"],
            },
            {
                key: "🎉",
                count: 1,
                isMine: false,
                myEventId: null,
                reactorIds: ["@a:hs"],
            },
        ]);
    });

    it("marks own reaction and records the confirmed event id", () => {
        const out = countReactions(
            [
                ann({ sender: "@b:hs", id: "$1" }),
                ann({ sender: "@me:hs", id: "$mine", status: null }),
            ],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 2,
                isMine: true,
                myEventId: "$mine",
                reactorIds: ["@b:hs", "@me:hs"],
            },
        ]);
    });

    it("does not record myEventId for a still-sending own local echo", () => {
        const out = countReactions(
            [ann({ sender: "@me:hs", id: "$echo", status: "sending" })],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 1,
                isMine: true,
                myEventId: null,
                reactorIds: ["@me:hs"],
            },
        ]);
    });

    it("dedupes an own duplicate reaction without losing isMine/myEventId", () => {
        const out = countReactions(
            [
                ann({ sender: "@me:hs", id: "$mine", status: null }),
                ann({ sender: "@me:hs", id: "$dupe", status: null }), // dupe
            ],
            "@me:hs",
        );
        // count is 1 (deduped) but the reaction is still mine, and myEventId
        // reflects the latest confirmed own annotation just as before.
        expect(out).toEqual([
            {
                key: "👍",
                count: 1,
                isMine: true,
                myEventId: "$dupe",
                reactorIds: ["@me:hs"],
            },
        ]);
    });

    it("skips redacted annotations and empty keys", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", id: "$1", isRedacted: true }),
                ann({ sender: "@b:hs", id: "$2", key: "" }),
                ann({ sender: "@c:hs", id: "$3" }),
            ],
            "@me:hs",
        );
        expect(out).toEqual([
            {
                key: "👍",
                count: 1,
                isMine: false,
                myEventId: null,
                reactorIds: ["@c:hs"],
            },
        ]);
    });

    it("collects deduped non-null reactor ids in first-seen order", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", id: "$1" }),
                ann({ sender: "@b:hs", id: "$2" }),
                ann({ sender: "@a:hs", id: "$3" }), // federation dupe of @a
                ann({ sender: null, id: "$4" }), // unknown sender — counted, not listed
            ],
            "@me:hs",
        );
        expect(out).toHaveLength(1);
        expect(out[0].reactorIds).toEqual(["@a:hs", "@b:hs"]);
    });

    it("omits redacted and empty-key annotations from reactorIds", () => {
        const out = countReactions(
            [
                ann({ sender: "@a:hs", id: "$1", isRedacted: true }),
                ann({ sender: "@b:hs", id: "$2", key: "" }),
                ann({ sender: "@c:hs", id: "$3" }),
            ],
            "@me:hs",
        );
        expect(out[0].reactorIds).toEqual(["@c:hs"]);
    });
});
