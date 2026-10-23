import { describe, it, expect } from "vitest";
import jpeg from "jpeg-js";
import { jpegToProgressive } from "./jpegProgressive";
import { FIXTURES } from "./jpegProgressive.fixtures";

const bytesOf = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

function decode(data: Uint8Array) {
    return jpeg.decode(data, { useTArray: true, formatAsRGBA: false });
}

function markers(data: Uint8Array): number[] {
    const found: number[] = [];
    let p = 2;
    while (p + 3 < data.length) {
        const m = data[p + 1];
        found.push(m);
        if (m === 0xda) break;
        p += 2 + ((data[p + 2] << 8) | data[p + 3]);
    }
    return found;
}

describe("jpegToProgressive", () => {
    for (const [name, b64] of Object.entries(FIXTURES)) {
        it(`rewrites ${name} as progressive with identical pixels`, () => {
            const src = bytesOf(b64);
            const out = jpegToProgressive(src);
            expect(out).not.toBeNull();
            expect(markers(out!)).toContain(0xc2);
            expect(markers(out!)).not.toContain(0xc0);
            const a = decode(src);
            const b = decode(out!);
            expect([b.width, b.height]).toEqual([a.width, a.height]);
            expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true);
        });
    }

    it("keeps EXIF and ICC segments byte for byte", () => {
        const src = bytesOf(FIXTURES.exif);
        const out = jpegToProgressive(src)!;
        const app = (d: Uint8Array, m: number) => {
            const segs: string[] = [];
            let p = 2;
            while (d[p + 1] !== 0xda) {
                const len = (d[p + 2] << 8) | d[p + 3];
                if (d[p + 1] === m) {
                    segs.push(
                        Buffer.from(d.subarray(p, p + 2 + len)).toString("hex"),
                    );
                }
                p += 2 + len;
            }
            return segs;
        };
        expect(app(out, 0xe1)).toEqual(app(src, 0xe1));
        expect(app(out, 0xe2)).toEqual(app(src, 0xe2));
        expect(app(src, 0xe1)).toHaveLength(1);
    });

    it("leaves an already progressive file alone", () => {
        const once = jpegToProgressive(bytesOf(FIXTURES.ycc420))!;
        expect(jpegToProgressive(once)).toBeNull();
    });

    it("refuses data after the end of the image", () => {
        const src = bytesOf(FIXTURES.gray);
        const withTail = new Uint8Array(src.length + 4);
        withTail.set(src);
        withTail.set([1, 2, 3, 4], src.length);
        expect(jpegToProgressive(withTail)).toBeNull();
    });

    it("refuses truncated entropy data", () => {
        const src = bytesOf(FIXTURES.q100);
        const cut = new Uint8Array(src.length - 400 + 2);
        cut.set(src.subarray(0, src.length - 400));
        cut.set([0xff, 0xd9], src.length - 400);
        expect(jpegToProgressive(cut)).toBeNull();
    });

    it("refuses things that are not JPEGs", () => {
        expect(
            jpegToProgressive(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
        ).toBeNull();
        expect(jpegToProgressive(new Uint8Array(0))).toBeNull();
        expect(
            jpegToProgressive(new Uint8Array([0xff, 0xd8, 0xff])),
        ).toBeNull();
    });
});
