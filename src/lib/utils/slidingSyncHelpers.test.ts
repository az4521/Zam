import { describe, it, expect } from "vitest";
import {
    isSlidingSyncUnsupportedError,
    isSlidingTimelineGap,
    shouldKickSync,
    nextWindowEnd,
} from "./slidingSyncHelpers";

describe("nextWindowEnd", () => {
    it("grows by one step", () => {
        expect(nextWindowEnd(29, 1000, 100)).toBe(129);
    });

    it("clamps to the last index", () => {
        expect(nextWindowEnd(129, 150, 100)).toBe(149);
    });

    it("stops once the window covers every room", () => {
        expect(nextWindowEnd(149, 150, 100)).toBeNull();
        expect(nextWindowEnd(500, 150, 100)).toBeNull();
    });

    it("does nothing before the server has reported a total", () => {
        expect(nextWindowEnd(29, 0, 100)).toBeNull();
        expect(nextWindowEnd(undefined, 500, 100)).toBeNull();
    });
});

describe("isSlidingSyncUnsupportedError", () => {
    it("treats missing-endpoint responses as unsupported", () => {
        expect(isSlidingSyncUnsupportedError({ httpStatus: 404 })).toBe(true);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 405 })).toBe(true);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 501 })).toBe(true);
        expect(
            isSlidingSyncUnsupportedError({ errcode: "M_UNRECOGNIZED" }),
        ).toBe(true);
    });

    it("does not treat transient or auth failures as unsupported", () => {
        expect(isSlidingSyncUnsupportedError({ httpStatus: 500 })).toBe(false);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 429 })).toBe(false);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 401 })).toBe(false);
        expect(isSlidingSyncUnsupportedError(new Error("network"))).toBe(false);
        expect(isSlidingSyncUnsupportedError(null)).toBe(false);
    });
});

describe("isSlidingTimelineGap", () => {
    const liveIds = new Set(["$a", "$b", "$c"]);
    const live = {
        liveIsEmpty: false,
        isKnown: (id: string) => liveIds.has(id),
    };

    it("is a gap when a limited update shares nothing with the room", () => {
        // Room-list update (timeline_limit 1) after several new messages.
        expect(
            isSlidingTimelineGap(
                { limited: true, timelineEventIds: ["$f"] },
                live,
            ),
        ).toBe(true);
    });

    it("is not a gap when the update overlaps the timeline", () => {
        expect(
            isSlidingTimelineGap(
                { limited: true, timelineEventIds: ["$c", "$d", "$e"] },
                live,
            ),
        ).toBe(false);
    });

    it("is not a gap when the events are known outside the live timeline", () => {
        // A notification tap loaded the newest messages into a context
        // timeline (or they are thread replies) before sync delivered them.
        const elsewhere = new Set(["$f", "$g"]);
        expect(
            isSlidingTimelineGap(
                { limited: true, timelineEventIds: ["$f", "$g"] },
                {
                    liveIsEmpty: false,
                    isKnown: (id) => liveIds.has(id) || elsewhere.has(id),
                },
            ),
        ).toBe(false);
    });

    it("is never a gap when the update is not limited", () => {
        expect(
            isSlidingTimelineGap(
                { limited: false, timelineEventIds: ["$d"] },
                live,
            ),
        ).toBe(false);
        expect(isSlidingTimelineGap({ timelineEventIds: ["$d"] }, live)).toBe(
            false,
        );
    });

    it("needs events on both sides", () => {
        expect(
            isSlidingTimelineGap({ limited: true, timelineEventIds: [] }, live),
        ).toBe(false);
        expect(
            isSlidingTimelineGap(
                { limited: true, timelineEventIds: ["$d"] },
                { liveIsEmpty: true, isKnown: () => false },
            ),
        ).toBe(false);
    });
});

describe("shouldKickSync", () => {
    it("always restarts when the browser comes back online", () => {
        expect(shouldKickSync("online", 1_000)).toBe(true);
    });

    it("restarts after the app was hidden for a while", () => {
        // A notification tap after the app sat in the background.
        expect(shouldKickSync("visible", 2_000, 60_000)).toBe(true);
        // Flicking away and straight back doesn't disturb a healthy poll.
        expect(shouldKickSync("visible", 2_000, 1_000)).toBe(false);
        // ...unless sync was already overdue.
        expect(shouldKickSync("visible", 90_000, 1_000)).toBe(true);
    });

    it("watchdog only fires once a response is well overdue", () => {
        expect(shouldKickSync("watchdog", 30_000)).toBe(false);
        expect(shouldKickSync("watchdog", 44_000)).toBe(false);
        expect(shouldKickSync("watchdog", 46_000)).toBe(true);
    });
});
