import { describe, expect, it } from "vitest";
import { buildDraftDmContent } from "./draftDmMessage";

describe("buildDraftDmContent", () => {
    it("returns null for blank text", () => {
        expect(buildDraftDmContent("   \n ", "@bob:hs")).toBeNull();
    });

    it("sends plain text as m.text with empty mentions", () => {
        expect(buildDraftDmContent("  hi there ", "@bob:hs")).toEqual({
            msgtype: "m.text",
            body: "hi there",
            "m.mentions": {},
        });
    });

    it("formats markdown", () => {
        const content = buildDraftDmContent("**hey**", "@bob:hs");
        expect(content?.format).toBe("org.matrix.custom.html");
        expect(content?.formatted_body).toContain("<strong>hey</strong>");
    });

    it("mentions the DM partner when their id is typed", () => {
        const content = buildDraftDmContent("hello @bob:hs", "@bob:hs");
        expect(content?.["m.mentions"]).toEqual({ user_ids: ["@bob:hs"] });
    });

    it("does not mention anyone else", () => {
        const content = buildDraftDmContent("ask @carol:hs", "@bob:hs");
        expect(content?.["m.mentions"]).toEqual({});
    });
});
