import { describe, it, expect } from "vitest";
import { localReadVerdict, type LocalReadMark } from "./localRead";

const mark: LocalReadMark = { total: 3, highlight: 1, ts: 1000 };

describe("localReadVerdict", () => {
    it("suppresses stale counts that match the mark and no newer message exists", () => {
        expect(localReadVerdict(mark, { total: 3, highlight: 1 }, null)).toBe(
            "suppress",
        );
    });

    it("suppresses when the newest other notification is older than the mark", () => {
        expect(localReadVerdict(mark, { total: 3, highlight: 1 }, 999)).toBe(
            "suppress",
        );
    });

    it("suppresses when the newest other notification is exactly the mark timestamp", () => {
        expect(localReadVerdict(mark, { total: 3, highlight: 1 }, 1000)).toBe(
            "suppress",
        );
    });

    it("settles when both counts are zero, even if they match the mark", () => {
        const zeroMark: LocalReadMark = { total: 0, highlight: 0, ts: 1000 };
        expect(
            localReadVerdict(zeroMark, { total: 0, highlight: 0 }, null),
        ).toBe("settled");
    });

    it("settles when the total count changed", () => {
        expect(localReadVerdict(mark, { total: 2, highlight: 1 }, null)).toBe(
            "settled",
        );
        expect(localReadVerdict(mark, { total: 4, highlight: 1 }, null)).toBe(
            "settled",
        );
    });

    it("settles when the highlight count changed", () => {
        expect(localReadVerdict(mark, { total: 3, highlight: 0 }, null)).toBe(
            "settled",
        );
        expect(localReadVerdict(mark, { total: 3, highlight: 2 }, null)).toBe(
            "settled",
        );
    });

    it("settles when a newer other notification arrived after the mark", () => {
        expect(localReadVerdict(mark, { total: 3, highlight: 1 }, 1001)).toBe(
            "settled",
        );
    });
});
