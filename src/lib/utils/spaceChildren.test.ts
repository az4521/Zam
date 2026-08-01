import { describe, it, expect } from "vitest";
import { sortSpaceChildIds, type SpaceChildDescriptor } from "./spaceChildren";

function child(
    partial: Partial<SpaceChildDescriptor> & { stateKey: string },
): SpaceChildDescriptor {
    return {
        via: ["example.org"],
        order: undefined,
        ts: 0,
        ...partial,
    };
}

describe("sortSpaceChildIds", () => {
    it("drops children with no via servers", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!a:s" }),
                child({ stateKey: "!b:s", via: [] }),
                child({ stateKey: "!c:s", via: undefined }),
            ]),
        ).toEqual(["!a:s"]);
    });

    it("keeps a child whose via is malformed but non-empty, as master does", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!a:s", via: "example.org" as unknown }),
                child({ stateKey: "!b:s", via: "" as unknown }),
            ]),
        ).toEqual(["!a:s"]);
    });

    it("orders by the lexicographic order field first", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!b:s", order: "20" }),
                child({ stateKey: "!a:s", order: "10" }),
            ]),
        ).toEqual(["!a:s", "!b:s"]);
    });

    it("falls back to origin_server_ts ascending when order ties", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!late:s", ts: 200 }),
                child({ stateKey: "!early:s", ts: 100 }),
            ]),
        ).toEqual(["!early:s", "!late:s"]);
    });

    it("falls back to state key when order and ts both tie", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!b:s", ts: 5 }),
                child({ stateKey: "!a:s", ts: 5 }),
            ]),
        ).toEqual(["!a:s", "!b:s"]);
    });

    it("drops empty state keys", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "" }),
                child({ stateKey: "!a:s" }),
            ]),
        ).toEqual(["!a:s"]);
    });

    it("returns an empty array for no children", () => {
        expect(sortSpaceChildIds([])).toEqual([]);
    });

    // The four tests below deliberately point the state-key fallback the OTHER
    // way from the expected result, so each tie-break level is pinned on its
    // own. Without them, dropping a whole comparator level still passed: the
    // fixtures above happen to agree with the state-key fallback.
    it("lets the order field beat the state-key fallback", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!z:s", order: "10" }),
                child({ stateKey: "!a:s", order: "20" }),
            ]),
        ).toEqual(["!z:s", "!a:s"]);
    });

    it("lets the order field beat origin_server_ts", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!x:s", order: "20", ts: 1 }),
                child({ stateKey: "!y:s", order: "10", ts: 9 }),
            ]),
        ).toEqual(["!y:s", "!x:s"]);
    });

    it("sorts a child with no order after one that has an order", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!a:s", order: undefined, ts: 0 }),
                child({ stateKey: "!b:s", order: "10", ts: 5 }),
            ]),
        ).toEqual(["!b:s", "!a:s"]);
    });

    it("lets origin_server_ts beat the state-key fallback", () => {
        expect(
            sortSpaceChildIds([
                child({ stateKey: "!z:s", ts: 100 }),
                child({ stateKey: "!a:s", ts: 200 }),
            ]),
        ).toEqual(["!z:s", "!a:s"]);
    });
});
