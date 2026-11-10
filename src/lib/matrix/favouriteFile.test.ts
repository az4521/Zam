import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { client, fetchAttachmentBlob } = vi.hoisted(() => ({
    client: { homeserver: "https://hs.example" as string | null },
    fetchAttachmentBlob: vi.fn(),
}));

vi.mock("$lib/matrix/client", () => ({
    fetchSingleEvent: vi.fn(),
}));

// Mirrors media.ts: the download URL always sits on the signed-in homeserver,
// with the media's own server in the path.
vi.mock("$lib/matrix/media", () => ({
    fetchAttachmentBlob: (url: string) => fetchAttachmentBlob(url),
    fetchDecryptedAttachmentBlob: vi.fn(),
    mxcToHttp: (mxc: string) => {
        const m = /^mxc:\/\/([^/]+)\/([A-Za-z0-9_-]+)$/.exec(mxc);
        return client.homeserver && m
            ? `${client.homeserver}/_matrix/client/v1/media/download/${m[1]}/${m[2]}`
            : null;
    },
}));

import { fetchSingleEvent } from "$lib/matrix/client";
import { fetchDecryptedAttachmentBlob } from "$lib/matrix/media";
import {
    eventFavouriteFile,
    favouriteFileName,
    isMatrixMediaUrl,
    matrixMediaMxc,
    mediaUrlFavouriteFile,
    reusableMediaOfFile,
} from "./favouriteFile";

const HS_MEDIA =
    "https://hs.example/_matrix/client/v1/media/download/hs.example/AbC123";
const OTHER_MEDIA =
    "https://other.example/_matrix/media/v3/download/other.example/AbC123";

describe("matrixMediaMxc", () => {
    it("names the media in our own and in another homeserver's URL", () => {
        expect(matrixMediaMxc(HS_MEDIA)).toBe("mxc://hs.example/AbC123");
        expect(matrixMediaMxc(OTHER_MEDIA)).toBe("mxc://other.example/AbC123");
        expect(
            matrixMediaMxc(
                "https://other.example/matrix/_matrix/client/v1/media/download/other.example/AbC123",
            ),
        ).toBe("mxc://other.example/AbC123");
    });

    it("accepts an mxc uri directly", () => {
        expect(matrixMediaMxc("mxc://other.example/AbC123")).toBe(
            "mxc://other.example/AbC123",
        );
    });

    it("rejects non-media links and malformed media ids", () => {
        expect(matrixMediaMxc("https://klipy.com/gifs/cat")).toBeNull();
        expect(
            matrixMediaMxc(
                "https://hs.example/_matrix/client/v1/media/thumbnail/hs.example/AbC123",
            ),
        ).toBeNull();
        expect(
            matrixMediaMxc(
                "https://hs.example/_matrix/client/v1/media/download/hs.example/a%2Fb",
            ),
        ).toBeNull();
        expect(matrixMediaMxc("not a url")).toBeNull();
    });
});

describe("isMatrixMediaUrl", () => {
    afterEach(() => {
        client.homeserver = "https://hs.example";
    });

    it("accepts Matrix media from any homeserver", () => {
        expect(isMatrixMediaUrl(HS_MEDIA)).toBe(true);
        expect(isMatrixMediaUrl(OTHER_MEDIA)).toBe(true);
        expect(isMatrixMediaUrl("mxc://other.example/AbC123")).toBe(true);
    });

    it("rejects a plain link", () => {
        expect(isMatrixMediaUrl("https://klipy.com/gifs/cat")).toBe(false);
    });

    it("rejects everything when signed out", () => {
        client.homeserver = null;
        expect(isMatrixMediaUrl(HS_MEDIA)).toBe(false);
    });
});

