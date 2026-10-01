import { describe, it, expect } from "vitest";
import { nestedSpaceIds, topLevelSpaceOf } from "./spaceTree";

function graph(children: Record<string, string[]>) {
    const childIdsOf = (id: string) => children[id] ?? [];
    const parentsOf = (id: string) =>
        Object.keys(children).filter((p) => children[p].includes(id));
    return { childIdsOf, parentsOf };
}

describe("nestedSpaceIds", () => {
    it("marks joined descendants of top-level spaces", () => {
        const g = graph({ a: ["b", "room1"], b: ["c"], c: [], d: [] });
        expect(nestedSpaceIds(["a", "b", "c", "d"], g.childIdsOf)).toEqual(
            new Set(["b", "c"]),
        );
    });

    it("keeps a joined child whose parent is not joined top-level", () => {
        // `x` (unjoined) parents `b`: b has no joined parent, so it is top-level
        const g = graph({ x: ["b"], b: [] });
        expect(nestedSpaceIds(["b"], g.childIdsOf)).toEqual(new Set());
    });

    it("leaves a pure cycle on the rail", () => {
        const g = graph({ a: ["b"], b: ["a"] });
        expect(nestedSpaceIds(["a", "b"], g.childIdsOf)).toEqual(new Set());
    });

    it("handles a cycle below a top-level space", () => {
        const g = graph({ top: ["a"], a: ["b"], b: ["a"] });
        expect(nestedSpaceIds(["top", "a", "b"], g.childIdsOf)).toEqual(
            new Set(["a", "b"]),
        );
    });
});

describe("topLevelSpaceOf", () => {
    it("walks up to the top-level ancestor", () => {
        const g = graph({ a: ["b"], b: ["c"], c: [] });
        const nested = nestedSpaceIds(["a", "b", "c"], g.childIdsOf);
        expect(topLevelSpaceOf("c", g.parentsOf, nested)).toBe("a");
        expect(topLevelSpaceOf("a", g.parentsOf, nested)).toBe("a");
    });
});
