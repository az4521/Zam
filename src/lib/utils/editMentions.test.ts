import { describe, it, expect } from "vitest";
import { computeEditMentions } from "./editMentions";

describe("computeEditMentions — v1.7 mentions through m.replace edits", () => {
    it("carries forward original mentions into resolved, empty topLevel", () => {
        const r = computeEditMentions({ user_ids: ["@a:hs"] }, "hi @a");
        expect(r.resolved).toEqual({ user_ids: ["@a:hs"] });
        expect(r.topLevel).toEqual({});
    });
    it("adds a newly typed full mxid to both resolved and topLevel", () => {
        // MXID_RE requires a dotted domain (conservative — avoids matching
        // prose like "@ref:label"), so the newly typed mxid uses a realistic
        // homeserver name. The original mention is data (not regex-parsed) and
        // keeps the codebase's short fake-domain convention.
        const r = computeEditMentions(
            { user_ids: ["@a:hs"] },
            "hi @a and @b:hs.org",
        );
        expect(r.resolved.user_ids).toEqual(["@a:hs", "@b:hs.org"]);
        expect(r.topLevel.user_ids).toEqual(["@b:hs.org"]);
    });
    it("preserves room mention flag in resolved only", () => {
        const r = computeEditMentions({ room: true }, "still pinging");
        expect(r.resolved.room).toBe(true);
        expect(r.topLevel.room).toBeUndefined();
    });
    it("handles absent original", () => {
        expect(computeEditMentions(undefined, "x")).toEqual({
            topLevel: {},
            resolved: {},
        });
    });
    it("unions extra userIds, deduped, without dropping originals", () => {
        const r = computeEditMentions(
            { user_ids: ["@a:hs"] },
            "hi @Alice and @Bob",
            { userIds: ["@b:hs", "@b:hs", "@a:hs"] },
        );
        expect(r.resolved.user_ids).toEqual(["@a:hs", "@b:hs"]);
        expect(r.topLevel.user_ids).toEqual(["@b:hs"]);
    });
    it("adds a room mention to both halves when newly introduced", () => {
        const r = computeEditMentions(undefined, "@room hi", { room: true });
        expect(r.resolved.room).toBe(true);
        expect(r.topLevel.room).toBe(true);
    });
    it("does not repeat room on topLevel when the original already had it", () => {
        const r = computeEditMentions({ room: true }, "@room hi", {
            room: true,
        });
        expect(r.resolved.room).toBe(true);
        expect(r.topLevel.room).toBeUndefined();
    });
});
