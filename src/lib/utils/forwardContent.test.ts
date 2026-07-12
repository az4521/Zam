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
});