describe("mediaUrlFavouriteFile", () => {
    beforeEach(() => {
        fetchAttachmentBlob.mockReset();
        (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
            vi.fn();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("fetches our own media and returns it as a GIF file", async () => {
        const blob = new Blob(["gif-bytes"], { type: "image/gif" });
        fetchAttachmentBlob.mockResolvedValue("blob:favourite");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ blob: async () => blob })),
        );

        const file = await mediaUrlFavouriteFile(HS_MEDIA);

        expect(fetchAttachmentBlob).toHaveBeenCalledWith(HS_MEDIA);
        expect(file?.name).toBe("favourite.gif");
        expect(file?.type).toBe("image/gif");
        expect(await file!.text()).toBe("gif-bytes");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:favourite");
    });

    it("names a non-GIF favourite for its own type", async () => {
        fetchAttachmentBlob.mockResolvedValue("blob:png");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["png"], { type: "image/png" }),
            })),
        );

        const file = await mediaUrlFavouriteFile(HS_MEDIA);

        expect(file?.name).toBe("favourite.png");
        expect(file?.type).toBe("image/png");
    });

    it("keeps the name a GIF was starred with, matched to its bytes", async () => {
        fetchAttachmentBlob.mockResolvedValue("blob:named");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["gif"], { type: "image/gif" }),
            })),
        );

        const named = await mediaUrlFavouriteFile(
            HS_MEDIA,
            undefined,
            undefined,
            "holiday.gif",
        );
        const renamed = await mediaUrlFavouriteFile(
            HS_MEDIA,
            undefined,
            undefined,
            "holiday.png",
        );

        expect(named?.name).toBe("holiday.gif");
        expect(renamed?.name).toBe("holiday.gif");
    });

    it("treats untyped bytes as a GIF", async () => {
        fetchAttachmentBlob.mockResolvedValue("blob:untyped");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ blob: async () => new Blob(["x"]) })),
        );

        const file = await mediaUrlFavouriteFile(HS_MEDIA);

        expect(file?.name).toBe("favourite.gif");
        expect(file?.type).toBe("image/gif");
    });

    it("routes another homeserver's media through ours", async () => {
        fetchAttachmentBlob.mockResolvedValue("blob:foreign");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["gif"], { type: "image/gif" }),
            })),
        );

        const file = await mediaUrlFavouriteFile(OTHER_MEDIA);

        expect(fetchAttachmentBlob).toHaveBeenCalledWith(
            "https://hs.example/_matrix/client/v1/media/download/other.example/AbC123",
        );
        expect(file?.type).toBe("image/gif");
    });

    it("never fetches a plain link", async () => {
        expect(
            await mediaUrlFavouriteFile("https://klipy.com/gifs/cat"),
        ).toBeNull();
        expect(fetchAttachmentBlob).not.toHaveBeenCalled();
    });
});

describe("mediaUrlFavouriteFile reuse", () => {
    beforeEach(() => {
        fetchAttachmentBlob.mockReset();
        fetchAttachmentBlob.mockResolvedValue("blob:reuse");
        (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
            vi.fn();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const serveBlob = (blob: Blob) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ blob: async () => blob })),
        );

    it("keeps the media's mxc, the bytes' type and the stored size", async () => {
        serveBlob(new Blob(["png"], { type: "image/png" }));

        const file = await mediaUrlFavouriteFile(HS_MEDIA, 480, 270);

        expect(reusableMediaOfFile(file!)).toEqual({
            url: "mxc://hs.example/AbC123",
            info: { mimetype: "image/png", size: 3, w: 480, h: 270 },
        });
    });

    it("drops a stored size unless both sides are usable", async () => {
        serveBlob(new Blob(["gif"], { type: "image/gif" }));

        const file = await mediaUrlFavouriteFile(HS_MEDIA, "wide", 270);

        expect(reusableMediaOfFile(file!)?.info).toEqual({
            mimetype: "image/gif",
            size: 3,
        });
    });

    it("reuses nothing for bytes that are not an image", async () => {
        serveBlob(new Blob(["x"]));

        const file = await mediaUrlFavouriteFile(HS_MEDIA, 480, 270);

        expect(file).not.toBeNull();
        expect(reusableMediaOfFile(file!)).toBeUndefined();
    });
});

