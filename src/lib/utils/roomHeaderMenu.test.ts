import { describe, it, expect } from "vitest";
import { roomHeaderMenuRows, type RoomHeaderMenuInput } from "./roomHeaderMenu";

const base: RoomHeaderMenuInput = {
    activeSidebar: null,
    threadMentions: 0,
    threadAnyUnread: false,
    pinnedCount: 0,
};

describe("roomHeaderMenuRows", () => {
    it("returns the four overflowed panels in a stable order", () => {
        expect(roomHeaderMenuRows(base).map((r) => r.key)).toEqual([
            "threads",
            "pinned",
            "notifications",
            "members",
        ]);
    });

    it("gives every row a non-empty label", () => {
        for (const row of roomHeaderMenuRows(base)) {
            expect(row.label.length).toBeGreaterThan(0);
        }
    });

    it("shows a thread mention count as a badge", () => {
        const rows = roomHeaderMenuRows({ ...base, threadMentions: 3 });
        const threads = rows.find((r) => r.key === "threads")!;
        expect(threads.badge).toBe("3");
        expect(threads.dot).toBe(false);
    });

    it("caps the thread mention badge at 99+", () => {
        const rows = roomHeaderMenuRows({ ...base, threadMentions: 150 });
        expect(rows.find((r) => r.key === "threads")!.badge).toBe("99+");
    });

    it("falls back to a dot when threads are unread but unmentioned", () => {
        const rows = roomHeaderMenuRows({ ...base, threadAnyUnread: true });
        const threads = rows.find((r) => r.key === "threads")!;
        expect(threads.badge).toBeNull();
        expect(threads.dot).toBe(true);
    });

    it("shows neither badge nor dot when threads are fully read", () => {
        const threads = roomHeaderMenuRows(base).find(
            (r) => r.key === "threads",
        )!;
        expect(threads.badge).toBeNull();
        expect(threads.dot).toBe(false);
    });

    it("prefers the mention count over the unread dot", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: 2,
            threadAnyUnread: true,
        });
        const threads = rows.find((r) => r.key === "threads")!;
        expect(threads.badge).toBe("2");
        expect(threads.dot).toBe(false);
    });

    it("badges the pinned row with its count, capped at 99+", () => {
        const pinnedOf = (n: number) =>
            roomHeaderMenuRows({ ...base, pinnedCount: n }).find(
                (r) => r.key === "pinned",
            )!.badge;
        expect(pinnedOf(0)).toBeNull();
        expect(pinnedOf(7)).toBe("7");
        expect(pinnedOf(120)).toBe("99+");
    });

    it("marks only the open panel active", () => {
        const rows = roomHeaderMenuRows({ ...base, activeSidebar: "pinned" });
        expect(rows.filter((r) => r.active).map((r) => r.key)).toEqual([
            "pinned",
        ]);
    });

    it("marks nothing active for a panel that stays in the header", () => {
        const rows = roomHeaderMenuRows({ ...base, activeSidebar: "search" });
        expect(rows.some((r) => r.active)).toBe(false);
    });

    it("marks nothing active when no panel is open", () => {
        expect(roomHeaderMenuRows(base).some((r) => r.active)).toBe(false);
    });

    it("treats a negative count as no badge", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: -1,
            pinnedCount: -5,
        });
        expect(rows.find((r) => r.key === "threads")!.badge).toBeNull();
        expect(rows.find((r) => r.key === "pinned")!.badge).toBeNull();
    });

    it("floors a fractional count rather than rendering the fraction", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: 2.7,
            pinnedCount: 1.5,
        });
        expect(rows.find((r) => r.key === "threads")!.badge).toBe("2");
        expect(rows.find((r) => r.key === "pinned")!.badge).toBe("1");
    });

    it("treats a fraction below 1 as no badge", () => {
        const rows = roomHeaderMenuRows({ ...base, threadMentions: 0.4 });
        const threads = rows.find((r) => r.key === "threads")!;
        expect(threads.badge).toBeNull();
        expect(threads.dot).toBe(false);
    });

    it("treats NaN as no badge instead of rendering 'NaN'", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: Number.NaN,
            pinnedCount: Number.NaN,
        });
        expect(rows.find((r) => r.key === "threads")!.badge).toBeNull();
        expect(rows.find((r) => r.key === "pinned")!.badge).toBeNull();
    });

    it("treats an infinite count as no badge rather than capping it", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: Number.POSITIVE_INFINITY,
            pinnedCount: Number.NEGATIVE_INFINITY,
        });
        expect(rows.find((r) => r.key === "threads")!.badge).toBeNull();
        expect(rows.find((r) => r.key === "pinned")!.badge).toBeNull();
    });

    it("caps above 99, not at it", () => {
        const badgesFor = (n: number) => {
            const rows = roomHeaderMenuRows({
                ...base,
                threadMentions: n,
                pinnedCount: n,
            });
            return [
                rows.find((r) => r.key === "threads")!.badge,
                rows.find((r) => r.key === "pinned")!.badge,
            ];
        };
        expect(badgesFor(99)).toEqual(["99", "99"]);
        expect(badgesFor(100)).toEqual(["99+", "99+"]);
    });

    it("falls back to the unread dot when a NaN mention count is dropped", () => {
        const rows = roomHeaderMenuRows({
            ...base,
            threadMentions: Number.NaN,
            threadAnyUnread: true,
        });
        const threads = rows.find((r) => r.key === "threads")!;
        expect(threads.badge).toBeNull();
        expect(threads.dot).toBe(true);
    });
});
