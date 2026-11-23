import { describe, it, expect } from "vitest";
import {
    collectSpaceDescendantRoomIds,
    joinedSpaceDescendants,
    type NicknameWalkNode,
} from "./spaceDescendants";

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

describe("joinedSpaceDescendants — joined rooms and sub-spaces for a nickname", () => {
    const node = (childIds: string[], joined = true): NicknameWalkNode => ({
        childIds,
        joined,
    });
    const graph = (map: Record<string, NicknameWalkNode>) => (id: string) =>
        map[id] ?? null;

    it("returns joined rooms and nested sub-spaces, excluding the root", () => {
        const lookup = graph({
            "!root": node(["!a", "!sub"]),
            "!a": node([]),
            "!sub": node(["!b"]),
            "!b": node([]),
        });
        expect(joinedSpaceDescendants("!root", lookup)).toEqual([
            "!a",
            "!sub",
            "!b",
        ]);
    });

    it("is depth-first in child order", () => {
        const lookup = graph({
            "!root": node(["!s1", "!r"]),
            "!s1": node(["!x", "!y"]),
            "!x": node([]),
            "!y": node([]),
            "!r": node([]),
        });
        expect(joinedSpaceDescendants("!root", lookup)).toEqual([
            "!s1",
            "!x",
            "!y",
            "!r",
        ]);
    });

    it("skips unjoined children and does not walk into them", () => {
        const lookup = graph({
            "!root": node(["!left", "!joinedRoom"]),
            "!left": node(["!hidden"], false),
            "!hidden": node([]),
            "!joinedRoom": node([]),
        });
        expect(joinedSpaceDescendants("!root", lookup)).toEqual([
            "!joinedRoom",
        ]);
    });

    it("skips children the lookup cannot resolve", () => {
        const lookup = graph({
            "!root": node(["!missing", "!ok"]),
            "!ok": node([]),
        });
        expect(joinedSpaceDescendants("!root", lookup)).toEqual(["!ok"]);
    });

    it("returns nothing when the root itself is missing", () => {
        expect(joinedSpaceDescendants("!gone", () => null)).toEqual([]);
    });

    it("is cycle-safe and never returns the root", () => {
        const lookup = graph({
            "!root": node(["!a"]),
            "!a": node(["!root", "!b"]),
            "!b": node(["!a"]),
        });
        expect(joinedSpaceDescendants("!root", lookup)).toEqual(["!a", "!b"]);
    });

    it("dedupes a room reachable through two sub-spaces", () => {
        const lookup = graph({
            "!root": node(["!s1", "!s2"]),
            "!s1": node(["!x"]),
            "!s2": node(["!x"]),
            "!x": node([]),
        });
        const out = joinedSpaceDescendants("!root", lookup);
        expect(out.filter((id) => id === "!x")).toHaveLength(1);
        expect(new Set(out)).toEqual(new Set(["!s1", "!s2", "!x"]));
    });
});