describe("favouriteFileName", () => {
    it("keeps a usable name whose extension already matches", () => {
        expect(favouriteFileName("cat.gif", "image/gif")).toBe("cat.gif");
        expect(favouriteFileName("photo.jpeg", "image/jpeg")).toBe(
            "photo.jpeg",
        );
        expect(favouriteFileName("my cat.GIF", "image/gif")).toBe("my cat.GIF");
    });

    it("replaces a wrong extension with the bytes' own", () => {
        expect(favouriteFileName("cat.png", "image/gif")).toBe("cat.gif");
        expect(favouriteFileName("cat.gif", "image/webp")).toBe("cat.webp");
    });

    it("adds the bytes' extension to a name without one", () => {
        expect(favouriteFileName("cat", "image/webp")).toBe("cat.webp");
    });

    it("keeps a name whose type it cannot name", () => {
        expect(favouriteFileName("notes.txt", "application/x-thing")).toBe(
            "notes.txt",
        );
    });

    it("removes path separators and control characters", () => {
        expect(favouriteFileName("../../etc/cat.gif", "image/gif")).toBe(
            "....etccat.gif",
        );
        expect(favouriteFileName("a\\b\u0007c.gif", "image/gif")).toBe(
            "abc.gif",
        );
    });

    it("caps the length, keeping the extension", () => {
        const long = favouriteFileName(`${"a".repeat(300)}.gif`, "image/gif");
        expect(long).toHaveLength(255);
        expect(long.endsWith(".gif")).toBe(true);

        const longPng = favouriteFileName("a".repeat(300), "image/png");
        expect(longPng).toHaveLength(255);
        expect(longPng.endsWith(".png")).toBe(true);
    });

    it("falls back to favourite with the bytes' extension when unusable", () => {
        expect(favouriteFileName(undefined, "image/png")).toBe("favourite.png");
        expect(favouriteFileName(42, "image/png")).toBe("favourite.png");
        expect(favouriteFileName("   ", "image/png")).toBe("favourite.png");
        expect(favouriteFileName("///", "image/png")).toBe("favourite.png");
        expect(favouriteFileName("..", "image/png")).toBe("favourite.png");
        expect(favouriteFileName(".png", "image/gif")).toBe("favourite.gif");
    });
});

describe("eventFavouriteFile name", () => {
    const cleanFile = {
        url: "mxc://hs.example/NameFile",
        key: { kty: "oct", alg: "A256CTR", k: "KEYBYTES", ext: true },
        iv: "IVBYTES",
        hashes: { sha256: "HASH" },
        v: "v2",
    };

    beforeEach(() => {
        vi.mocked(fetchDecryptedAttachmentBlob).mockResolvedValue("blob:name");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["png"], { type: "image/png" }),
            })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const source = (eventId: string) => ({
        roomId: "!room:hs.example",
        eventId,
    });

    it("takes the name from the filename of a captioned event", async () => {
        vi.mocked(fetchSingleEvent).mockResolvedValueOnce({
            getContent: () => ({
                msgtype: "m.image",
                file: cleanFile,
                info: { mimetype: "image/png" },
                filename: "holiday.png",
                body: "look at this",
            }),
        } as never);

        const file = await eventFavouriteFile(source("$captioned"));

        expect(file?.name).toBe("holiday.png");
    });

    it("takes the name from the body of an uncaptioned event", async () => {
        vi.mocked(fetchSingleEvent).mockResolvedValueOnce({
            getContent: () => ({
                msgtype: "m.image",
                file: cleanFile,
                info: { mimetype: "image/png" },
                body: "party.png",
            }),
        } as never);

        const file = await eventFavouriteFile(source("$uncaptioned"));

        expect(file?.name).toBe("party.png");
    });

    it("sanitises a hostile name and falls back when there is none", async () => {
        vi.mocked(fetchSingleEvent)
            .mockResolvedValueOnce({
                getContent: () => ({
                    file: cleanFile,
                    info: { mimetype: "image/png" },
                    body: "../../secret/x.png",
                }),
            } as never)
            .mockResolvedValueOnce({
                getContent: () => ({
                    file: cleanFile,
                    info: { mimetype: "image/png" },
                    body: 7,
                }),
            } as never);

        expect((await eventFavouriteFile(source("$hostile")))?.name).toBe(
            "....secretx.png",
        );
        expect((await eventFavouriteFile(source("$nameless")))?.name).toBe(
            "favourite.png",
        );
    });
});

