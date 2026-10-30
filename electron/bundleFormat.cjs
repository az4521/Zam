// The web-bundle archive: the built site (../build) as one file the desktop
// app can download, check and unpack without reinstalling (bundleUpdater.cjs).
// Shared by the release script (pack, sign) and the app (verify, unpack), so
// the two cannot drift.
//
// Layout, gzipped as a whole:
//   "ZB1\n" | uint32 BE index length | index JSON | file bytes, back to back
// The index is [{ p: "relative/posix/path", s: byteSize }] in file order.
// Not tar or zip: no dependency, no path-length limit, and the reader below is
// small enough to check that it refuses anything outside the target folder.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const MAGIC = Buffer.from("ZB1\n", "latin1");
const MAX_FILES = 50000;
const MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;

function listFiles(root) {
    const out = [];
    (function walk(dir) {
        const entries = fs
            .readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile())
                out.push(path.relative(root, full).split(path.sep).join("/"));
        }
    })(root);
    return out;
}

/** Pack the folder into an archive buffer. */
async function packBundle(root) {
    const files = listFiles(root);
    const index = [];
    const chunks = [];
    for (const p of files) {
        const data = fs.readFileSync(path.join(root, ...p.split("/")));
        index.push({ p, s: data.length });
        chunks.push(data);
    }
    const indexBuf = Buffer.from(JSON.stringify(index), "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(indexBuf.length);
    return gzip(Buffer.concat([MAGIC, len, indexBuf, ...chunks]), {
        level: 9,
    });
}

/** A path from an archive is only ever a plain relative POSIX path. */
function isSafeEntryPath(p) {
    if (typeof p !== "string" || p === "" || p.length > 400) return false;
    if (p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
    if (/(^|\/)[A-Za-z]:/.test(p)) return false;
    return p.split("/").every((s) => s !== "" && s !== "." && s !== "..");
}

/**
 * Unpack an archive buffer into `destDir` (which must not exist yet). Throws
 * on anything malformed; the caller deletes `destDir` on failure.
 */
async function unpackBundle(archive, destDir) {
    const buf = await gunzip(archive, { maxOutputLength: MAX_UNPACKED_BYTES });
    if (buf.length < MAGIC.length + 4 || !buf.subarray(0, 4).equals(MAGIC))
        throw new Error("not a web bundle");
    const indexLen = buf.readUInt32BE(4);
    let offset = 8 + indexLen;
    if (offset > buf.length) throw new Error("web bundle index is truncated");
    const index = JSON.parse(buf.subarray(8, offset).toString("utf8"));
    if (!Array.isArray(index) || index.length > MAX_FILES)
        throw new Error("web bundle index is invalid");
    const root = path.resolve(destDir);
    fs.mkdirSync(root, { recursive: true });
    const seen = new Set();
    for (const entry of index) {
        if (
            !entry ||
            !isSafeEntryPath(entry.p) ||
            !Number.isInteger(entry.s) ||
            entry.s < 0 ||
            seen.has(entry.p)
        )
            throw new Error("web bundle has an invalid entry");
        seen.add(entry.p);
        const end = offset + entry.s;
        if (end > buf.length) throw new Error("web bundle is truncated");
        const target = path.resolve(root, ...entry.p.split("/"));
        if (!target.startsWith(root + path.sep))
            throw new Error("web bundle entry escapes its folder");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, buf.subarray(offset, end));
        offset = end;
    }
    if (!seen.has("index.html"))
        throw new Error("web bundle has no index.html");
}

/**
 * The exact bytes that are signed. Everything the app trusts about a bundle is
 * in here: which release, which shell it runs on, and which file.
 */
function manifestSigningPayload(m) {
    return [
        "zam-web-bundle-v1",
        m.version,
        m.shellHash,
        m.file,
        m.sha512,
        String(m.size),
    ].join("\n");
}

function signManifest(manifest, privateKeyDerBase64) {
    const key = crypto.createPrivateKey({
        key: Buffer.from(privateKeyDerBase64, "base64"),
        format: "der",
        type: "pkcs8",
    });
    return crypto
        .sign(null, Buffer.from(manifestSigningPayload(manifest)), key)
        .toString("base64");
}

function verifyManifest(manifest, publicKeyDerBase64) {
    try {
        if (
            !manifest ||
            typeof manifest.version !== "string" ||
            typeof manifest.shellHash !== "string" ||
            typeof manifest.file !== "string" ||
            typeof manifest.sha512 !== "string" ||
            !Number.isInteger(manifest.size) ||
            typeof manifest.signature !== "string"
        )
            return false;
        const key = crypto.createPublicKey({
            key: Buffer.from(publicKeyDerBase64, "base64"),
            format: "der",
            type: "spki",
        });
        return crypto.verify(
            null,
            Buffer.from(manifestSigningPayload(manifest)),
            key,
            Buffer.from(manifest.signature, "base64"),
        );
    } catch {
        return false;
    }
}

module.exports = {
    packBundle,
    unpackBundle,
    isSafeEntryPath,
    manifestSigningPayload,
    signManifest,
    verifyManifest,
};
