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

import {
    isMatrixMediaUrl,
    matrixMediaMxc,
    mediaUrlFavouriteFile,
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