describe("eventFavouriteFile reuse", () => {
    // Each test uses its own event id: resolved events are cached per id.
    const source = (eventId: string) => ({
        roomId: "!room:hs.example",
        eventId,
    });
    const cleanFile = {
        url: "mxc://hs.example/Enc123",
        key: { kty: "oct", alg: "A256CTR", k: "KEYBYTES", ext: true },
        iv: "IVBYTES",
        hashes: { sha256: "HASH" },
        v: "v2",
    };
    const goodInfo = {
        mimetype: "image/png",
        size: 99,
        w: 40,
        h: 30,
        thumbnail_file: { ...cleanFile, url: "mxc://hs.example/Thumb1" },
        thumbnail_info: { mimetype: "image/jpeg", w: 20, h: 15, size: 5 },
    };

    beforeEach(() => {
        vi.mocked(fetchDecryptedAttachmentBlob).mockResolvedValue("blob:event");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                blob: async () => new Blob(["png"], { type: "image/png" }),
            })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const givenEvent = (eventId: string, content: unknown) =>
        vi
            .mocked(fetchSingleEvent)
            .mockResolvedValueOnce({ getContent: () => content } as never);

    it("keeps the event's encrypted media for reuse", async () => {
        givenEvent("$good", {
            msgtype: "m.image",
            file: cleanFile,
            info: goodInfo,
        });

        const file = await eventFavouriteFile(source("$good"));

        expect(reusableMediaOfFile(file!)).toEqual({
            file: cleanFile,
            info: {
                mimetype: "image/png",
                size: 99,
                w: 40,
                h: 30,
                thumbnail_file: {
                    ...cleanFile,
                    url: "mxc://hs.example/Thumb1",
                },
                thumbnail_info: {
                    mimetype: "image/jpeg",
                    w: 20,
                    h: 15,
                    size: 5,
                },
            },
        });
    });

    it("copies only the fields a decryption needs", async () => {
        givenEvent("$extra", {
            file: {
                ...cleanFile,
                key: { ...cleanFile.key, key_ops: ["decrypt"], evil: "x" },
                extra: "x",
            },
            info: goodInfo,
        });

        const file = await eventFavouriteFile(source("$extra"));

        const reuse = reusableMediaOfFile(file!);
        expect(reuse?.file).toEqual(cleanFile);
        expect(reuse?.file?.key).not.toHaveProperty("key_ops");
    });

    it("keeps only the usable parts of a malformed info", async () => {
        givenEvent("$badinfo", {
            file: cleanFile,
            info: {
                mimetype: "image/png",
                size: "99",
                w: -4,
                h: 30,
                thumbnail_file: "nope",
                thumbnail_info: ["nope"],
            },
        });

        const file = await eventFavouriteFile(source("$badinfo"));

        expect(reusableMediaOfFile(file!)).toEqual({
            file: cleanFile,
            info: { mimetype: "image/png", h: 30 },
        });
    });

    it("reuses nothing when the file's url is not an mxc", async () => {
        givenEvent("$badurl", {
            file: { ...cleanFile, url: "https://evil.example/x" },
            info: goodInfo,
        });

        const file = await eventFavouriteFile(source("$badurl"));

        expect(file).not.toBeNull();
        expect(reusableMediaOfFile(file!)).toBeUndefined();
    });

    it("reuses nothing when the decryption key or iv is missing", async () => {
        givenEvent("$nokey", {
            file: { ...cleanFile, key: { alg: "A256CTR" } },
            info: goodInfo,
        });
        givenEvent("$noiv", {
            file: { ...cleanFile, iv: undefined },
            info: goodInfo,
        });

        expect(
            reusableMediaOfFile((await eventFavouriteFile(source("$nokey")))!),
        ).toBeUndefined();
        expect(
            reusableMediaOfFile((await eventFavouriteFile(source("$noiv")))!),
        ).toBeUndefined();
    });

    it("reuses nothing for media that is not an image", async () => {
        givenEvent("$video", {
            file: cleanFile,
            info: { ...goodInfo, mimetype: "video/mp4" },
        });

        const file = await eventFavouriteFile(source("$video"));

        expect(reusableMediaOfFile(file!)).toBeUndefined();
    });
});
