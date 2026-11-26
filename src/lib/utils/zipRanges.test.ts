import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import zlib from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
    locateCentralDirectory,
    readZip64EndRecord,
    parseCentralDirectory,
    readLocalHeader,
    inflateEntry,
    TAIL_BYTES,
} = require(join(__dirname, "../../../electron/zipRanges.cjs"));

interface Input {
    name: string;
    data: Buffer;
    deflate: boolean;
}

// A small zip in memory, laid out the way zip tools write one: local
// header + data per file, then the central directory and the end record.
// `zip64` adds a ZIP64 end record, a locator, and 64-bit extras for offsets.
function buildZip(files: Input[], { zip64 = false, comment = "" } = {}) {
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const f of files) {
        const packed = f.deflate
            ? zlib.deflateRawSync(f.data)
            : Buffer.from(f.data);
        const name = Buffer.from(f.name, "utf8");
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(f.deflate ? 8 : 0, 8);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(f.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        parts.push(local, name, packed);

        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(20, 6);
        cd.writeUInt16LE(f.deflate ? 8 : 0, 10);
        cd.writeUInt32LE(packed.length, 20);
        cd.writeUInt32LE(f.data.length, 24);
        cd.writeUInt16LE(name.length, 28);
        if (zip64) {
            // Offset goes in the 64-bit extra, the 32-bit field is 0xffffffff.
            cd.writeUInt32LE(0xffffffff, 42);
            const extra = Buffer.alloc(12);
            extra.writeUInt16LE(0x0001, 0);
            extra.writeUInt16LE(8, 2);
            extra.writeUInt32LE(offset, 4);
            cd.writeUInt16LE(extra.length, 30);
            central.push(cd, name, extra);
        } else {
            cd.writeUInt32LE(offset, 42);
            central.push(cd, name);
        }
        offset += local.length + name.length + packed.length;
    }
    const cdBuf = Buffer.concat(central);
    const cdOffset = offset;
    const commentBuf = Buffer.from(comment, "utf8");
    if (zip64) {
        const eocd64Offset = cdOffset + cdBuf.length;
        const eocd64 = Buffer.alloc(56);
        eocd64.writeUInt32LE(0x06064b50, 0);
        eocd64.writeBigUInt64LE(44n, 4);
        eocd64.writeUInt16LE(45, 12);
        eocd64.writeUInt16LE(45, 14);
        eocd64.writeUInt32LE(0, 16);
        eocd64.writeUInt32LE(0, 20);
        eocd64.writeBigUInt64LE(BigInt(files.length), 24);
        eocd64.writeBigUInt64LE(BigInt(files.length), 32);
        eocd64.writeBigUInt64LE(BigInt(cdBuf.length), 40);
        eocd64.writeBigUInt64LE(BigInt(cdOffset), 48);
        const loc = Buffer.alloc(20);
        loc.writeUInt32LE(0x07064b50, 0);
        loc.writeBigUInt64LE(BigInt(eocd64Offset), 8);
        loc.writeUInt32LE(1, 16);
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0xffff, 8);
        eocd.writeUInt16LE(0xffff, 10);
        eocd.writeUInt32LE(0xffffffff, 12);
        eocd.writeUInt32LE(0xffffffff, 16);
        eocd.writeUInt16LE(commentBuf.length, 20);
        return Buffer.concat([...parts, cdBuf, eocd64, loc, eocd, commentBuf]);
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(cdOffset, 16);
    eocd.writeUInt16LE(commentBuf.length, 20);
    return Buffer.concat([...parts, cdBuf, eocd, commentBuf]);
}

// Reads the directory from an archive the way the range reader does: the
// tail first, then (for ZIP64) the end record, then the central directory.
function directoryOf(zip: Buffer) {
    const tail = zip.subarray(Math.max(0, zip.length - TAIL_BYTES));
    let cd = locateCentralDirectory(tail, zip.length);
    if (cd.zip64Locator !== undefined) {
        cd = readZip64EndRecord(
            zip.subarray(cd.zip64Locator, cd.zip64Locator + 56),
        );
    }
    const buf = zip.subarray(cd.cdOffset, cd.cdOffset + cd.cdSize);
    return parseCentralDirectory(buf, cd.count);
}

function extract(zip: Buffer, name: string): Buffer {
    const entry = directoryOf(zip).find(
        (e: { name: string }) => e.name === name,
    );
    const head = zip.subarray(entry.localOffset, entry.localOffset + 30);
    const { dataOffset } = readLocalHeader(head);
    const start = entry.localOffset + dataOffset;
    return inflateEntry(entry, zip.subarray(start, start + entry.compSize));
}

const files: Input[] = [
    {
        name: "core/win-capture/data/a.dll",
        data: Buffer.from("hello dll"),
        deflate: true,
    },
    {
        name: "core/win-capture/data/b.json",
        data: Buffer.from('{"x":1}'),
        deflate: false,
    },
    {
        name: "core/win-capture/data/c.exe",
        data: Buffer.alloc(5000, 7),
        deflate: true,
    },
];

describe("zipRanges", () => {
    it("lists every entry with its sizes and offsets", () => {
        const entries = directoryOf(buildZip(files));
        expect(entries.map((e: { name: string }) => e.name)).toEqual(
            files.map((f) => f.name),
        );
        expect(entries[0].method).toBe(8);
        expect(entries[1].method).toBe(0);
        expect(entries[2].uncompSize).toBe(5000);
        expect(entries[1].localOffset).toBeGreaterThan(entries[0].localOffset);
    });

    it("extracts stored and deflated entries byte for byte", () => {
        const zip = buildZip(files);
        expect(extract(zip, files[0].name).toString()).toBe("hello dll");
        expect(extract(zip, files[1].name).toString()).toBe('{"x":1}');
        expect(extract(zip, files[2].name).equals(files[2].data)).toBe(true);
    });

    it("finds the end record past a comment that looks like one", () => {
        const fake = Buffer.from([0x50, 0x4b, 0x05, 0x06]).toString("latin1");
        const zip = buildZip(files, { comment: `x${fake}y` });
        expect(extract(zip, files[0].name).toString()).toBe("hello dll");
    });

    it("reads ZIP64 archives through the end record and 64-bit offsets", () => {
        const zip = buildZip(files, { zip64: true });
        const entries = directoryOf(zip);
        expect(entries.length).toBe(3);
        expect(entries[1].localOffset).toBe(
            directoryOf(buildZip(files))[1].localOffset,
        );
        expect(extract(zip, files[2].name).equals(files[2].data)).toBe(true);
    });

    it("refuses a truncated or non-zip tail", () => {
        expect(() => locateCentralDirectory(Buffer.alloc(100), 100)).toThrow(
            /end of central directory/,
        );
    });

    it("refuses an entry whose inflated size is not what the directory says", () => {
        const zip = buildZip([files[0]]);
        const entry = directoryOf(zip)[0];
        entry.uncompSize += 1;
        expect(() =>
            inflateEntry(entry, zlib.deflateRawSync(files[0].data)),
        ).toThrow(/wrong size/);
    });

    it("refuses encrypted entries", () => {
        const zip = buildZip([files[1]]);
        const entry = directoryOf(zip)[0];
        entry.flags |= 1;
        expect(() => inflateEntry(entry, Buffer.from('{"x":1}'))).toThrow(
            /encrypted/,
        );
    });
});
