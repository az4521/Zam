import { describe, expect, it } from "vitest";
import {
    GALLERY_MAX_ITEMS,
    GALLERY_MSGTYPE,
    GALLERY_MSGTYPE_UNSTABLE,
    GALLERY_SEND_MSGTYPE,
    buildGalleryContent,
    chunkGalleryItems,
    galleryItems,
    isGalleryContent,
    isGalleryMsgtype,
    toGalleryItem,
} from "./gallery";

describe("send prefix", () => {
    it("sends only the unstable msgtype until MSC4274 is merged", () => {
        expect(buildGalleryContent([]).msgtype).toBe("dm.filament.gallery");
    });
});

describe("isGalleryMsgtype", () => {
    it("accepts the stable and the unstable gallery msgtype", () => {
        expect(isGalleryMsgtype(GALLERY_MSGTYPE)).toBe(true);
        expect(isGalleryMsgtype(GALLERY_MSGTYPE_UNSTABLE)).toBe(true);
        expect(isGalleryMsgtype("m.gallery")).toBe(true);
        expect(isGalleryMsgtype("dm.filament.gallery")).toBe(true);
    });

    it("rejects other media and text msgtypes", () => {
        expect(isGalleryMsgtype("m.image")).toBe(false);
        expect(isGalleryMsgtype("m.text")).toBe(false);
        expect(isGalleryMsgtype("m.gallery.x")).toBe(false);
    });

    it("rejects non-string and prototype-looking values", () => {
        expect(isGalleryMsgtype(undefined)).toBe(false);
        expect(isGalleryMsgtype(null)).toBe(false);
        expect(isGalleryMsgtype(42)).toBe(false);
        expect(isGalleryMsgtype(["m.gallery"])).toBe(false);
        expect(isGalleryMsgtype("toString")).toBe(false);
    });

    it("sends the unstable msgtype until the MSC lands", () => {
        expect(GALLERY_SEND_MSGTYPE).toBe(GALLERY_MSGTYPE_UNSTABLE);
    });
});

describe("isGalleryContent", () => {
    it("is true for either gallery msgtype", () => {
        expect(isGalleryContent({ msgtype: "m.gallery", itemtypes: [] })).toBe(
            true,
        );
        expect(
            isGalleryContent({ msgtype: "dm.filament.gallery", itemtypes: [] }),
        ).toBe(true);
    });

    it("is false for null, undefined and ordinary messages", () => {
        expect(isGalleryContent(null)).toBe(false);
        expect(isGalleryContent(undefined)).toBe(false);
        expect(isGalleryContent({ msgtype: "m.text", body: "hi" })).toBe(false);
        expect(isGalleryContent({ body: "no msgtype" })).toBe(false);
    });
});

