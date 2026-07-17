import { describe, it, expect } from "vitest";
import { sanitizeCustomization } from "./customization";

describe("sanitizeCustomization", () => {
    it("keeps known keys with the right primitive type", () => {
        expect(
            sanitizeCustomization({
                theme: "light",
                alwaysAbsolute: true,
                doubleTapReaction: "🔥",
            }),
        ).toEqual({
            theme: "light",
            alwaysAbsolute: true,
            doubleTapReaction: "🔥",
        });
    });

    it("drops unknown keys and wrongly-typed values", () => {
        expect(
            sanitizeCustomization({
                theme: 42,
                alwaysAbsolute: "yes",
                somethingElse: "hi",
            }),
        ).toEqual({});
    });

    it("omits absent keys rather than emitting undefined", () => {
        const out = sanitizeCustomization({ theme: "dark" });
        expect(Object.keys(out)).toEqual(["theme"]);
    });

    it("filters the per-space reaction map to non-empty strings", () => {
        expect(
            sanitizeCustomization({
                doubleTapReactionBySpace: { a: "👍", b: "", c: 3, d: "🎉" },
            }),
        ).toEqual({ doubleTapReactionBySpace: { a: "👍", d: "🎉" } });
    });

    it("rejects a non-object map, including an array", () => {
        expect(
            sanitizeCustomization({ doubleTapReactionBySpace: ["👍"] }),
        ).toEqual({});
    });

    it("survives junk input", () => {
        expect(sanitizeCustomization(null)).toEqual({});
        expect(sanitizeCustomization("nope")).toEqual({});
        expect(sanitizeCustomization(undefined)).toEqual({});
    });

    it("round-trips a full payload unchanged, so the echo guard can compare by value", () => {
        const full = {
            theme: "dark",
            timeClock: "24h",
            dateStyle: "iso",
            customDatePattern: "yyyy-MM-dd",
            alwaysAbsolute: false,
            gifDefaultTab: "favourites",
            keepSidebarOpen: true,
            ownDoubleTapAction: "reaction",
            otherDoubleTapAction: "none",
            doubleTapReaction: "👍",
            doubleTapReactionBySpace: { "!s:x": "🎉" },
        };
        expect(JSON.stringify(sanitizeCustomization(full))).toBe(
            JSON.stringify(full),
        );
    });
});
