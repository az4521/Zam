import { describe, it, expect } from "vitest";
import { receiptTypeForSetting, orderReadReceipts } from "./readReceipts";

describe("receiptTypeForSetting — pick the read-receipt wire type", () => {
    it("sends public m.read receipts by default", () => {
        expect(receiptTypeForSetting(false)).toBe("m.read");
    });

    it("sends m.read.private when private read receipts are enabled", () => {
        expect(receiptTypeForSetting(true)).toBe("m.read.private");
    });
});

describe("orderReadReceipts — self-exclusion, dedupe, ts-descending order, cap, overflow", () => {
    it("returns empty shown and zero overflow for no receipts", () => {
        expect(orderReadReceipts([], "@me:hs")).toEqual({
            shown: [],
            overflow: 0,
        });
    });

    it("excludes the own user even if present in the list", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@me:hs", ts: 200 },
            { userId: "@b:hs", ts: 300 },
        ];
        const result = orderReadReceipts(receipts, "@me:hs");
        expect(result.shown).toHaveLength(2);
        expect(result.shown.every((r) => r.userId !== "@me:hs")).toBe(true);
    });

    it("dedupes by userId, keeping the entry with the LATEST ts", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@a:hs", ts: 300 },
            { userId: "@a:hs", ts: 200 },
        ];
        const result = orderReadReceipts(receipts, null);
        expect(result.shown).toHaveLength(1);
        expect(result.shown[0].ts).toBe(300);
    });

    it("sorts by ts descending (most recent first)", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@b:hs", ts: 300 },
            { userId: "@c:hs", ts: 200 },
        ];
        const result = orderReadReceipts(receipts, null);
        expect(result.shown.map((r) => r.userId)).toEqual([
            "@b:hs",
            "@c:hs",
            "@a:hs",
        ]);
    });

    it("tie-breaks equal ts by userId ascending for determinism", () => {
        const receipts = [
            { userId: "@c:hs", ts: 100 },
            { userId: "@a:hs", ts: 100 },
            { userId: "@b:hs", ts: 100 },
        ];
        const result = orderReadReceipts(receipts, null);
        expect(result.shown.map((r) => r.userId)).toEqual([
            "@a:hs",
            "@b:hs",
            "@c:hs",
        ]);
    });

    it("caps shown at 3 with 5 entries, reports overflow 2", () => {
        const receipts = [
            { userId: "@a:hs", ts: 500 },
            { userId: "@b:hs", ts: 400 },
            { userId: "@c:hs", ts: 300 },
            { userId: "@d:hs", ts: 200 },
            { userId: "@e:hs", ts: 100 },
        ];
        const result = orderReadReceipts(receipts, null, 3);
        expect(result.shown).toHaveLength(3);
        expect(result.shown.map((r) => r.userId)).toEqual([
            "@a:hs",
            "@b:hs",
            "@c:hs",
        ]);
        expect(result.overflow).toBe(2);
    });

    it("reports zero overflow at exactly the cap", () => {
        const receipts = [
            { userId: "@a:hs", ts: 300 },
            { userId: "@b:hs", ts: 200 },
            { userId: "@c:hs", ts: 100 },
        ];
        const result = orderReadReceipts(receipts, null, 3);
        expect(result.overflow).toBe(0);
    });

    it("handles cap 2 (mobile) case", () => {
        const receipts = [
            { userId: "@a:hs", ts: 400 },
            { userId: "@b:hs", ts: 300 },
            { userId: "@c:hs", ts: 200 },
            { userId: "@d:hs", ts: 100 },
        ];
        const result = orderReadReceipts(receipts, null, 2);
        expect(result.shown).toHaveLength(2);
        expect(result.shown.map((r) => r.userId)).toEqual(["@a:hs", "@b:hs"]);
        expect(result.overflow).toBe(2);
    });

    it("excludes nobody when ownUserId is null", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@b:hs", ts: 200 },
        ];
        const result = orderReadReceipts(receipts, null);
        expect(result.shown).toHaveLength(2);
    });

    it("handles cap 0 (shown empty, overflow equals total)", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@b:hs", ts: 200 },
            { userId: "@c:hs", ts: 300 },
        ];
        const result = orderReadReceipts(receipts, null, 0);
        expect(result.shown).toHaveLength(0);
        expect(result.overflow).toBe(3);
    });

    it("preserves extra fields in the generic type", () => {
        const receipts = [
            { userId: "@a:hs", ts: 200, name: "Alice", avatar: "av1" },
            { userId: "@b:hs", ts: 100, name: "Bob", avatar: "av2" },
        ];
        const result = orderReadReceipts(receipts, null);
        expect(result.shown[0]).toEqual({
            userId: "@a:hs",
            ts: 200,
            name: "Alice",
            avatar: "av1",
        });
        expect(result.shown[1]).toEqual({
            userId: "@b:hs",
            ts: 100,
            name: "Bob",
            avatar: "av2",
        });
    });

    it("handles combined: self-exclusion + dedupe + sort + cap", () => {
        const receipts = [
            { userId: "@a:hs", ts: 100 },
            { userId: "@me:hs", ts: 400 },
            { userId: "@a:hs", ts: 300 },
            { userId: "@b:hs", ts: 200 },
            { userId: "@c:hs", ts: 500 },
        ];
        const result = orderReadReceipts(receipts, "@me:hs", 2);
        // After self-exclusion: @a (latest 300), @b (200), @c (500)
        // After ts-descending sort: @c (500), @a (300), @b (200)
        // Cap 2: shown = [@c, @a], overflow = 1
        expect(result.shown.map((r) => r.userId)).toEqual(["@c:hs", "@a:hs"]);
        expect(result.overflow).toBe(1);
    });
});
