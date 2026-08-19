import { describe, it, expect } from "vitest";
import { buildTextContent, buildFormattedContent } from "./messageContent";

describe("buildTextContent", () => {
    it("matches sendTextMessage's content shape", () => {
        expect(buildTextContent("hi")).toEqual({
            msgtype: "m.text",
            body: "hi",
            "m.mentions": {},
        });
    });
});

describe("buildFormattedContent", () => {
    it("matches sendFormattedMessage's content shape", () => {
        expect(
            buildFormattedContent("**hi**", "<strong>hi</strong>", {
                user_ids: ["@a:x"],
            }),
        ).toEqual({
            msgtype: "m.text",
            body: "**hi**",
            format: "org.matrix.custom.html",
            formatted_body: "<strong>hi</strong>",
            "m.mentions": { user_ids: ["@a:x"] },
        });
    });
    it("defaults m.mentions to {}", () => {
        expect(buildFormattedContent("a", "<p>a</p>")["m.mentions"]).toEqual(
            {},
        );
    });
});
