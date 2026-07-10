import { describe, it, expect } from "vitest";
import {
    addIgnoredUser,
    removeIgnoredUser,
    shouldHideMessage,
} from "./ignoredUsers";

describe("addIgnoredUser — add a user id to the ignore list", () => {
    it("appends a new user id", () => {
        expect(addIgnoredUser(["@a:hs"], "@b:hs")).toEqual(["@a:hs", "@b:hs"]);
    });

    it("works on an empty list", () => {
        expect(addIgnoredUser([], "@a:hs")).toEqual(["@a:hs"]);
    });

    it("does not duplicate an already-ignored user", () => {
        expect(addIgnoredUser(["@a:hs", "@b:hs"], "@a:hs")).toEqual([
            "@a:hs",
            "@b:hs",
        ]);
    });

    it("does not mutate the input list", () => {
        const list = ["@a:hs"];
        addIgnoredUser(list, "@b:hs");
        expect(list).toEqual(["@a:hs"]);
    });
});

describe("removeIgnoredUser — remove a user id from the ignore list", () => {
    it("removes the user id", () => {
        expect(removeIgnoredUser(["@a:hs", "@b:hs"], "@a:hs")).toEqual([
            "@b:hs",
        ]);
    });

    it("is a no-op when the user is not in the list", () => {
        expect(removeIgnoredUser(["@a:hs"], "@b:hs")).toEqual(["@a:hs"]);
    });

    it("does not mutate the input list", () => {
        const list = ["@a:hs", "@b:hs"];
        removeIgnoredUser(list, "@a:hs");
        expect(list).toEqual(["@a:hs", "@b:hs"]);
    });

    it("round-trips: add then remove restores the original list", () => {
        const original = ["@a:hs"];
        const added = addIgnoredUser(original, "@b:hs");
        expect(removeIgnoredUser(added, "@b:hs")).toEqual(original);
    });
});

describe("shouldHideMessage — timeline filter predicate", () => {
    const ignored = ["@troll:hs", "@spammer:hs"];

    it("hides a message from an ignored sender", () => {
        expect(shouldHideMessage("@troll:hs", ignored, "@me:hs")).toBe(true);
    });

    it("shows a message from a non-ignored sender", () => {
        expect(shouldHideMessage("@friend:hs", ignored, "@me:hs")).toBe(false);
    });

    it("never hides the user's own messages, even if self is in the list", () => {
        expect(shouldHideMessage("@me:hs", ["@me:hs"], "@me:hs")).toBe(false);
    });

    it("shows events with no sender (sender unknown → nothing to match)", () => {
        expect(shouldHideMessage(undefined, ignored, "@me:hs")).toBe(false);
        expect(shouldHideMessage(null, ignored, "@me:hs")).toBe(false);
    });

    it("shows everything when the ignore list is empty", () => {
        expect(shouldHideMessage("@troll:hs", [], "@me:hs")).toBe(false);
    });

    it("still hides ignored senders when own user id is unknown", () => {
        expect(shouldHideMessage("@troll:hs", ignored, null)).toBe(true);
    });
});
