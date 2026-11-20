import { describe, expect, it } from "vitest";
import {
    attachmentFavourite,
    attachmentMediaType,
    normaliseRefreshServiceUrl,
    parseUploadedAttachments,
    serialiseUploadedAttachments,
} from "./discordAttachmentImport";

describe("normaliseRefreshServiceUrl", () => {
    it("accepts https and strips trailing slashes, query and hash", () => {
        expect(
            normaliseRefreshServiceUrl(
                " https://refresh.example.com/x/?a=1#b ",
            ),
        ).toBe("https://refresh.example.com/x");
        expect(normaliseRefreshServiceUrl("https://refresh.example.com/")).toBe(
            "https://refresh.example.com",
        );
    });
    it("allows http only on this machine", () => {
        expect(normaliseRefreshServiceUrl("http://localhost:8787")).toBe(
            "http://localhost:8787",
        );
        expect(normaliseRefreshServiceUrl("http://127.0.0.1:8787/")).toBe(
            "http://127.0.0.1:8787",
        );
        expect(normaliseRefreshServiceUrl("http://[::1]:8787")).toBe(
            "http://[::1]:8787",
        );
        expect(normaliseRefreshServiceUrl("http://refresh.example.com")).toBe(
            null,
        );
    });
    it("rejects credentials, other schemes and junk", () => {
        expect(normaliseRefreshServiceUrl("https://u:p@example.com")).toBe(
            null,
        );
        expect(normaliseRefreshServiceUrl("ftp://example.com")).toBe(null);
        expect(normaliseRefreshServiceUrl("not a url")).toBe(null);
        expect(normaliseRefreshServiceUrl("  ")).toBe(null);
    });
});

describe("attachmentMediaType", () => {
    it("uses the server's image or video type", () => {
        expect(attachmentMediaType("a.bin", "image/gif; charset=x")).toBe(
            "image/gif",
        );
        expect(attachmentMediaType("a", "video/mp4")).toBe("video/mp4");
    });
    it("falls back to the extension for octet-stream or no type", () => {
        expect(attachmentMediaType("cat.GIF", "")).toBe("image/gif");
        expect(attachmentMediaType("cat.mp4", "application/octet-stream")).toBe(
            "video/mp4",
        );
        expect(attachmentMediaType("cat.txt", "")).toBe(null);
    });
    it("refuses other declared types", () => {
        expect(attachmentMediaType("cat.gif", "text/html")).toBe(null);
    });
});

describe("attachmentFavourite", () => {
    const base = {
        mxc: "mxc://hs.example/abc",
        httpUrl:
            "https://hs.example/_matrix/client/v1/media/download/hs.example/abc",
    };
    it("builds an image favourite with size and name", () => {
        expect(
            attachmentFavourite({
                ...base,
                video: false,
                name: "cat.gif",
                width: 200,
                height: 100,
            }),
        ).toEqual({
            url: base.httpUrl,
            previewUrl: base.httpUrl,
            mxc: base.mxc,
            name: "cat.gif",
            width: 200,
            height: 100,
        });
    });
    it("builds a video favourite without a poster and drops bad sizes", () => {
        expect(
            attachmentFavourite({ ...base, video: true, width: -1, height: 5 }),
        ).toEqual({
            url: base.httpUrl,
            previewUrl: "",
            mxc: base.mxc,
            video: true,
        });
    });
});

describe("uploaded attachment record", () => {
    it("round-trips and keeps only mxc values", () => {
        const map = parseUploadedAttachments(
            JSON.stringify({
                "https://cdn.discordapp.com/attachments/1/2/a.gif":
                    "mxc://hs/a",
                bad: "https://x",
                num: 3,
            }),
        );
        expect([...map.entries()]).toEqual([
            ["https://cdn.discordapp.com/attachments/1/2/a.gif", "mxc://hs/a"],
        ]);
        expect(
            parseUploadedAttachments(serialiseUploadedAttachments(map)),
        ).toEqual(map);
    });
    it("survives junk", () => {
        expect(parseUploadedAttachments(null).size).toBe(0);
        expect(parseUploadedAttachments("{").size).toBe(0);
        expect(parseUploadedAttachments("[1]").size).toBe(0);
    });
});
