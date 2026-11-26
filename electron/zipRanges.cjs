// Reads a zip archive's directory from byte ranges, so single files can be
// taken out of a large remote archive without downloading all of it. Pure
// functions over Buffers: the caller does the HTTP range requests and passes
// the bytes in. Only stored (0) and deflated (8) entries are supported, and
// encrypted entries are refused.

const zlib = require("zlib");

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const EOCD_SIZE = 22;
const EOCD64_LOCATOR_SIZE = 20;
const EOCD64_SIZE = 56;
const CENTRAL_SIZE = 46;
const LOCAL_SIZE = 30;
const MAX_COMMENT = 0xffff;
const MARK32 = 0xffffffff;
const MARK16 = 0xffff;
const ZIP64_EXTRA_ID = 0x0001;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

// The most bytes from the end of an archive that can hold its end record:
// the fixed record plus the longest possible comment.
const TAIL_BYTES = EOCD_SIZE + MAX_COMMENT;

function readU64(buf, off) {
    const lo = buf.readUInt32LE(off);
    const hi = buf.readUInt32LE(off + 4);
    if (hi > 0x1fffff) throw new Error("zip: 64-bit value too large");
    return hi * 0x100000000 + lo;
}

// Position of the end-of-central-directory record in `tail`, or -1. The
// record must end exactly at the end of `tail` once its comment is counted,
// which rules out a signature that merely appears inside the comment.
function findEocd(tail) {
    const minPos = Math.max(0, tail.length - TAIL_BYTES);
    for (let pos = tail.length - EOCD_SIZE; pos >= minPos; pos--) {
        if (tail.readUInt32LE(pos) !== SIG_EOCD) continue;
        const commentLen = tail.readUInt16LE(pos + 20);
        if (pos + EOCD_SIZE + commentLen === tail.length) return pos;
    }
    return -1;
}

// `tail` holds the last bytes of an archive of `total` bytes. Returns
// { cdOffset, cdSize, count } when the central directory is located, or
// { zip64Locator } when the 64-bit end record (at that absolute offset)
// must be read first with readZip64EndRecord. Throws if the archive is not
// a zip this module can read.
function locateCentralDirectory(tail, total) {
    const eocd = findEocd(tail);
    if (eocd < 0) throw new Error("zip: end of central directory not found");
    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (count === MARK16 || cdSize === MARK32 || cdOffset === MARK32) {
        const loc = eocd - EOCD64_LOCATOR_SIZE;
        if (loc < 0 || tail.readUInt32LE(loc) !== SIG_EOCD64_LOCATOR) {
            throw new Error("zip: ZIP64 locator missing");
        }
        return { zip64Locator: readU64(tail, loc + 8) };
    }
    if (cdOffset + cdSize > total) {
        throw new Error("zip: central directory lies outside the archive");
    }
    return { cdOffset, cdSize, count };
}

// The 64-bit end record: { cdOffset, cdSize, count }. `buf` starts at the
// record (its locator's offset) and must hold at least its fixed 56 bytes.
function readZip64EndRecord(buf) {
    if (buf.length < EOCD64_SIZE || buf.readUInt32LE(0) !== SIG_EOCD64) {
        throw new Error("zip: ZIP64 end record missing");
    }
    return {
        count: readU64(buf, 32),
        cdSize: readU64(buf, 40),
        cdOffset: readU64(buf, 48),
    };
}

// The central directory bytes (`buf`, `count` records) as entries:
// { name, flags, method, compSize, uncompSize, localOffset }.
function parseCentralDirectory(buf, count) {
    const entries = [];
    let off = 0;
    for (let i = 0; i < count; i++) {
        if (off + CENTRAL_SIZE > buf.length) {
            throw new Error("zip: central directory truncated");
        }
        if (buf.readUInt32LE(off) !== SIG_CENTRAL) {
            throw new Error("zip: bad central directory record");
        }
        const flags = buf.readUInt16LE(off + 8);
        const method = buf.readUInt16LE(off + 10);
        let compSize = buf.readUInt32LE(off + 20);
        let uncompSize = buf.readUInt32LE(off + 24);
        const nameLen = buf.readUInt16LE(off + 28);
        const extraLen = buf.readUInt16LE(off + 30);
        const commentLen = buf.readUInt16LE(off + 32);
        let localOffset = buf.readUInt32LE(off + 42);
        const nameEnd = off + CENTRAL_SIZE + nameLen;
        const extraEnd = nameEnd + extraLen;
        if (extraEnd + commentLen > buf.length) {
            throw new Error("zip: central directory truncated");
        }
        const name = buf.toString("utf8", off + CENTRAL_SIZE, nameEnd);
        if (
            uncompSize === MARK32 ||
            compSize === MARK32 ||
            localOffset === MARK32
        ) {
            // The 64-bit values, in order, for each field that overflowed.
            const zip64 = findExtra(buf, nameEnd, extraEnd, ZIP64_EXTRA_ID);
            if (!zip64) throw new Error(`zip: ${name} has no ZIP64 extra`);
            let p = 0;
            if (uncompSize === MARK32) {
                uncompSize = readU64(zip64, p);
                p += 8;
            }
            if (compSize === MARK32) {
                compSize = readU64(zip64, p);
                p += 8;
            }
            if (localOffset === MARK32) localOffset = readU64(zip64, p);
        }
        entries.push({
            name,
            flags,
            method,
            compSize,
            uncompSize,
            localOffset,
        });
        off = extraEnd + commentLen;
    }
    return entries;
}

// The data of the first extra field with `id` in buf[start, end), or null.
function findExtra(buf, start, end, id) {
    let p = start;
    while (p + 4 <= end) {
        const fieldId = buf.readUInt16LE(p);
        const size = buf.readUInt16LE(p + 2);
        if (p + 4 + size > end) break;
        if (fieldId === id) return buf.subarray(p + 4, p + 4 + size);
        p += 4 + size;
    }
    return null;
}

// The fixed part of a local file header: where its data starts relative to
// the header. `buf` is at least the first 30 bytes of the header. The local
// name and extra lengths can differ from the central directory's, so the
// data offset comes from here.
function readLocalHeader(buf) {
    if (buf.length < LOCAL_SIZE || buf.readUInt32LE(0) !== SIG_LOCAL) {
        throw new Error("zip: bad local file header");
    }
    const nameLen = buf.readUInt16LE(26);
    const extraLen = buf.readUInt16LE(28);
    return { dataOffset: LOCAL_SIZE + nameLen + extraLen };
}

// The uncompressed bytes of an entry, from its compressed `data`. Checks the
// size the directory promised, so a bad archive cannot yield a short or
// oversized file.
function inflateEntry(entry, data) {
    if (entry.flags & 1) throw new Error(`zip: ${entry.name} is encrypted`);
    if (data.length !== entry.compSize) {
        throw new Error(`zip: ${entry.name} data is the wrong length`);
    }
    let out;
    if (entry.method === METHOD_STORED) {
        out = data;
    } else if (entry.method === METHOD_DEFLATE) {
        out = zlib.inflateRawSync(data, {
            maxOutputLength: entry.uncompSize + 1,
        });
    } else {
        throw new Error(`zip: ${entry.name} uses method ${entry.method}`);
    }
    if (out.length !== entry.uncompSize) {
        throw new Error(`zip: ${entry.name} inflated to the wrong size`);
    }
    return out;
}

module.exports = {
    TAIL_BYTES,
    LOCAL_SIZE,
    locateCentralDirectory,
    readZip64EndRecord,
    parseCentralDirectory,
    readLocalHeader,
    inflateEntry,
};
