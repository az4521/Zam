import { describe, expect, it } from "vitest";
import { stripLocationMetadata } from "./stripMetadata";

const enc = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Little-endian TIFF with orientation + a GPS IFD pointer and GPS data. */
function exifTiff(orientation: number): number[] {
    return [
        ...enc("II"),
        42,
        0,
        8,
        0,
        0,
        0,
        2,
        0, // two entries in IFD0
        0x12,
        0x01,
        3,
        0,
        1,
        0,
        0,
        0,
        orientation,
        0,
        0,
        0,
        0x25,
        0x88,
        4,
        0,
        1,
        0,
        0,
        0,
        38,
        0,
        0,
        0, // GPS IFD at 38
        0,
        0,
        0,
        0,
        1,
        0, // GPS IFD: one entry
        0x01,
        0x00,
        2,
        0,
        2,
        0,
        0,
        0,
        0x4e,
        0x00,
        0,
        0, // "N"
        0,
        0,
        0,
        0,
    ];
}

function jpeg(): Uint8Array {
    const tiff = exifTiff(6);
    const app1 = [...enc("Exif"), 0, 0, ...tiff];
    const len = app1.length + 2;
    const xmp = enc("http://ns.adobe.com/xap/1.0/\0SECRET-XMP");
    return new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xe1,
        len >> 8,
        len & 255,
        ...app1,
        0xff,
        0xe1,
        0,
        xmp.length + 2,
        ...xmp,
        0xff,
        0xfe,
        0,
        8,
        ...enc("secret"),
        0xff,
        0xdb,
        0,
        4,
        1,
        2, // DQT
        0xff,
        0xda,
        0,
        4,
        1,
        2,
        0x12,
        0x34,
        0xff,
        0x00,
        0x56, // SOS + data
        0xff,
        0xd9,
        ...enc("TRAILER-GPS"),
    ]);
}

const file = (bytes: Uint8Array, name: string, type: string) =>
    new File([bytes as BlobPart], name, { type });

async function bytesOf(f: File): Promise<Uint8Array> {
    return new Uint8Array(await f.arrayBuffer());
}

const text = (b: Uint8Array) => String.fromCharCode(...b);

describe("stripLocationMetadata", () => {
    it("drops JPEG GPS, XMP, comments and trailers but keeps orientation", async () => {
        const out = await bytesOf(
            await stripLocationMetadata(file(jpeg(), "a.jpg", "image/jpeg")),
        );
        const s = text(out);
        expect(s).not.toContain("SECRET");
        expect(s).not.toContain("secret");
        expect(s).not.toContain("TRAILER");
        expect(s).toContain("Exif");
        // Orientation 6 is still there, GPS pointer tag 0x8825 is not.
        const i = s.indexOf("Exif");
        const tiff = out.subarray(i + 6);
        expect([...tiff.subarray(10, 14)]).toEqual([0x01, 0x12, 0x00, 0x03]);
        expect(tiff[19]).toBe(6);
        expect(s).not.toContain("\u0088");
        expect(out[out.length - 2]).toBe(0xff);
        expect(out[out.length - 1]).toBe(0xd9);
    });

    it("zeroes a TIFF's GPS data in place", async () => {
        const tiff = new Uint8Array(exifTiff(1));
        const out = await bytesOf(
            await stripLocationMetadata(file(tiff, "a.tif", "image/tiff")),
        );
        expect(out.length).toBe(tiff.length);
        expect(out.subarray(38).every((x) => x === 0)).toBe(true);
    });

    it("blanks an MP4 location atom without changing the size", async () => {
        const box = (type: number[], body: number[]) => [
            0,
            0,
            0,
            8 + body.length,
            ...type,
            ...body,
        ];
        const xyz = box([0xa9, 0x78, 0x79, 0x7a], enc("+12.3456-045.6789/"));
        const udta = box(enc("udta"), xyz);
        const moov = box(enc("moov"), udta);
        const ftyp = box(enc("ftyp"), enc("isom\0\0\0\0isom"));
        const mp4 = new Uint8Array([...ftyp, ...moov]);
        const out = await bytesOf(
            await stripLocationMetadata(file(mp4, "a.mp4", "video/mp4")),
        );
        expect(out.length).toBe(mp4.length);
        expect(text(out)).not.toContain("12.3456");
        expect(text(out)).toContain("free");
    });

    it("returns unrecognised files untouched", async () => {
        const f = file(new Uint8Array(enc("hello")), "a.txt", "text/plain");
        expect(await stripLocationMetadata(f)).toBe(f);
    });
});