describe("galleryItems", () => {
    const image = { itemtype: "m.image", url: "mxc://hs/a", body: "a.png" };
    const video = { itemtype: "m.video", url: "mxc://hs/b", body: "b.mp4" };

    it("returns [] for non-gallery content", () => {
        expect(
            galleryItems({ msgtype: "m.image", itemtypes: [image] }),
        ).toEqual([]);
        expect(galleryItems(null)).toEqual([]);
        expect(galleryItems(undefined)).toEqual([]);
    });

    it("returns [] when itemtypes is missing or not an array", () => {
        expect(galleryItems({ msgtype: "m.gallery" })).toEqual([]);
        expect(galleryItems({ msgtype: "m.gallery", itemtypes: null })).toEqual(
            [],
        );
        expect(
            galleryItems({ msgtype: "m.gallery", itemtypes: "m.image" }),
        ).toEqual([]);
        expect(
            galleryItems({ msgtype: "m.gallery", itemtypes: { 0: image } }),
        ).toEqual([]);
        expect(galleryItems({ msgtype: "m.gallery", itemtypes: 3 })).toEqual(
            [],
        );
    });

    it("sets msgtype from itemtype and keeps the item fields and itemtype", () => {
        const [first] = galleryItems({
            msgtype: "m.gallery",
            itemtypes: [image],
        });
        expect(first).toEqual({
            itemtype: "m.image",
            msgtype: "m.image",
            url: "mxc://hs/a",
            body: "a.png",
        });
    });

    it("keeps the valid items in order", () => {
        const out = galleryItems({
            msgtype: "m.gallery",
            itemtypes: [video, image],
        });
        expect(out.map((i) => i.msgtype)).toEqual(["m.video", "m.image"]);
        expect(out.map((i) => i.url)).toEqual(["mxc://hs/b", "mxc://hs/a"]);
    });

    it("drops null, primitive and array items", () => {
        const out = galleryItems({
            msgtype: "m.gallery",
            itemtypes: [null, "m.image", 7, true, [image], image],
        });
        expect(out).toHaveLength(1);
        expect(out[0].url).toBe("mxc://hs/a");
    });

    it("drops unknown and prototype-looking itemtypes", () => {
        const out = galleryItems({
            msgtype: "m.gallery",
            itemtypes: [
                { itemtype: "m.text", url: "mxc://hs/x" },
                { itemtype: "toString", url: "mxc://hs/x" },
                { itemtype: "constructor", url: "mxc://hs/x" },
                { itemtype: "__proto__", url: "mxc://hs/x" },
                { itemtype: "M.IMAGE", url: "mxc://hs/x" },
                { itemtype: "m.image ", url: "mxc://hs/x" },
                { msgtype: "m.image", url: "mxc://hs/x" },
                { itemtype: undefined, url: "mxc://hs/x" },
                { itemtype: 5, url: "mxc://hs/x" },
                {},
            ],
        });
        expect(out).toEqual([]);
    });

    it("does not mutate the input content", () => {
        const content: Record<string, unknown> = {
            msgtype: "m.gallery",
            itemtypes: [{ ...image }],
        };
        const snapshot = JSON.stringify(content);
        galleryItems(content);
        expect(JSON.stringify(content)).toBe(snapshot);
        const [raw] = content.itemtypes as Record<string, unknown>[];
        expect(raw.msgtype).toBeUndefined();
    });
});

describe("toGalleryItem", () => {
    it("turns msgtype into itemtype", () => {
        const out = toGalleryItem({
            msgtype: "m.image",
            url: "mxc://hs/a",
            info: { w: 1, h: 2 },
        });
        expect(out.itemtype).toBe("m.image");
        expect(out).not.toHaveProperty("msgtype");
        expect(out.url).toBe("mxc://hs/a");
        expect(out.info).toEqual({ w: 1, h: 2 });
    });

    it("strips caption, formatting, mentions and relation fields", () => {
        const out = toGalleryItem({
            msgtype: "m.image",
            body: "caption",
            format: "org.matrix.custom.html",
            formatted_body: "<b>caption</b>",
            "m.mentions": { user_ids: ["@a:hs"] },
            "m.relates_to": { "m.in_reply_to": { event_id: "$p" } },
            url: "mxc://hs/a",
        });
        expect(out).not.toHaveProperty("format");
        expect(out).not.toHaveProperty("formatted_body");
        expect(out).not.toHaveProperty("m.mentions");
        expect(out).not.toHaveProperty("m.relates_to");
        expect(out.url).toBe("mxc://hs/a");
    });

    it("uses filename over body for the item body", () => {
        const out = toGalleryItem({
            msgtype: "m.file",
            body: "my caption",
            filename: "report.pdf",
            url: "mxc://hs/f",
        });
        expect(out.body).toBe("report.pdf");
    });

    it("falls back to body when filename is missing or empty", () => {
        expect(
            toGalleryItem({ msgtype: "m.image", body: "cat.png", url: "u" })
                .body,
        ).toBe("cat.png");
        expect(
            toGalleryItem({
                msgtype: "m.image",
                body: "cat.png",
                filename: "",
                url: "u",
            }).body,
        ).toBe("cat.png");
    });

    it("uses an empty body when neither filename nor body is a string", () => {
        expect(toGalleryItem({ msgtype: "m.image", url: "u" }).body).toBe("");
        expect(
            toGalleryItem({
                msgtype: "m.image",
                body: 3,
                filename: 4,
                url: "u",
            }).body,
        ).toBe("");
    });

    it("round-trips through galleryItems", () => {
        const item = toGalleryItem({
            msgtype: "m.video",
            body: "clip",
            filename: "clip.mp4",
            url: "mxc://hs/v",
        });
        const [back] = galleryItems(
            buildGalleryContent([item], { body: "cap" }),
        );
        expect(back.msgtype).toBe("m.video");
        expect(back.body).toBe("clip.mp4");
        expect(back.url).toBe("mxc://hs/v");
    });
});

