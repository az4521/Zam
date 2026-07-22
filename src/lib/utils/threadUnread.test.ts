// src/lib/utils/threadUnread.test.ts
import { describe, it, expect } from "vitest";
import { threadBadgeState, rollupRoomThreadUnread } from "./threadUnread";

describe("threadBadgeState", () => {
    it("returns none when nothing unread", () => {
        expect(threadBadgeState({ total: 0, highlight: 0 })).toBe("none");
    });
    it("returns unread when total > 0 and no highlight", () => {
        expect(threadBadgeState({ total: 3, highlight: 0 })).toBe("unread");
    });
    it("returns mention when highlight > 0", () => {
        expect(threadBadgeState({ total: 3, highlight: 1 })).toBe("mention");
    });
    it("mention wins even when highlight equals total", () => {
        expect(threadBadgeState({ total: 2, highlight: 2 })).toBe("mention");
    });
    it("returns mention when only highlight is set (defensive)", () => {
        expect(threadBadgeState({ total: 0, highlight: 1 })).toBe("mention");
    });
});

describe("rollupRoomThreadUnread", () => {
    it("empty list → no unread, no mentions", () => {
        expect(rollupRoomThreadUnread([])).toEqual({
            anyUnread: false,
            mentions: 0,
        });
    });
    it("all-zero threads → no unread", () => {
        expect(
            rollupRoomThreadUnread([
                { total: 0, highlight: 0 },
                { total: 0, highlight: 0 },
            ]),
        ).toEqual({ anyUnread: false, mentions: 0 });
    });
    it("unread-only threads → anyUnread true, mentions 0", () => {
        expect(
            rollupRoomThreadUnread([
                { total: 4, highlight: 0 },
                { total: 0, highlight: 0 },
            ]),
        ).toEqual({ anyUnread: true, mentions: 0 });
    });
    it("sums highlight counts across threads", () => {
        expect(
            rollupRoomThreadUnread([
                { total: 5, highlight: 2 },
                { total: 3, highlight: 1 },
                { total: 1, highlight: 0 },
            ]),
        ).toEqual({ anyUnread: true, mentions: 3 });
    });
    it("counts a highlight-only thread as unread", () => {
        expect(rollupRoomThreadUnread([{ total: 0, highlight: 2 }])).toEqual({
            anyUnread: true,
            mentions: 2,
        });
    });
});
