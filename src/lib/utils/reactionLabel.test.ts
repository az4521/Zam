import { describe, it, expect } from "vitest";
import {
    REACTION_SHORTCODE_KEY,
    normalizeReactionShortcode,
    reactionDisplayName,
    reactionShortcodeFromContent,
    resolveReactionShortcode,
} from "./reactionLabel";

const MXC = "mxc://hs.example/blobcat123";
const packs = [
    { shortcode: "other", mxcUrl: "mxc://hs.example/other" },
    { shortcode: "blobcat", mxcUrl: MXC },
];

describe("normalizeReactionShortcode", () => {
    it("strips colons and accepts plain names", () => {
        expect(normalizeReactionShortcode(":blobcat:")).toBe("blobcat");
        expect(normalizeReactionShortcode("blob_cat-2")).toBe("blob_cat-2");
    });

    it("rejects missing, non-string, empty or unsafe names", () => {
        expect(normalizeReactionShortcode(undefined)).toBeNull();
        expect(normalizeReactionShortcode(42)).toBeNull();
        expect(normalizeReactionShortcode("::")).toBeNull();
        expect(normalizeReactionShortcode("a b")).toBeNull();
        expect(normalizeReactionShortcode("<img>")).toBeNull();
        expect(normalizeReactionShortcode("x".repeat(65))).toBeNull();
    });
});

describe("reactionShortcodeFromContent", () => {
    it("reads the MSC4027 field", () => {
        expect(
            reactionShortcodeFromContent({
                [REACTION_SHORTCODE_KEY]: "blobcat",
            }),
        ).toBe("blobcat");
    });

    it("returns null when absent or content is not an object", () => {
        expect(reactionShortcodeFromContent({})).toBeNull();
        expect(reactionShortcodeFromContent(null)).toBeNull();
        expect(reactionShortcodeFromContent("x")).toBeNull();
    });
});

describe("resolveReactionShortcode", () => {
    it("prefers the event's shortcode over the pack lookup", () => {
        expect(resolveReactionShortcode(MXC, "fromEvent", packs)).toBe(
            "fromEvent",
        );
    });

    it("falls back to a reverse lookup of the mxc in packs", () => {
        expect(resolveReactionShortcode(MXC, null, packs)).toBe("blobcat");
    });

    it("returns null for an unknown mxc with no event shortcode", () => {
        expect(
            resolveReactionShortcode("mxc://hs.example/gone", null, packs),
        ).toBeNull();
    });

    it("returns null for non-mxc keys", () => {
        expect(resolveReactionShortcode("👍", "blobcat", packs)).toBeNull();
    });
});

describe("reactionDisplayName", () => {
    it("shows the emote name in colons for a custom reaction", () => {
        expect(reactionDisplayName(MXC, null, packs, "Emoji")).toBe(
            ":blobcat:",
        );
        expect(reactionDisplayName(MXC, "named", [], "Emoji")).toBe(":named:");
    });

    it("never returns the mxc URI: uses the fallback when unnamed", () => {
        expect(
            reactionDisplayName("mxc://hs.example/gone", null, [], "Emoji"),
        ).toBe("Emoji");
    });

    it("returns unicode and text keys unchanged", () => {
        expect(reactionDisplayName("👍", null, packs, "Emoji")).toBe("👍");
        expect(reactionDisplayName(":x:", null, packs, "Emoji")).toBe(":x:");
    });
});