describe("buildGalleryContent", () => {
    const items = [{ itemtype: "m.image", url: "mxc://hs/a", body: "a.png" }];

    it("builds an uncaptioned gallery with an empty body and mentions", () => {
        const content = buildGalleryContent(items);
        expect(content).toEqual({
            msgtype: GALLERY_SEND_MSGTYPE,
            body: "",
            itemtypes: items,
            "m.mentions": {},
        });
        expect(content).not.toHaveProperty("format");
        expect(content).not.toHaveProperty("formatted_body");
    });

    it("always includes m.mentions, even with a caption", () => {
        const content = buildGalleryContent(items, { body: "hi" });
        expect(content["m.mentions"]).toEqual({});
        expect(content.body).toBe("hi");
    });

    it("passes caption mentions through", () => {
        const content = buildGalleryContent(items, {
            body: "hi @room",
            mentions: { room: true, user_ids: ["@a:hs"] },
        });
        expect(content["m.mentions"]).toEqual({
            room: true,
            user_ids: ["@a:hs"],
        });
    });

    it("adds format and formatted_body when a formatted caption is given", () => {
        const content = buildGalleryContent(items, {
            body: "bold",
            formattedBody: "<b>bold</b>",
        });
        expect(content.format).toBe("org.matrix.custom.html");
        expect(content.formatted_body).toBe("<b>bold</b>");
        expect(content.body).toBe("bold");
    });

    it("omits format for a null or empty formatted body", () => {
        const withNull = buildGalleryContent(items, {
            body: "plain",
            formattedBody: null,
        });
        const withEmpty = buildGalleryContent(items, {
            body: "plain",
            formattedBody: "",
        });
        for (const c of [withNull, withEmpty]) {
            expect(c).not.toHaveProperty("format");
            expect(c).not.toHaveProperty("formatted_body");
            expect(c.body).toBe("plain");
        }
    });

    it("keeps the items array as given and in order", () => {
        const two = [
            { itemtype: "m.image", url: "mxc://hs/1" },
            { itemtype: "m.video", url: "mxc://hs/2" },
        ];
        expect(buildGalleryContent(two).itemtypes).toEqual(two);
    });
});

describe("chunkGalleryItems", () => {
    const range = (n: number) => Array.from({ length: n }, (_, i) => i);

    it("has a 40 item cap", () => {
        expect(GALLERY_MAX_ITEMS).toBe(40);
    });

    it("returns no chunks for zero items", () => {
        expect(chunkGalleryItems([])).toEqual([]);
    });

    it("keeps exactly 40 items in one chunk", () => {
        const chunks = chunkGalleryItems(range(40));
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toHaveLength(40);
    });

    it("splits 41 items into 40 and 1", () => {
        const chunks = chunkGalleryItems(range(41));
        expect(chunks.map((c) => c.length)).toEqual([40, 1]);
        expect(chunks[1]).toEqual([40]);
    });

    it("splits 85 items into 40, 40 and 5, preserving order", () => {
        const items = range(85);
        const chunks = chunkGalleryItems(items);
        expect(chunks.map((c) => c.length)).toEqual([40, 40, 5]);
        expect(chunks.flat()).toEqual(items);
    });

    it("does not mutate the input", () => {
        const items = range(45);
        chunkGalleryItems(items);
        expect(items).toHaveLength(45);
    });
});
