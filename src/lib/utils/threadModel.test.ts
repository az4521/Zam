// src/lib/utils/threadModel.test.ts
import { describe, it, expect } from "vitest";
import {
    belongsToMainTimeline,
    summarizeThread,
    threadReplyRootId,
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

// The notification path's main-vs-thread classification used to live inline in
// the SDK wrapper, where nothing could reach it: a reviewer deleted the
// self-referential guard there and the whole suite stayed green. These pin it.
describe("threadReplyRootId", () => {
    it("returns the root id for a genuine m.thread reply", () => {
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.thread", event_id: "$root" },
                eventId: "$reply",
            }),
        ).toBe("$root");
    });

    it("returns null for a self-referential m.thread relation", () => {
        // A relation pointing at its own event is malformed, not a reply — it
        // must stay a main-timeline event. Dropping this guard is the exact
        // mutation the suite failed to catch before.
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.thread", event_id: "$self" },
                eventId: "$self",
            }),
        ).toBeNull();
    });

    it("returns null for an m.thread relation with no event_id", () => {
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.thread" },
                eventId: "$x",
            }),
        ).toBeNull();
    });

    it("returns null for an edit (m.replace)", () => {
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.replace", event_id: "$target" },
                eventId: "$edit",
            }),
        ).toBeNull();
    });

    it("returns null for a reaction (m.annotation)", () => {
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.annotation", event_id: "$target" },
                eventId: "$react",
            }),
        ).toBeNull();
    });

    it("returns null for a rich reply (m.reference)", () => {
        expect(
            threadReplyRootId({
                relatesTo: { rel_type: "m.reference", event_id: "$target" },
                eventId: "$ref",
            }),
        ).toBeNull();
    });

    it("returns null when there is no relation at all", () => {
        expect(
            threadReplyRootId({ relatesTo: undefined, eventId: "$a" }),
        ).toBeNull();
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
