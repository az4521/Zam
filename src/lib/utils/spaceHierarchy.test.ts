import { describe, it, expect } from "vitest";
import { extractSubspaceChildren } from "./spaceHierarchy";

const room = (
    roomId: string,
    childrenState?: Array<Record<string, unknown>>,
): Record<string, unknown> => ({
    room_id: roomId,
    ...(childrenState ? { children_state: childrenState } : {}),
});

const childEdge = (
    stateKey: string,
    via?: unknown,
): Record<string, unknown> => ({
    type: "m.space.child",
    state_key: stateKey,
    content: via === undefined ? {} : { via },
});

describe("extractSubspaceChildren", () => {
    it("collects the target entry's child ids and via servers", () => {
        const rooms = [
            room("!parent", [childEdge("!sub", ["a.org"])]),
            room("!sub", [
                childEdge("!pizza-general", ["a.org", "b.org"]),
                childEdge("!pizza-dev", ["a.org"]),
            ]),
            room("!pizza-general"),
            room("!pizza-dev"),
        ];
        const slice = extractSubspaceChildren(rooms, "!sub");
        expect(slice).not.toBeNull();
        expect([...slice!.childIds].sort()).toEqual([
            "!pizza-dev",
            "!pizza-general",
        ]);
        expect(slice!.viaMap.get("!pizza-general")).toEqual(["a.org", "b.org"]);
    });

    it("returns null when the target space is not in the response", () => {
        expect(
            extractSubspaceChildren([room("!parent", [])], "!missing"),
        ).toBeNull();
    });

    it("ignores non-child event types and edges without a state key", () => {
        const rooms = [
            room("!sub", [
                { type: "m.room.name", state_key: "!x", content: {} },
                { type: "m.space.child", content: { via: ["a.org"] } },
                childEdge("!ok"),
            ]),
        ];
        const slice = extractSubspaceChildren(rooms, "!sub");
        expect([...slice!.childIds]).toEqual(["!ok"]);
    });

    it("tolerates a missing or malformed children_state and via", () => {
        expect(
            extractSubspaceChildren([room("!sub")], "!sub")!.childIds.size,
        ).toBe(0);
        const slice = extractSubspaceChildren(
            [room("!sub", [childEdge("!weird", "not-an-array")])],
            "!sub",
        );
        expect([...slice!.childIds]).toEqual(["!weird"]);
        expect(slice!.viaMap.get("!weird")).toBeUndefined();
    });
});
