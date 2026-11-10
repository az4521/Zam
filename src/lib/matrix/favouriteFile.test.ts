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
