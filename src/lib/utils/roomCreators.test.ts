import { describe, it, expect } from "vitest";
import {
    normalizeAdditionalCreators,
    pickCreatorRoomVersion,
} from "./roomCreators";

const self = "@me:matrix.crafty.moe";
const alice = "@alice:matrix.crafty.moe";
const bob = "@bob:example.org";

describe("normalizeAdditionalCreators", () => {
    it("keeps valid ids in first-seen order", () => {
        expect(normalizeAdditionalCreators([alice, bob], self)).toEqual([
            alice,
            bob,
        ]);
    });

    it("drops the caller", () => {
        expect(normalizeAdditionalCreators([self, alice], self)).toEqual([
            alice,
        ]);
    });

    it("drops duplicates", () => {
        expect(normalizeAdditionalCreators([alice, bob, alice], self)).toEqual([
            alice,
            bob,
        ]);
    });

    it("drops malformed ids", () => {
        expect(
            normalizeAdditionalCreators(
                ["alice", "@nocolon", "@a b:c", "", "#room:x", alice],
                self,
            ),
        ).toEqual([alice]);
    });

    it("trims surrounding whitespace before validating", () => {
        expect(normalizeAdditionalCreators([`  ${alice} `], self)).toEqual([
            alice,
        ]);
    });

    it("accepts a port in the server name", () => {
        expect(
            normalizeAdditionalCreators(["@a:example.org:8448"], self),
        ).toEqual(["@a:example.org:8448"]);
    });

    it("does not drop anything when there is no self id", () => {
        expect(normalizeAdditionalCreators([alice], null)).toEqual([alice]);
    });

    it("returns an empty list for empty input", () => {
        expect(normalizeAdditionalCreators([], self)).toEqual([]);
    });
});

describe("pickCreatorRoomVersion", () => {
    it("picks the highest advertised numeric version >= 12", () => {
        expect(
            pickCreatorRoomVersion({
                default: "11",
                available: ["10", "11", "12", "13"],
            }),
        ).toBe("13");
    });

    it("ignores versions below 12", () => {
        expect(
            pickCreatorRoomVersion({
                default: "11",
                available: ["9", "10", "11"],
            }),
        ).toBeUndefined();
    });

    it("ignores non-numeric ids when picking from the available list", () => {
        expect(
            pickCreatorRoomVersion({
                default: "",
                available: ["org.matrix.hydra.11", "12"],
            }),
        ).toBe("12");
    });

    it("falls back to the server default when it has immutable creators", () => {
        expect(pickCreatorRoomVersion({ default: "12", available: [] })).toBe(
            "12",
        );
    });

    it("falls back to a hydra default", () => {
        expect(
            pickCreatorRoomVersion({
                default: "org.matrix.hydra.11",
                available: [],
            }),
        ).toBe("org.matrix.hydra.11");
    });

    it("returns undefined when neither available nor default supports creators", () => {
        expect(
            pickCreatorRoomVersion({ default: "10", available: ["10", "11"] }),
        ).toBeUndefined();
    });

    it("returns undefined when nothing is advertised", () => {
        expect(
            pickCreatorRoomVersion({ default: "", available: [] }),
        ).toBeUndefined();
    });
});
