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
});
