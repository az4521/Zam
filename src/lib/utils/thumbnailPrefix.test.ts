import { describe, expect, it } from "vitest";
import { jpegToProgressive } from "./jpegProgressive";
import { FIXTURES } from "./jpegProgressive.fixtures";
import { choosePrefix } from "./jpegScans";
import {
    JPEG_EOI,
    PREFIX_MAX_BYTES,
    THUMBNAIL_PREFIX_KEY,
    chooseThumbnailPrefix,
    prefixBudget,
    prefixThumbnailBytes,
    splitThumbnailPrefix,
    thumbnailPrefixFields,
    thumbnailPrefixLength,
} from "./thumbnailPrefix";

const bytesOf = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

function progressive(name: string): Uint8Array {
    return jpegToProgressive(bytesOf(FIXTURES[name]))!;
}

describe("prefixBudget", () => {
    it("is 30% of the file, capped at 256 KB", () => {
        expect(prefixBudget(100_000)).toBe(30_000);
        expect(prefixBudget(10_000_000)).toBe(PREFIX_MAX_BYTES);
        expect(prefixBudget(0)).toBe(0);
    });
});

describe("chooseThumbnailPrefix", () => {
    // The fixtures are tiny, so the real budget (30% of the file) is too small
    // for their first scans; these pass a generous budget to reach the cut.
    const ANY = Number.MAX_SAFE_INTEGER;

    it("takes the leading scans of a progressive JPEG within the budget", () => {
        const jpeg = progressive("ycc420");
        const found = chooseThumbnailPrefix(jpeg, "image/jpeg", ANY);
        expect(found).not.toBeNull();
        expect(found!.length).toBeGreaterThan(0);
        expect(found!.length).toBeLessThan(jpeg.length);
        // Same cut as the scan chooser, and the bytes stop at a scan end.
        expect(found!.length).toBe(choosePrefix(jpeg, ANY)!.length);
        expect(jpeg[0]).toBe(0xff);
        expect(jpeg[1]).toBe(0xd8);
    });

    it("is null when the first scans do not fit the budget", () => {
        const jpeg = progressive("ycc420");
        expect(chooseThumbnailPrefix(jpeg, "image/jpeg", 1)).toBeNull();
        // And with the real budget, which is 30% of this small file.
        expect(chooseThumbnailPrefix(jpeg, "image/jpeg")).toBeNull();
    });

    it("accepts a mimetype with parameters and any case", () => {
        const jpeg = progressive("gray");
        expect(
            chooseThumbnailPrefix(jpeg, "Image/JPEG; charset=x", ANY),
        ).not.toBeNull();
    });

    it("is null for a baseline JPEG (no progressive scans to cut)", () => {
        expect(
            chooseThumbnailPrefix(bytesOf(FIXTURES.ycc420), "image/jpeg"),
        ).toBeNull();
    });

    it("is null for anything but a JPEG", () => {
        const jpeg = progressive("ycc420");
        expect(chooseThumbnailPrefix(jpeg, "image/png")).toBeNull();
        expect(chooseThumbnailPrefix(jpeg, "image/webp")).toBeNull();
    });

    it("is null when the bytes are not a JPEG, whatever the type says", () => {
        const notJpeg = new Uint8Array(4096).fill(0x11);
        expect(chooseThumbnailPrefix(notJpeg, "image/jpeg")).toBeNull();
    });
});

