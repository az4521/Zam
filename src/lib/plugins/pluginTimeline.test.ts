import { describe, it, expect } from "vitest";
import {
    selectRecentMessages,
    DEFAULT_RECENT_LIMIT,
    MAX_RECENT_LIMIT,
    type PluginTimelineRecord,
} from "./pluginTimeline";

const rec = (i: number, sender = "@a:s"): PluginTimelineRecord => ({
    eventId: `$e${i}`,
    sender,
    msgtype: "m.text",
    body: `msg ${i}`,
    timestamp: 1000 + i,
    isRedacted: false,
});

describe("selectRecentMessages", () => {
    it("returns the last DEFAULT_RECENT_LIMIT rows in chronological order", () => {
        const input = Array.from({ length: 25 }, (_, i) => rec(i));
        const out = selectRecentMessages(input);
        expect(out).toHaveLength(DEFAULT_RECENT_LIMIT);
        expect(out[0].eventId).toBe("$e5"); // 25 - 20
        expect(out[out.length - 1].eventId).toBe("$e24");
    });

    it("honours an explicit limit", () => {
        const input = Array.from({ length: 10 }, (_, i) => rec(i));
        expect(selectRecentMessages(input, 3).map((m) => m.eventId)).toEqual([
            "$e7",
            "$e8",
            "$e9",
        ]);
    });

    it("clamps a zero/negative/NaN limit up to 1", () => {
        const input = Array.from({ length: 5 }, (_, i) => rec(i));
        expect(selectRecentMessages(input, 0)).toHaveLength(1);
        expect(selectRecentMessages(input, -4)).toHaveLength(1);
        expect(selectRecentMessages(input, Number.NaN)).toHaveLength(1);
    });

    it("clamps an over-large limit down to MAX_RECENT_LIMIT", () => {
        const input = Array.from({ length: 150 }, (_, i) => rec(i));
        expect(selectRecentMessages(input, 9999)).toHaveLength(
            MAX_RECENT_LIMIT,
        );
    });

    it("computes isOwn from ownUserId", () => {
        const input = [rec(0, "@me:s"), rec(1, "@other:s")];
        const out = selectRecentMessages(input, 10, "@me:s");
        expect(out[0].isOwn).toBe(true);
        expect(out[1].isOwn).toBe(false);
    });

    it("marks everything not-own when ownUserId is null/omitted", () => {
        const input = [rec(0, "@me:s")];
        expect(selectRecentMessages(input, 10)[0].isOwn).toBe(false);
        expect(selectRecentMessages(input, 10, null)[0].isOwn).toBe(false);
    });

    it("does not mutate the input array", () => {
        const input = Array.from({ length: 5 }, (_, i) => rec(i));
        const snapshot = input.map((r) => r.eventId);
        selectRecentMessages(input, 2);
        expect(input.map((r) => r.eventId)).toEqual(snapshot);
    });

    it("returns [] for empty input and all rows when limit exceeds length", () => {
        expect(selectRecentMessages([], 5)).toEqual([]);
        const input = [rec(0), rec(1)];
        expect(selectRecentMessages(input, 50)).toHaveLength(2);
    });
});
