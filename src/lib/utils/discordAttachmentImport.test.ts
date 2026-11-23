import { describe, expect, it } from "vitest";
import {
    attachmentFavourite,
    attachmentMediaType,
    builtInRefreshServiceUrl,
    DEFAULT_DISCORD_REFRESH_URL,
    effectiveRefreshServiceUrl,
    copiesByDiscordUrl,
    createHashMatcher,
    hashCandidates,
    normaliseRefreshServiceUrl,
    parseMediaHashes,
    serialiseMediaHashes,
    sha256Hex,
    parseUploadedAttachments,
    serialiseUploadedAttachments,
} from "./discordAttachmentImport";
import type { FavouriteGif } from "$lib/matrix/client";

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
        discordUrl: "https://cdn.discordapp.com/attachments/1/2/cat.gif",
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
            discordUrl: base.discordUrl,
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
            discordUrl: base.discordUrl,
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

describe("builtInRefreshServiceUrl", () => {
    it("uses the default when unset or empty", () => {
        expect(builtInRefreshServiceUrl({})).toBe(DEFAULT_DISCORD_REFRESH_URL);
        expect(
            builtInRefreshServiceUrl({ VITE_DISCORD_REFRESH_URL: "  " }),
        ).toBe(DEFAULT_DISCORD_REFRESH_URL);
    });
    it("takes a build-time override and normalises it", () => {
        expect(
            builtInRefreshServiceUrl({
                VITE_DISCORD_REFRESH_URL: "https://h.example/r//",
            }),
        ).toBe("https://h.example/r");
    });
    it("is turned off by 'off' and by an unusable address", () => {
        expect(
            builtInRefreshServiceUrl({ VITE_DISCORD_REFRESH_URL: "OFF" }),
        ).toBe(null);
        expect(
            builtInRefreshServiceUrl({
                VITE_DISCORD_REFRESH_URL: "http://h.example",
            }),
        ).toBe(null);
    });
});

describe("effectiveRefreshServiceUrl", () => {
    it("prefers the user's own address", () => {
        expect(
            effectiveRefreshServiceUrl(
                "https://mine.example/",
                "https://built.example",
            ),
        ).toBe("https://mine.example");
    });
    it("falls back to the built-in service when empty", () => {
        expect(effectiveRefreshServiceUrl(" ", "https://built.example")).toBe(
            "https://built.example",
        );
        expect(effectiveRefreshServiceUrl("", null)).toBe(null);
    });
    it("does not fall back when the user's address is unusable", () => {
        expect(
            effectiveRefreshServiceUrl(
                "http://mine.example",
                "https://built.example",
            ),
        ).toBe(null);
    });
});

describe("existing copies", () => {
    const D = "https://cdn.discordapp.com/attachments/1/2/a.gif";
    const fav = (extra: Partial<FavouriteGif>): FavouriteGif => ({
        url: "https://hs/x",
        previewUrl: "",
        addedAt: 1,
        ...extra,
    });

    it("indexes favourites by their Discord link", () => {
        const map = copiesByDiscordUrl([
            fav({ mxc: "mxc://hs/a", discordUrl: D, video: true }),
            fav({ mxc: "https://not-mxc", discordUrl: D + "2" }),
            fav({ mxc: "mxc://hs/c" }),
        ]);
        expect([...map]).toEqual([[D, { mxc: "mxc://hs/a", video: true }]]);
    });

    it("hashes only plain homeserver media without a Discord link", () => {
        expect(
            hashCandidates([
                fav({ mxc: "mxc://hs/a" }),
                fav({ mxc: "mxc://hs/a" }),
                fav({ mxc: "mxc://hs/b", discordUrl: D }),
                fav({
                    mxc: "mxc://hs/c",
                    source: { roomId: "!r", eventId: "$e" },
                }),
                fav({}),
            ]),
        ).toEqual([{ mxc: "mxc://hs/a", video: false }]);
    });
});

describe("sha256Hex", () => {
    it("hashes bytes", async () => {
        expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    });
});

describe("media hash cache", () => {
    it("round-trips and drops malformed entries", () => {
        const h = "a".repeat(64);
        const map = parseMediaHashes(
            JSON.stringify({ "mxc://hs/a": h, "mxc://hs/b": "nope", x: h }),
        );
        expect([...map]).toEqual([["mxc://hs/a", h]]);
        expect(parseMediaHashes(serialiseMediaHashes(map))).toEqual(map);
        expect(parseMediaHashes("{")).toEqual(new Map());
    });
});

describe("createHashMatcher", () => {
    it("fetches nothing until asked, then each candidate once", async () => {
        const fetched: string[] = [];
        const known = new Map([["mxc://hs/a", "ha"]]);
        let hashed = 0;
        const match = createHashMatcher({
            candidates: [
                { mxc: "mxc://hs/a", video: false },
                { mxc: "mxc://hs/b", video: true },
                { mxc: "mxc://hs/c", video: false },
            ],
            known,
            fetchHash: async (mxc) => {
                fetched.push(mxc);
                if (mxc === "mxc://hs/c") throw new Error("gone");
                return "hb";
            },
            onHashed: () => hashed++,
        });
        expect(fetched).toEqual([]);
        expect(await match("hb")).toEqual({ mxc: "mxc://hs/b", video: true });
        expect(await match("ha")).toEqual({ mxc: "mxc://hs/a", video: false });
        expect(await match("zz")).toBe(null);
        expect(fetched.sort()).toEqual(["mxc://hs/b", "mxc://hs/c"]);
        expect(known.get("mxc://hs/b")).toBe("hb");
        expect(hashed).toBe(1);
    });
});
