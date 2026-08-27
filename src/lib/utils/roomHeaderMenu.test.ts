import { describe, it, expect } from "vitest";
import { roomHeaderMenuRows, type RoomHeaderMenuInput } from "./roomHeaderMenu";

const base: RoomHeaderMenuInput = {
    activeSidebar: null,
    threadMentions: 0,
    threadAnyUnread: false,
    pinnedCount: 0,
};

describe("roomHeaderMenuRows", () => {
    it("returns the five overflowed panels in a stable order", () => {
        expect(roomHeaderMenuRows(base).map((r) => r.key)).toEqual([
            "threads",
            "pinned",
            "notifications",
            "media",
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

import {
    pluginHeaderKey,
    pluginHeaderButtons,
    pluginHeaderMenuRows,
} from "./roomHeaderMenu";
import type { RegistryEntry } from "$lib/plugins/registry";
import type { HeaderButton } from "$lib/plugins/types";

const entry = (
    pluginId: string,
    id: string,
    label: string,
): RegistryEntry<HeaderButton> => ({
    pluginId,
    entryId: 1,
    value: { id, label, icon: "M0 0h1v1H0z", render: () => {} },
});

describe("pluginHeaderKey", () => {
    it("namespaces by plugin id", () => {
        expect(pluginHeaderKey("com.acme", "panel")).toBe(
            "plugin:com.acme:panel",
        );
    });
});

describe("pluginHeaderButtons", () => {
    it("maps entries to views preserving order + carrying icon/render", () => {
        const views = pluginHeaderButtons([
            entry("a", "one", "One"),
            entry("b", "two", "Two"),
        ]);
        expect(views.map((v) => [v.key, v.label])).toEqual([
            ["plugin:a:one", "One"],
            ["plugin:b:two", "Two"],
        ]);
        expect(views[0].icon).toBe("M0 0h1v1H0z");
        expect(typeof views[0].render).toBe("function");
    });
    it("dedupes a repeated plugin+id (first wins)", () => {
        const views = pluginHeaderButtons([
            entry("a", "one", "First"),
            entry("a", "one", "Second"),
        ]);
        expect(views).toHaveLength(1);
        expect(views[0].label).toBe("First");
    });
});

describe("pluginHeaderMenuRows", () => {
    it("marks the active row", () => {
        const rows = pluginHeaderMenuRows(
            [
                { key: "plugin:a:one", label: "One" },
                { key: "plugin:b:two", label: "Two" },
            ],
            "plugin:b:two",
        );
        expect(rows.map((r) => r.active)).toEqual([false, true]);
    });
    it("none active when activeKey is null", () => {
        const rows = pluginHeaderMenuRows([{ key: "k", label: "L" }], null);
        expect(rows[0].active).toBe(false);
    });
});