describe("prefix upload format", () => {
    const ANY = Number.MAX_SAFE_INTEGER;

    it("the uploaded thumbnail is the prefix plus FF D9, sized length + 2", () => {
        const jpeg = jpegToProgressive(bytesOf(FIXTURES.ycc420))!;
        const found = chooseThumbnailPrefix(jpeg, "image/jpeg", ANY)!;
        const thumb = prefixThumbnailBytes(jpeg.subarray(0, found.length));
        expect(thumb.length).toBe(found.length + 2);
        expect(thumb[thumb.length - 2]).toBe(0xff);
        expect(thumb[thumb.length - 1]).toBe(0xd9);
        expect(JPEG_EOI).toEqual(new Uint8Array([0xff, 0xd9]));
        // The shared prefix is the file's own first bytes, unchanged.
        expect(thumb.subarray(0, found.length)).toEqual(
            jpeg.subarray(0, found.length),
        );
        // The info the upload writes is accepted by the receiver.
        const info = {
            mimetype: "image/jpeg",
            ...thumbnailPrefixFields(found.length),
            thumbnail_info: { mimetype: "image/jpeg", size: thumb.length },
        };
        expect(thumbnailPrefixLength(info)).toBe(found.length);
    });

    it("splits a downloaded thumbnail into the whole thumbnail and the prefix", () => {
        const prefix = Uint8Array.from([0xff, 0xd8, 1, 2, 3]);
        const thumb = prefixThumbnailBytes(prefix);
        const got = splitThumbnailPrefix(thumb, prefix.length)!;
        expect(got.thumb).toEqual(thumb);
        expect(got.prefix).toEqual(prefix);
    });

    it("rejects a downloaded thumbnail without FF D9 at its end", () => {
        const prefix = Uint8Array.from([0xff, 0xd8, 1, 2, 3]);
        const thumb = prefixThumbnailBytes(prefix);
        thumb[thumb.length - 1] = 0x00;
        expect(splitThumbnailPrefix(thumb, prefix.length)).toBeNull();
    });

    it("rejects a downloaded thumbnail of any other size", () => {
        const prefix = Uint8Array.from([0xff, 0xd8, 1, 2, 3]);
        const thumb = prefixThumbnailBytes(prefix);
        expect(splitThumbnailPrefix(thumb, prefix.length - 1)).toBeNull();
        expect(splitThumbnailPrefix(prefix, prefix.length)).toBeNull();
    });
});

describe("thumbnailPrefixLength", () => {
    const valid = () => ({
        mimetype: "image/jpeg",
        [THUMBNAIL_PREFIX_KEY]: { length: 12_345 },
        thumbnail_info: { mimetype: "image/jpeg", size: 12_347 },
    });

    it("reads the length of a well-formed Zam prefix thumbnail", () => {
        expect(thumbnailPrefixLength(valid())).toBe(12_345);
    });

    it("round-trips the fields the upload writes", () => {
        const info = {
            mimetype: "image/jpeg",
            ...thumbnailPrefixFields(777),
            thumbnail_info: { mimetype: "image/jpeg", size: 779 },
        };
        expect(thumbnailPrefixLength(info)).toBe(777);
        expect(THUMBNAIL_PREFIX_KEY).toBe("moe.crafty.zam.thumbnail_prefix");
    });

    it("is null without the Zam key (other clients' JPEG thumbnails)", () => {
        const { [THUMBNAIL_PREFIX_KEY]: _unused, ...rest } = valid();
        expect(thumbnailPrefixLength(rest)).toBeNull();
    });

    it("is null when the thumbnail size is not length + 2", () => {
        for (const size of [12_345, 12_346, 12_348]) {
            const info = valid();
            info.thumbnail_info.size = size;
            expect(thumbnailPrefixLength(info)).toBeNull();
        }
    });

    it("is null for a non-JPEG full image or thumbnail", () => {
        const png = { ...valid(), mimetype: "image/png" };
        expect(thumbnailPrefixLength(png)).toBeNull();
        const webp = {
            ...valid(),
            thumbnail_info: { mimetype: "image/webp", size: 12_347 },
        };
        expect(thumbnailPrefixLength(webp)).toBeNull();
    });

    it("is null for lengths that are not a sane byte count", () => {
        for (const length of [0, -1, 1.5, NaN, PREFIX_MAX_BYTES + 1, "10"]) {
            const info = valid();
            (info as Record<string, unknown>)[THUMBNAIL_PREFIX_KEY] = {
                length,
            };
            expect(thumbnailPrefixLength(info)).toBeNull();
        }
    });

    it("is null for anything that is not an object", () => {
        expect(thumbnailPrefixLength(undefined)).toBeNull();
        expect(thumbnailPrefixLength(null)).toBeNull();
        expect(thumbnailPrefixLength("info")).toBeNull();
        expect(thumbnailPrefixLength([])).toBeNull();
    });
});
