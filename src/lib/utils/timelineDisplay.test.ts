import { describe, it, expect } from "vitest";
import {
    shouldShowHeader,
    dateSeparatorLabel,
    unreadDividerBefore,
    isNearBottom,
} from "./timelineDisplay";

// Minimal structural stand-in for a MatrixEvent in chronological lists.
function ev(id: string, sender: string, ts: number) {
    return {
        getId: () => id,
        getSender: () => sender,
        getTs: () => ts,
    };
}

const MIN = 60_000;

describe("shouldShowHeader (chronological order)", () => {
    it("shows a header for the first message", () => {
        const events = [ev("$a", "@alice:hs", 1000)];
        expect(shouldShowHeader(events, 0)).toBe(true);
    });

    it("hides the header for a quick follow-up from the same sender", () => {
        const events = [
            ev("$a", "@alice:hs", 1000),
            ev("$b", "@alice:hs", 1000 + 2 * MIN),
        ];
        expect(shouldShowHeader(events, 1)).toBe(false);
    });

    it("shows a header when the sender changes", () => {
        const events = [
            ev("$a", "@alice:hs", 1000),
            ev("$b", "@bob:hs", 1000 + MIN),
        ];
        expect(shouldShowHeader(events, 1)).toBe(true);
    });

    it("shows a header after more than five minutes of silence", () => {
        const events = [
            ev("$a", "@alice:hs", 1000),
            ev("$b", "@alice:hs", 1000 + 6 * MIN),
        ];
        expect(shouldShowHeader(events, 1)).toBe(true);
    });

    it("hides the header at exactly five minutes", () => {
        const events = [
            ev("$a", "@alice:hs", 1000),
            ev("$b", "@alice:hs", 1000 + 5 * MIN),
        ];
        expect(shouldShowHeader(events, 1)).toBe(false);
    });
});

describe("dateSeparatorLabel — boundary ts or null (formatting lives in timeFormat)", () => {
    // Local-time components so same-day comparison is timezone-stable.
    const dayA = new Date(2026, 6, 3, 10, 0).getTime();
    const dayB = new Date(2026, 6, 10, 10, 0).getTime();

    it("returns the first loaded message's ts", () => {
        const events = [ev("$a", "@alice:hs", dayA)];
        expect(dateSeparatorLabel(events, 0)).toBe(dayA);
    });

    it("returns null between two messages on the same day", () => {
        const events = [
            ev("$a", "@alice:hs", dayA),
            ev("$b", "@alice:hs", dayA + MIN),
        ];
        expect(dateSeparatorLabel(events, 1)).toBeNull();
    });

    it("returns the current message's ts at a day boundary", () => {
        const events = [ev("$a", "@alice:hs", dayA), ev("$b", "@bob:hs", dayB)];
        expect(dateSeparatorLabel(events, 1)).toBe(dayB);
    });
});

describe("unreadDividerBefore", () => {
    const events = [
        ev("$read1", "@alice:hs", 1000),
        ev("$read2", "@bob:hs", 2000),
        ev("$unread1", "@alice:hs", 3000),
        ev("$unread2", "@bob:hs", 4000),
    ];

    it("places the divider directly before the first unread message", () => {
        expect(unreadDividerBefore(events, 2, "$read2")).toBe(true);
    });

    it("does not place the divider anywhere else", () => {
        expect(unreadDividerBefore(events, 0, "$read2")).toBe(false);
        expect(unreadDividerBefore(events, 1, "$read2")).toBe(false);
        expect(unreadDividerBefore(events, 3, "$read2")).toBe(false);
    });

    it("places no divider when the read marker is not in the loaded window", () => {
        for (let i = 0; i < events.length; i++) {
            expect(unreadDividerBefore(events, i, "$elsewhere")).toBe(false);
        }
    });

    it("places no divider without a read marker", () => {
        for (let i = 0; i < events.length; i++) {
            expect(unreadDividerBefore(events, i, null)).toBe(false);
        }
    });
});

describe("isNearBottom", () => {
    it("is true at the exact bottom", () => {
        expect(isNearBottom(900, 100, 1000)).toBe(true);
    });

    it("is true within the slack distance", () => {
        expect(isNearBottom(801, 100, 1000)).toBe(true);
    });

    it("is false beyond the slack distance", () => {
        expect(isNearBottom(750, 100, 1000)).toBe(false);
    });

    it("is true when the content does not fill the viewport", () => {
        expect(isNearBottom(0, 500, 300)).toBe(true);
    });
});
