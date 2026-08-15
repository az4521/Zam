import { describe, it, expect } from "vitest";
import { collectSpaceDescendantRoomIds } from "./spaceDescendants";

describe("collectSpaceDescendantRoomIds — flatten a space tree to its rooms", () => {
    const asGetter = (map: Record<string, string[]>) => (id: string) =>
        map[id] ?? [];

    it("collects direct rooms and rooms nested in sub-spaces", () => {
        const rooms = asGetter({
            "!root": ["!a", "!b"],
            "!sub1": ["!c"],
            "!sub2": ["!d"],
        });
        const subs = asGetter({ "!root": ["!sub1", "!sub2"] });
        expect(
            new Set(collectSpaceDescendantRoomIds("!root", rooms, subs)),
        ).toEqual(new Set(["!a", "!b", "!c", "!d"]));
    });

    it("dedupes a room reachable through two sub-spaces", () => {
        const rooms = asGetter({
            "!root": ["!a"],
            "!s1": ["!x"],
            "!s2": ["!x"],
        });
        const subs = asGetter({ "!root": ["!s1", "!s2"] });
        const out = collectSpaceDescendantRoomIds("!root", rooms, subs);
        expect(out.filter((x) => x === "!x")).toHaveLength(1);
        expect(new Set(out)).toEqual(new Set(["!a", "!x"]));
    });

    it("is cycle-safe when spaces list each other as children", () => {
        const rooms = asGetter({ "!a": ["!ra"], "!b": ["!rb"] });
        const subs = asGetter({ "!a": ["!b"], "!b": ["!a"] });
        expect(
            new Set(collectSpaceDescendantRoomIds("!a", rooms, subs)),
        ).toEqual(new Set(["!ra", "!rb"]));
    });

    it("returns empty for a space with no rooms or sub-spaces", () => {
        expect(
            collectSpaceDescendantRoomIds(
                "!empty",
                () => [],
                () => [],
            ),
        ).toEqual([]);
    });
});
