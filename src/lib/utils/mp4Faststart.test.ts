import { describe, it, expect } from "vitest";
import { faststartMp4 } from "./mp4Faststart";

const enc = new TextEncoder();

function u32(n: number): number[] {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function u64(n: number): number[] {
    return [...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)];
}

function box(type: string, payload: number[]): number[] {
    return [...u32(8 + payload.length), ...enc.encode(type), ...payload];
}

/** stco / co64 full box holding `offsets`. */
function chunkTable(type: "stco" | "co64", offsets: number[]): number[] {
    const wide = type === "co64";
    return box(type, [
        0,
        0,
        0,
        0, // version + flags
        ...u32(offsets.length),
        ...offsets.flatMap((o) => (wide ? u64(o) : u32(o))),
    ]);
}

function moovWith(table: number[], extra: number[] = []): number[] {
    const stbl = box("stbl", table);
    const minf = box("minf", stbl);
    const mdia = box("mdia", minf);
    return box("moov", [...box("trak", mdia), ...extra]);
}

const FTYP = box("ftyp", [
    ...enc.encode("isom"),
    ...u32(512),
    ...enc.encode("isom"),
]);

/** ftyp, then `mdat` holding `media`, then moov built by `makeMoov`. The chunk
 *  offsets it is given are where the media really is in this (slow) layout. */
function slowLayout(
    media: number[],
    makeMoov: (offsets: number[]) => number[],
    chunks = [0, 8],
) {
    const mdatStart = FTYP.length;
    const mdat = box("mdat", media);
    const offsets = chunks.map((c) => mdatStart + 8 + c);
    return { mdatStart, mdat, moov: makeMoov(offsets) };
}

function file(...parts: number[][]): File {
    return new File([new Uint8Array(parts.flat())], "clip.mp4", {
        type: "video/mp4",
    });
}

async function bytesOf(f: Blob): Promise<number[]> {
    return [...new Uint8Array(await f.arrayBuffer())];
}

/** Chunk offsets read back out of a (stco-based) file, in order. */
function stcoOffsets(bytes: number[]): number[] {
    const at = bytes.findIndex(
        (_, i) =>
            bytes[i] === 0x73 &&
            bytes[i + 1] === 0x74 &&
            bytes[i + 2] === 0x63 &&
            bytes[i + 3] === 0x6f,
    );
    const count = new DataView(new Uint8Array(bytes).buffer).getUint32(at + 8);
    const view = new DataView(new Uint8Array(bytes).buffer);
    return Array.from({ length: count }, (_, i) =>
        view.getUint32(at + 12 + i * 4),
    );
}

function order(bytes: number[]): string[] {
    const out: string[] = [];
    const view = new DataView(new Uint8Array(bytes).buffer);
    for (let at = 0; at < bytes.length;) {
        const size = view.getUint32(at);
        out.push(String.fromCharCode(...bytes.slice(at + 4, at + 8)));
        at += size;
    }
    return out;
}

