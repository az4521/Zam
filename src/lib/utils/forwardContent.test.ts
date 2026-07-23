import { describe, expect, it } from "vitest";
import { buildForwardContent } from "./forwardContent";

describe("buildForwardContent", () => {
    it("preserves message and media content without conversation relations", () => {
        const original = {
            msgtype: "m.image",
            body: "photo.png",
            url: "mxc://hs/photo",
            info: { mimetype: "image/png", w: 800 },
            "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
            "m.new_content": { body: "edited" },
            "m.mentions": { user_ids: ["@alice:hs"] },
        };
        expect(buildForwardContent(original)).toEqual({
            msgtype: "m.image",
            body: "photo.png",
            url: "mxc://hs/photo",
            info: { mimetype: "image/png", w: 800 },
        });
        expect(original).toHaveProperty("m.relates_to");
    });

    it("strips the legacy rich-reply fallback when forwarding a reply", () => {
        const original = {
            msgtype: "m.text",
            body: "> <@alice:hs> original question\n\nmy answer",
            format: "org.matrix.custom.html",
            formatted_body:
                "<mx-reply><blockquote>original question</blockquote></mx-reply>my answer",
            "m.relates_to": {
                "m.in_reply_to": { event_id: "$parent" },
            },
        };
        const out = buildForwardContent(original);
        expect(out.body).toBe("my answer");
        expect(out.formatted_body).toBe("my answer");
        expect(out).not.toHaveProperty("m.relates_to");
        // Neither the quote line nor the mx-reply block survives.
        expect(JSON.stringify(out)).not.toContain("mx-reply");
        expect(JSON.stringify(out)).not.toContain("original question");
    });

    it("leaves a non-reply body untouched even if it starts with a quote", () => {
        const original = {
            msgtype: "m.text",
            body: "> quoting a friend\n\nfor emphasis",
        };
        // No m.in_reply_to → not a reply → the body is real content, keep it.
        expect(buildForwardContent(original).body).toBe(
            "> quoting a friend\n\nfor emphasis",
        );
    });
});
