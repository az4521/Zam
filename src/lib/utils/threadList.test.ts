// src/lib/utils/threadList.test.ts
import { describe, it, expect } from "vitest";
import { buildThreadListItems, type ThreadInfo } from "./threadList";

function info(over: Partial<ThreadInfo> = {}): ThreadInfo {
    return {
        rootId: "$root",
        rootSenderId: "@a:x",
        rootPreview: "hello",
        replyCount: 1,
        latestTs: 1000,
        latestPreview: "reply",
        participated: false,
        unreadTotal: 0,
        unreadHighlight: 0,
        ...over,
    };
}

describe("buildThreadListItems", () => {
    it("sorts by latestTs descending", () => {
        const out = buildThreadListItems([
            info({ rootId: "$a", latestTs: 100 }),
            info({ rootId: "$b", latestTs: 300 }),
            info({ rootId: "$c", latestTs: 200 }),
        ]);
        expect(out.map((t) => t.rootId)).toEqual(["$b", "$c", "$a"]);
    });

    it("breaks ties on rootId ascending for determinism", () => {
        const out = buildThreadListItems([
            info({ rootId: "$z", latestTs: 100 }),
            info({ rootId: "$a", latestTs: 100 }),
        ]);
        expect(out.map((t) => t.rootId)).toEqual(["$a", "$z"]);
    });

    it("does not mutate the input array", () => {
        const input = [
            info({ rootId: "$a", latestTs: 100 }),
            info({ rootId: "$b", latestTs: 300 }),
        ];
        const before = input.map((t) => t.rootId);
        buildThreadListItems(input);
        expect(input.map((t) => t.rootId)).toEqual(before);
    });

    it("collapses whitespace/newlines in previews and trims", () => {
        const out = buildThreadListItems([
            info({ rootPreview: "  line one\n\nline   two \t" }),
        ]);
        expect(out[0].rootPreview).toBe("line one line two");
    });

    it("falls back to (no preview) for empty/whitespace bodies", () => {
        const out = buildThreadListItems([
            info({ rootPreview: "", latestPreview: "   \n\t " }),
        ]);
        expect(out[0].rootPreview).toBe("(no preview)");
        expect(out[0].latestPreview).toBe("(no preview)");
    });

    it("truncates long previews to 120 chars with an ellipsis", () => {
        const long = "x".repeat(200);
        const out = buildThreadListItems([info({ rootPreview: long })]);
        expect(out[0].rootPreview).toBe("x".repeat(120) + "…");
        expect(out[0].rootPreview.length).toBe(121);
    });

    it("does not append an ellipsis when exactly at the limit", () => {
        const exact = "y".repeat(120);
        const out = buildThreadListItems([info({ rootPreview: exact })]);
        expect(out[0].rootPreview).toBe(exact);
    });

    it("passes through count, participated, sender, ts, and null sender", () => {
        const out = buildThreadListItems([
            info({
                rootId: "$r",
                rootSenderId: null,
                replyCount: 7,
                latestTs: 42,
                participated: true,
            }),
        ]);
        expect(out[0]).toMatchObject({
            rootId: "$r",
            rootSenderId: null,
            replyCount: 7,
            latestTs: 42,
            participated: true,
        });
    });

    it("returns an empty array for no threads", () => {
        expect(buildThreadListItems([])).toEqual([]);
    });

    it("carries per-thread unread counts through unchanged", () => {
        const items = buildThreadListItems([
            {
                rootId: "$a",
                rootSenderId: "@u:s",
                rootPreview: "root",
                replyCount: 2,
                latestTs: 100,
                latestPreview: "latest",
                participated: true,
                unreadTotal: 5,
                unreadHighlight: 2,
            },
        ]);
        expect(items[0].unreadTotal).toBe(5);
        expect(items[0].unreadHighlight).toBe(2);
    });
});
