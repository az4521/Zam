// src/lib/utils/threadModel.test.ts
import { describe, it, expect } from "vitest";
import {
    belongsToMainTimeline,
    sameThreadSummary,
    summarizeThread,
} from "./threadModel";

describe("belongsToMainTimeline", () => {
    it("keeps a plain message with no relation", () => {
        expect(
            belongsToMainTimeline({ relatesTo: undefined, eventId: "$a" }),
        ).toBe(true);
    });

    it("keeps a thread ROOT (its own id, no thread relation)", () => {
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.annotation", event_id: "$other" },
                eventId: "$root",
            }),
        ).toBe(true);
    });

    it("drops a thread reply (m.thread relation to a different root)", () => {
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.thread", event_id: "$root" },
                eventId: "$reply",
            }),
        ).toBe(false);
    });

    it("keeps an edit (m.replace) — handled by the separate replace clause", () => {
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.replace", event_id: "$target" },
                eventId: "$edit",
            }),
        ).toBe(true);
    });

    it("keeps a reaction (m.annotation)", () => {
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.annotation", event_id: "$target" },
                eventId: "$react",
            }),
        ).toBe(true);
    });

    it("keeps a defensive edge: m.thread relation whose event_id equals the event's own id", () => {
        // Not a real reply (would point at itself) — do not divert.
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.thread", event_id: "$self" },
                eventId: "$self",
            }),
        ).toBe(true);
    });

    it("keeps an m.thread relation with a missing event_id (malformed)", () => {
        expect(
            belongsToMainTimeline({
                relatesTo: { rel_type: "m.thread" },
                eventId: "$x",
            }),
        ).toBe(true);
    });
});

describe("summarizeThread", () => {
    it("maps length → count and passes latest through", () => {
        expect(
            summarizeThread({
                length: 3,
                latestEventId: "$last",
                latestTs: 1700,
            }),
        ).toEqual({ count: 3, latestEventId: "$last", latestTs: 1700 });
    });

    it("maps a zero-reply root", () => {
        expect(
            summarizeThread({ length: 0, latestEventId: null, latestTs: 0 }),
        ).toEqual({ count: 0, latestEventId: null, latestTs: 0 });
    });
});

describe("sameThreadSummary", () => {
    const base = { count: 2, latestEventId: "$b", latestTs: 1000 };

    it("is true for two structurally identical summaries", () => {
        expect(sameThreadSummary({ ...base }, { ...base })).toBe(true);
    });

    it("is false when the reply count changes", () => {
        expect(sameThreadSummary(base, { ...base, count: 3 })).toBe(false);
    });

    it("is false when the latest event changes", () => {
        expect(sameThreadSummary(base, { ...base, latestEventId: "$c" })).toBe(
            false,
        );
    });

    it("is false when the latest timestamp changes", () => {
        expect(sameThreadSummary(base, { ...base, latestTs: 1001 })).toBe(
            false,
        );
    });

    it("handles null on either side", () => {
        expect(sameThreadSummary(null, null)).toBe(true);
        expect(sameThreadSummary(null, base)).toBe(false);
        expect(sameThreadSummary(base, null)).toBe(false);
    });
});
