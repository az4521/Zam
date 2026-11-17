import { describe, expect, it } from "vitest";
import {
    groupReactionDetails,
    initialReactionKey,
    type ReactionRecord,
} from "./reactionDetails";

const rec = (
    sender: string,
    key: string,
    ts: number,
    over: Partial<ReactionRecord> = {},
): ReactionRecord => ({
    sender,
    key,
    ts,
    id: `$${sender}${key}${ts}`,
    status: null,
    isRedacted: false,
    ...over,
});

describe("groupReactionDetails", () => {
    it("groups by key, most used first, newest reactor first", () => {
        const groups = groupReactionDetails([
            rec("@a:x", "👍", 10),
            rec("@b:x", "👍", 30),
            rec("@c:x", "❤️", 20),
        ]);
        expect(groups.map((g) => [g.key, g.count])).toEqual([
            ["👍", 2],
            ["❤️", 1],
        ]);
        expect(groups[0].reactors.map((r) => r.userId)).toEqual([
            "@b:x",
            "@a:x",
        ]);
    });

    it("counts a repeated sender and key once, keeping the newest", () => {
        const [g] = groupReactionDetails([
            rec("@a:x", "👍", 10),
            rec("@a:x", "👍", 50),
        ]);
        expect(g.count).toBe(1);
        expect(g.reactors[0].ts).toBe(50);
    });

    it("skips redacted and malformed reactions", () => {
        expect(
            groupReactionDetails([
                rec("@a:x", "👍", 1, { isRedacted: true }),
                rec("@a:x", "", 1),
                { ...rec("@a:x", "👍", 1), sender: null },
            ]),
        ).toEqual([]);
    });

    it("marks local echoes pending and tolerates a bad timestamp", () => {
        const [g] = groupReactionDetails([
            rec("@a:x", "👍", NaN, { status: "sending", id: null }),
        ]);
        expect(g.reactors[0]).toMatchObject({
            ts: 0,
            pending: true,
            eventId: null,
        });
    });
});

describe("initialReactionKey", () => {
    const groups = groupReactionDetails([
        rec("@a:x", "👍", 1),
        rec("@b:x", "👍", 2),
        rec("@me:x", "🎉", 3),
    ]);
    it("prefers the viewer's own reaction", () => {
        expect(initialReactionKey(groups, "@me:x")).toBe("🎉");
    });
    it("falls back to the most used, or null when empty", () => {
        expect(initialReactionKey(groups, "@zz:x")).toBe("👍");
        expect(initialReactionKey([], null)).toBeNull();
    });
});
