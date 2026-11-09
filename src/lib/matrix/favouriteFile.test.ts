import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { client, fetchAttachmentBlob } = vi.hoisted(() => ({
    client: { homeserver: "https://hs.example" as string | null },
    fetchAttachmentBlob: vi.fn(),
}));

vi.mock("$lib/matrix/client", () => ({
    fetchSingleEvent: vi.fn(),
    getHomeserverBaseUrl: () => client.homeserver,
}));

vi.mock("$lib/matrix/media", () => ({
    fetchAttachmentBlob: (url: string) => fetchAttachmentBlob(url),
    fetchDecryptedAttachmentBlob: vi.fn(),
}));

import { isHomeserverMediaUrl, mediaUrlFavouriteFile } from "./favouriteFile";

const MEDIA =
    "https://hs.example/_matrix/client/v1/media/download/hs.example/AbC123";

describe("isHomeserverMediaUrl", () => {
    afterEach(() => {
        client.homeserver = "https://hs.example";
    });

    it("accepts an authenticated media URL on our homeserver", () => {
        expect(isHomeserverMediaUrl(MEDIA)).toBe(true);
        expect(
            isHomeserverMediaUrl(
                "https://hs.example/matrix/_matrix/client/v1/media/download/hs.example/AbC123",
            ),
        ).toBe(true);
    });

    it("rejects another origin, the legacy media path and a plain link", () => {
        expect(
            isHomeserverMediaUrl(
                "https://evil.example/_matrix/client/v1/media/download/x/y",
            ),
        ).toBe(false);
        expect(
            isHomeserverMediaUrl(
                "https://hs.example/_matrix/media/v3/download/hs.example/AbC123",
            ),
        ).toBe(false);
        expect(isHomeserverMediaUrl("https://klipy.com/gifs/cat")).toBe(false);
    });

    it("rejects everything when signed out", () => {
        client.homeserver = null;
        expect(isHomeserverMediaUrl(MEDIA)).toBe(false);
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

        const file = await mediaUrlFavouriteFile(MEDIA);

        expect(fetchAttachmentBlob).toHaveBeenCalledWith(MEDIA);
        expect(file?.name).toBe("favourite.gif");
        expect(file?.type).toBe("image/gif");
        expect(await file!.text()).toBe("gif-bytes");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:favourite");
    });

    it("never fetches a foreign or legacy media URL", async () => {
        expect(
            await mediaUrlFavouriteFile(
                "https://evil.example/_matrix/client/v1/media/download/x/y",
            ),
        ).toBeNull();
        expect(
            await mediaUrlFavouriteFile(
                "https://hs.example/_matrix/media/v3/download/hs.example/AbC123",
            ),
        ).toBeNull();
        expect(fetchAttachmentBlob).not.toHaveBeenCalled();
    });
});
