// The Twemoji SVGs as one compressed file for the desktop app. Loose, the
// ~4000 files are 10 MB in app.asar (which does not compress) and ~20 MB once
// a web bundle unpacks them to disk, a 4 KB block each. Packed: 1.2 MB.
//
// The files are sorted by name and brotli-compressed in chunks of
// CHUNK_FILES, so one lookup decodes ~600 KB (about a millisecond) instead of
// the whole set, and neighbouring codepoints (skin tones, flags) share a chunk.
// Shared by the build (scripts/pack-twemoji.mjs) and the local server
// (main.cjs), so the two cannot drift.
//
// Layout: "ZT1\n" | uint32 BE index length | index JSON | chunks, back to back
// The index is { c: [[offset, length]], f: { name: [chunk, start, length] } }
// with chunk offsets counted from the end of the index.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const MAGIC = Buffer.from("ZT1\n", "latin1");
const CHUNK_FILES = 128;
// Decoded chunks kept around: a message's emoji are often neighbours.
const CACHED_CHUNKS = 2;

/** Where the pack sits in the built site, next to the loose files. */
const PACK_PATH = "twemoji/svg.pack";
const SVG_DIR = "twemoji/svg/";

/** A loose SVG the pack stands in for (a POSIX path relative to the site). */
function isPackedPath(p) {
    return p.startsWith(SVG_DIR) && p.endsWith(".svg");
}

/** Pack every .svg in `dir` into a buffer. */
function packTwemoji(dir) {
    const names = fs
        .readdirSync(dir)
        .filter((n) => n.endsWith(".svg"))
        .sort();
    const index = { c: [], f: {} };
    const chunks = [];
    let offset = 0;
    for (let i = 0; i < names.length; i += CHUNK_FILES) {
        const parts = [];
        let start = 0;
        for (const name of names.slice(i, i + CHUNK_FILES)) {
            const data = fs.readFileSync(path.join(dir, name));
            index.f[name.slice(0, -4)] = [chunks.length, start, data.length];
            parts.push(data);
            start += data.length;
        }
        const chunk = zlib.brotliCompressSync(Buffer.concat(parts), {
            params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                [zlib.constants.BROTLI_PARAM_MODE]:
                    zlib.constants.BROTLI_MODE_TEXT,
            },
        });
        index.c.push([offset, chunk.length]);
        chunks.push(chunk);
        offset += chunk.length;
    }
    const indexBuf = Buffer.from(JSON.stringify(index), "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(indexBuf.length);
    return Buffer.concat([MAGIC, len, indexBuf, ...chunks]);
}

/**
 * Open a pack file for lookups. Null when there is none (a dev build, or a
 * site from before packs), so the caller falls back to the loose files.
 */
function openTwemojiPack(file) {
    let buf;
    try {
        buf = fs.readFileSync(file);
    } catch {
        return null;
    }
    if (buf.length < 8 || !buf.subarray(0, 4).equals(MAGIC)) return null;
    const dataStart = 8 + buf.readUInt32BE(4);
    const index = JSON.parse(buf.subarray(8, dataStart).toString("utf8"));
    const cache = new Map();

    function chunk(n) {
        let data = cache.get(n);
        if (data) {
            cache.delete(n);
        } else {
            const [offset, length] = index.c[n];
            const at = dataStart + offset;
            data = zlib.brotliDecompressSync(buf.subarray(at, at + length));
            if (cache.size >= CACHED_CHUNKS)
                cache.delete(cache.keys().next().value);
        }
        cache.set(n, data);
        return data;
    }

    return {
        /** The SVG named `name` (no extension), or null. */
        get(name) {
            if (!Object.hasOwn(index.f, name)) return null;
            const [n, start, length] = index.f[name];
            return chunk(n).subarray(start, start + length);
        },
    };
}

module.exports = {
    PACK_PATH,
    isPackedPath,
    packTwemoji,
    openTwemojiPack,
};
