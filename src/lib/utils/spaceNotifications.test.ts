import { describe, it, expect } from "vitest";
import { collectSpaceAndDescendantRoomIds } from "./spaceNotifications";

// A tiny graph fixture: `rooms` = direct rooms per space, `spaces` = child
// space ids per space. Missing keys read as empty.
function makeAccessors(
    rooms: Record<string, string[]>,
    spaces: Record<string, string[]>,
) {
    return {
        roomsInSpace: (id: string) => rooms[id] ?? [],
        childSpaceIds: (id: string) => spaces[id] ?? [],
    };
}

describe("collectSpaceAndDescendantRoomIds", () => {
    it("returns just the space id when it has no rooms and no sub-spaces", () => {
        const acc = makeAccessors({}, {});
        expect(collectSpaceAndDescendantRoomIds("!s", acc)).toEqual(["!s"]);
    });

    it("includes the space id plus its direct rooms", () => {
        const acc = makeAccessors({ "!s": ["!a", "!b"] }, {});
        expect(collectSpaceAndDescendantRoomIds("!s", acc).sort()).toEqual(
            ["!a", "!b", "!s"].sort(),
        );
    });

    it("recurses into sub-spaces and includes their rooms, but not the sub-space container id", () => {
        const acc = makeAccessors(
            { "!top": ["!r1"], "!child": ["!r2"] },
            { "!top": ["!child"] },
        );
        const result = collectSpaceAndDescendantRoomIds("!top", acc);
        expect(result.sort()).toEqual(["!r1", "!r2", "!top"].sort());
        expect(result).not.toContain("!child");
    });

    it("dedupes a room reachable through two sub-spaces", () => {
        const acc = makeAccessors(
            { "!top": [], "!a": ["!shared"], "!b": ["!shared"] },
            { "!top": ["!a", "!b"] },
        );
        const result = collectSpaceAndDescendantRoomIds("!top", acc);
        expect(result.filter((id) => id === "!shared")).toHaveLength(1);
    });

    it("terminates on a cycle (space graph that references itself)", () => {
        const acc = makeAccessors(
            { "!a": ["!ra"], "!b": ["!rb"] },
            { "!a": ["!b"], "!b": ["!a"] },
        );
        const result = collectSpaceAndDescendantRoomIds("!a", acc);
        expect(result.sort()).toEqual(["!a", "!ra", "!rb"].sort());
    });
});