describe("faststartMp4", () => {
    const MEDIA = Array.from({ length: 40 }, (_, i) => 100 + i);

    it("puts moov before mdat and shifts every chunk offset by its size", async () => {
        const { mdat, moov } = slowLayout(MEDIA, (o) =>
            moovWith(chunkTable("stco", o)),
        );
        const input = file(FTYP, mdat, moov);
        const out = await faststartMp4(input);
        const got = await bytesOf(out);

        expect(order(got)).toEqual(["ftyp", "moov", "mdat"]);
        expect(got.length).toBe(FTYP.length + mdat.length + moov.length);
        // Offsets were [8+8, 8+16] -> shifted by the moov size.
        const expected = [FTYP.length + 8, FTYP.length + 16].map(
            (o) => o + moov.length,
        );
        expect(stcoOffsets(got)).toEqual(expected);
        // And they point at the same media bytes as before.
        const mdatPayloadAt = FTYP.length + moov.length + 8;
        expect(got.slice(mdatPayloadAt, mdatPayloadAt + MEDIA.length)).toEqual(
            MEDIA,
        );
        expect(got[expected[0]]).toBe(MEDIA[0]);
        expect(got[expected[1]]).toBe(MEDIA[8]);
        expect(out.name).toBe("clip.mp4");
        expect(out.type).toBe("video/mp4");
    });

    it("handles 64-bit chunk offsets", async () => {
        const { mdat, moov } = slowLayout(MEDIA, (o) =>
            moovWith(chunkTable("co64", o)),
        );
        const out = await faststartMp4(file(FTYP, mdat, moov));
        const got = await bytesOf(out);
        expect(order(got)).toEqual(["ftyp", "moov", "mdat"]);
        const at = got.findIndex(
            (_, i) =>
                got[i] === 0x63 &&
                got[i + 1] === 0x6f &&
                got[i + 2] === 0x36 &&
                got[i + 3] === 0x34,
        );
        const view = new DataView(new Uint8Array(got).buffer);
        expect(Number(view.getBigUint64(at + 12))).toBe(
            FTYP.length + 8 + moov.length,
        );
    });

    it("keeps boxes that sit between mdat and moov, and trailing ones", async () => {
        const { mdat, moov } = slowLayout(MEDIA, (o) =>
            moovWith(chunkTable("stco", o)),
        );
        const free = box("free", [1, 2, 3, 4]);
        const out = await faststartMp4(file(FTYP, mdat, free, moov, free));
        expect(order(await bytesOf(out))).toEqual([
            "ftyp",
            "moov",
            "mdat",
            "free",
            "free",
        ]);
    });

    it("patches every track's table", async () => {
        const { mdat, moov } = slowLayout(MEDIA, (o) =>
            box("moov", [
                ...box(
                    "trak",
                    box(
                        "mdia",
                        box("minf", box("stbl", chunkTable("stco", [o[0]]))),
                    ),
                ),
                ...box(
                    "trak",
                    box(
                        "mdia",
                        box("minf", box("stbl", chunkTable("stco", [o[1]]))),
                    ),
                ),
            ]),
        );
        const out = await faststartMp4(file(FTYP, mdat, moov));
        const got = await bytesOf(out);
        const view = new DataView(new Uint8Array(got).buffer);
        const tables: number[] = [];
        for (let i = 0; i < got.length - 4; i++) {
            if (
                got[i] === 0x73 &&
                got[i + 1] === 0x74 &&
                got[i + 2] === 0x63 &&
                got[i + 3] === 0x6f
            ) {
                tables.push(view.getUint32(i + 12));
            }
        }
        expect(tables).toEqual([
            FTYP.length + 8 + moov.length,
            FTYP.length + 16 + moov.length,
        ]);
    });

    describe("returns the original file untouched", () => {
        async function untouched(input: File) {
            expect(await faststartMp4(input)).toBe(input);
        }

        it("when moov is already first", async () => {
            const moov = moovWith(chunkTable("stco", [FTYP.length + 100 + 8]));
            await untouched(file(FTYP, moov, box("mdat", MEDIA)));
        });

        it("for a fragmented file", async () => {
            const { mdat } = slowLayout(MEDIA, () => []);
            const moov = moovWith(
                chunkTable("stco", [FTYP.length + 8]),
                box("mvex", box("trex", new Array(24).fill(0))),
            );
            await untouched(file(FTYP, mdat, moov));
            await untouched(file(FTYP, box("moof", [0, 0, 0, 0]), mdat, moov));
        });

        it("when a chunk offset does not land in an mdat afterwards", async () => {
            const { mdat, moov } = slowLayout(MEDIA, () =>
                moovWith(chunkTable("stco", [4])),
            );
            await untouched(file(FTYP, mdat, moov));
        });

        it("when a 32-bit offset would overflow", async () => {
            const { mdat, moov } = slowLayout(MEDIA, () =>
                moovWith(chunkTable("stco", [0xfffffff0])),
            );
            await untouched(file(FTYP, mdat, moov));
        });

        it("when there is no chunk table", async () => {
            const { mdat } = slowLayout(MEDIA, () => []);
            await untouched(
                file(
                    FTYP,
                    mdat,
                    box("moov", box("mvhd", new Array(100).fill(0))),
                ),
            );
        });

        it("when there are two moov boxes or none", async () => {
            const { mdat, moov } = slowLayout(MEDIA, (o) =>
                moovWith(chunkTable("stco", o)),
            );
            await untouched(file(FTYP, mdat, moov, moov));
            await untouched(file(FTYP, mdat));
        });

        it("when media sits on both sides of the index", async () => {
            const { mdat, moov } = slowLayout(MEDIA, (o) =>
                moovWith(chunkTable("stco", o)),
            );
            await untouched(file(FTYP, mdat, moov, mdat));
        });

        it("when a top-level meta box could hold file offsets", async () => {
            const { mdat, moov } = slowLayout(MEDIA, (o) =>
                moovWith(chunkTable("stco", o)),
            );
            await untouched(file(FTYP, box("meta", [0, 0, 0, 0]), mdat, moov));
        });

        it("for something that is not an MP4, or is cut short", async () => {
            await untouched(file([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
            await untouched(file([]));
            const { mdat, moov } = slowLayout(MEDIA, (o) =>
                moovWith(chunkTable("stco", o)),
            );
            const whole = [...FTYP, ...mdat, ...moov];
            await untouched(file(whole.slice(0, whole.length - 5)));
        });
    });
});
