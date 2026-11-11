import { describe, expect, it } from "vitest";
import {
    commetToLayout,
    elementToLayout,
    layoutToCommet,
} from "./spaceLayoutKeys";

describe("commetToLayout", () => {
    it("builds folders from group ids and sorts by order strings", () => {
        const layout = commetToLayout({
            spaces: {
                "!a": { order: "b" },
                "!b": { group: "g1", order: "2" },
                "!c": { group: "g1", order: "1" },
                "!d": { order: "d" },
            },
            groups: { g1: { order: "c" } },
        });
        expect(layout).toEqual({
            order: ["!a", "g1", "!d"],
            folders: { g1: { name: "", spaceIds: ["!c", "!b"] } },
        });
    });

    it("puts unordered entries last and tolerates junk", () => {
        const layout = commetToLayout({
            spaces: { "!a": {}, "!b": { order: "1" }, "!x": 5 },
        });
        expect(layout?.order).toEqual(["!b", "!a"]);
    });

    it("returns null when there is nothing usable", () => {
        expect(commetToLayout(undefined)).toBeNull();
        expect(commetToLayout({})).toBeNull();
        expect(commetToLayout({ spaces: {} })).toBeNull();
    });
});

describe("layoutToCommet", () => {
    const layout = {
        order: ["!a", "f1", "!b"],
        folders: {
            f1: { name: "Games", color: "#f00", spaceIds: ["!x", "!y"] },
        },
    };

    it("drops name and colour and round-trips the structure", () => {
        const out = layoutToCommet(layout);
        expect(JSON.stringify(out)).not.toContain("Games");
        expect(JSON.stringify(out)).not.toContain("#f00");
        expect(commetToLayout(out)).toEqual({
            order: ["!a", "f1", "!b"],
            folders: { f1: { name: "", spaceIds: ["!x", "!y"] } },
        });
    });

    it("keeps Commet's entries for spaces we do not place", () => {
        const out = layoutToCommet(layout, {
            spaces: { "!z": { order: "q" }, "!a": { group: "old" } },
        });
        expect(out.spaces?.["!z"]).toEqual({ order: "q" });
        expect(out.spaces?.["!a"]).toEqual({ order: "000000" });
    });

    it("omits groups when there are no folders", () => {
        expect(layoutToCommet({ order: ["!a"], folders: {} })).toEqual({
            spaces: { "!a": { order: "000000" } },
        });
    });
});

describe("elementToLayout", () => {
    it("orders by the string and skips spaces without one", () => {
        const orders = new Map<string, unknown>([
            ["!a", "m"],
            ["!b", "a"],
            ["!c", undefined],
            ["!d", ""],
        ]);
        expect(elementToLayout(orders)).toEqual({
            order: ["!b", "!a"],
            folders: {},
        });
    });

    it("returns null when no space is ordered", () => {
        expect(elementToLayout(new Map([["!a", undefined]]))).toBeNull();
    });
});
