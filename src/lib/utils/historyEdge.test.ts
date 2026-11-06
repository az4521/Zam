import { describe, it, expect } from "vitest";
import type { EventTimeline } from "matrix-js-sdk";
import {
    historyEdge,
    hasRoomCreate,
    timelineReachesRoomCreate,
} from "./historyEdge";

// Regression cover for issue #49: the chat-start banner was shown whenever the
// list was empty, so a room whose history had not paginated yet looked like the
// beginning of the chat.

const ev = (type: string) => ({ getType: () => type });

describe("historyEdge", () => {
    it("shows the start only once m.room.create is reached", () => {
        expect(
            historyEdge({
                reachedStart: true,
                hasOlder: false,
                loadingOlder: false,
            }),
        ).toBe("start");
    });

    it("shows loading for a fresh room before any backfill has run", () => {
        expect(
            historyEdge({
                reachedStart: false,
                hasOlder: true,
                loadingOlder: false,
            }),
        ).toBe("loading");
    });

    it("shows loading while a page is in flight, even if pagination looks exhausted", () => {
        expect(
            historyEdge({
                reachedStart: false,
                hasOlder: false,
                loadingOlder: true,
            }),
        ).toBe("loading");
    });

    it("shows nothing when pagination is exhausted without reaching the create event", () => {
        expect(
            historyEdge({
                reachedStart: false,
                hasOlder: false,
                loadingOlder: false,
            }),
        ).toBe("none");
    });

    it("prefers the start banner over a stale loading flag", () => {
        expect(
            historyEdge({
                reachedStart: true,
                hasOlder: true,
                loadingOlder: true,
            }),
        ).toBe("start");
    });
});

describe("hasRoomCreate", () => {
    it("finds m.room.create among timeline events", () => {
        expect(hasRoomCreate([ev("m.room.message"), ev("m.room.create")])).toBe(
            true,
        );
    });

    it("is false for a page that only holds messages", () => {
        expect(hasRoomCreate([ev("m.room.message")])).toBe(false);
    });
});

// Minimal stand-in for the SDK's linked timeline chain.
function fakeTimeline(
    events: { getType(): string }[],
    older: unknown = null,
): EventTimeline {
    return {
        getEvents: () => events,
        getNeighbouringTimeline: () => older,
    } as unknown as EventTimeline;
}

describe("timelineReachesRoomCreate", () => {
    it("is false when only the live timeline is loaded and has no create event", () => {
        const live = fakeTimeline([ev("m.room.message")]);
        expect(timelineReachesRoomCreate(live)).toBe(false);
    });

    it("finds the create event in an older linked timeline", () => {
        const older = fakeTimeline([ev("m.room.create"), ev("m.room.message")]);
        const live = fakeTimeline([ev("m.room.message")], older);
        expect(timelineReachesRoomCreate(live)).toBe(true);
    });
});
