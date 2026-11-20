// Reads the user's favourite GIFs from the Discord desktop app's synced
// settings. Discord keeps them in its Chromium localStorage LevelDB, which is
// read here directly and read-only (Discord's LOCK file is never opened, and
// the .log/.ldb files are readable while Discord runs).
//
// The same database holds the login token under other keys. Only keys that
// start with the UserSettingsProtoStore prefix are kept; every other entry is
// dropped as soon as it is parsed, and no value is ever logged.
//
// No dependencies: a small LevelDB reader with a Snappy decompressor.

const fs = require("fs");
const os = require("os");
const path = require("path");

// Chromium stores localStorage keys as origin + \0 + \1 (latin-1 key) + name.
const ORIGIN_KEY = "_https://discord.com\x00\x01";
const SETTINGS_PREFIX = "UserSettingsProtoStore:parsed:2:";
const LOG_BLOCK = 32768;
// LevelDB table magic (0xdb4775248b80fb57), little-endian on disk.
const TABLE_MAGIC = Buffer.from("57fb808b247547db", "hex");

// Discord-owned hosts: their gif links are not the user's own favourites and
// are skipped (counted as skippedDiscord).
const DISCORD_HOSTS = [
    "discordapp.com",
    "discordapp.net",
    "discord.com",
    "discord.gg",
];
// Discord proxy and attachment links expire, so they are never kept as a src.
const DISCORD_SRC_HOSTS = ["discordapp.net", "discordapp.com"];

function logCode(err) {
    if (err && err.code === "ENOENT") return;
    console.warn(
        `[discord-favourites] skipped: ${(err && err.code) || "read error"}`,
    );
}

// --- Varints and Snappy ------------------------------------------------------

// Returns { value, next } or null when the varint runs past the buffer.
function readVarint(buf, off) {
    let value = 0;
    let mult = 1;
    for (let i = 0; i < 10; i++) {
        if (off >= buf.length) return null;
        const b = buf[off++];
        value += (b & 0x7f) * mult;
        if ((b & 0x80) === 0) return { value, next: off };
        mult *= 128;
    }
    return null;
}

// Raw Snappy format. Throws on corrupt input; callers treat that as a skipped
// block.
function snappyDecompress(buf) {
    const head = readVarint(buf, 0);
    if (!head) throw new Error("snappy: bad length");
    const want = head.value;
    const out = Buffer.alloc(want);
    let o = 0;
    let p = head.next;
    while (p < buf.length) {
        const tag = buf[p++];
        const kind = tag & 3;
        if (kind === 0) {
            let len = tag >> 2;
            if (len >= 60) {
                // 60..63 mean the length-1 follows in 1..4 little-endian bytes.
                const extra = len - 59;
                if (p + extra > buf.length) throw new Error("snappy: literal");
                len = 0;
                for (let i = 0; i < extra; i++) {
                    len += buf[p + i] * 2 ** (8 * i);
                }
                p += extra;
            }
            len += 1;
            if (p + len > buf.length || o + len > want) {
                throw new Error("snappy: literal overflow");
            }
            buf.copy(out, o, p, p + len);
            p += len;
            o += len;
            continue;
        }
        let len;
        let offset;
        if (kind === 1) {
            if (p + 1 > buf.length) throw new Error("snappy: copy1");
            len = 4 + ((tag >> 2) & 7);
            offset = ((tag >> 5) << 8) | buf[p];
            p += 1;
        } else if (kind === 2) {
            if (p + 2 > buf.length) throw new Error("snappy: copy2");
            len = (tag >> 2) + 1;
            offset = buf.readUInt16LE(p);
            p += 2;
        } else {
            if (p + 4 > buf.length) throw new Error("snappy: copy4");
            len = (tag >> 2) + 1;
            offset = buf.readUInt32LE(p);
            p += 4;
        }
        if (offset === 0 || offset > o || o + len > want) {
            throw new Error("snappy: bad copy");
        }
        // Copies may overlap the bytes they produce, so copy one at a time.
        for (let i = 0; i < len; i++) {
            out[o] = out[o - offset];
            o++;
        }
    }
    if (o !== want) throw new Error("snappy: length mismatch");
    return out;
}

// --- Write-ahead log (.log) --------------------------------------------------

// Parses one WriteBatch record into entries (one per op, seq = base + index).
// Malformed trailing ops are dropped; the ops before them are kept.
function parseWriteBatch(rec, out) {
    if (rec.length < 12) return;
    const base = rec.readBigUInt64LE(0);
    const count = rec.readUInt32LE(8);
    let off = 12;
    for (let i = 0; i < count; i++) {
        if (off >= rec.length) break;
        const tag = rec[off++];
        const k = readVarint(rec, off);
        if (!k || k.next + k.value > rec.length) break;
        off = k.next;
        const key = Buffer.from(rec.subarray(off, off + k.value));
        off += k.value;
        const seq = base + BigInt(i);
        if (tag === 0) {
            out.push({ key, seq, deleted: true });
        } else if (tag === 1) {
            const v = readVarint(rec, off);
            if (!v || v.next + v.value > rec.length) break;
            off = v.next;
            const value = Buffer.from(rec.subarray(off, off + v.value));
            off += v.value;
            out.push({ key, seq, deleted: false, value });
        } else {
            break;
        }
    }
}

function parseLogFile(buf) {
    const entries = [];
    let pos = 0;
    // Pieces of a record that spans blocks (FIRST, MIDDLE..., LAST).
    let parts = null;
    while (pos + 7 <= buf.length) {
        const inBlock = pos % LOG_BLOCK;
        const left = LOG_BLOCK - inBlock;
        // A block tail shorter than a header is padding.
        if (left < 7) {
            pos += left;
            continue;
        }
        const length = buf.readUInt16LE(pos + 4);
        const type = buf[pos + 6];
        if (
            type < 1 ||
            type > 4 ||
            inBlock + 7 + length > LOG_BLOCK ||
            pos + 7 + length > buf.length
        ) {
            // Corrupt or zeroed space: skip the rest of this block.
            parts = null;
            pos += left;
            continue;
        }
        const data = buf.subarray(pos + 7, pos + 7 + length);
        pos += 7 + length;
        if (type === 1) {
            parts = null;
            parseWriteBatch(data, entries);
        } else if (type === 2) {
            parts = [data];
        } else if (type === 3) {
            if (parts) parts.push(data);
        } else if (parts) {
            parts.push(data);
            parseWriteBatch(Buffer.concat(parts), entries);
            parts = null;
        }
    }
    return entries;
}

// --- Sorted table (.ldb) -----------------------------------------------------

// Returns { offset, size, next } for a BlockHandle at off, or null.
function readBlockHandle(buf, off, limit) {
    const offset = readVarint(buf, off);
    if (!offset) return null;
    const size = readVarint(buf, offset.next);
    if (!size || size.next > limit) return null;
    return { offset: offset.value, size: size.value, next: size.next };
}

// Block contents, or null when the block is out of range or undecodable.
function readBlock(buf, handle) {
    if (!handle || handle.offset + handle.size + 5 > buf.length) return null;
    const raw = buf.subarray(handle.offset, handle.offset + handle.size);
    const type = buf[handle.offset + handle.size];
    try {
        if (type === 0) return raw;
        if (type === 1) return snappyDecompress(raw);
    } catch {
        return null;
    }
    return null;
}

// Key/value pairs of a block. Stops at the first malformed entry and keeps
// the ones before it.
function blockEntries(block) {
    const out = [];
    if (block.length < 4) return out;
    const numRestarts = block.readUInt32LE(block.length - 4);
    const dataEnd = block.length - 4 - numRestarts * 4;
    if (dataEnd < 0) return out;
    let prev = Buffer.alloc(0);
    let off = 0;
    while (off < dataEnd) {
        const shared = readVarint(block, off);
        if (!shared) break;
        const nonShared = readVarint(block, shared.next);
        if (!nonShared) break;
        const valueLen = readVarint(block, nonShared.next);
        if (!valueLen) break;
        let p = valueLen.next;
        if (
            shared.value > prev.length ||
            p + nonShared.value + valueLen.value > dataEnd
        ) {
            break;
        }
        const key = Buffer.concat([
            prev.subarray(0, shared.value),
            block.subarray(p, p + nonShared.value),
        ]);
        p += nonShared.value;
        const value = block.subarray(p, p + valueLen.value);
        out.push({ key, value });
        prev = key;
        off = p + valueLen.value;
    }
    return out;
}

function parseTableFile(buf) {
    const out = [];
    if (buf.length < 48) return out;
    if (!buf.subarray(buf.length - 8).equals(TABLE_MAGIC)) return out;
    const footer = buf.length - 48;
    const limit = buf.length - 8;
    // The metaindex handle comes first; only the index is needed.
    const meta = readBlockHandle(buf, footer, limit);
    const indexHandle = meta && readBlockHandle(buf, meta.next, limit);
    const indexBlock = readBlock(buf, indexHandle);
    if (!indexBlock) return out;
    for (const entry of blockEntries(indexBlock)) {
        const handle = readBlockHandle(entry.value, 0, entry.value.length);
        const data = readBlock(buf, handle);
        if (!data) continue;
        for (const ent of blockEntries(data)) {
            if (ent.key.length < 8) continue;
            const n = ent.key.readBigUInt64LE(ent.key.length - 8);
            const type = Number(n & 0xffn);
            if (type !== 0 && type !== 1) continue;
            const key = Buffer.from(ent.key.subarray(0, ent.key.length - 8));
            const seq = n >> 8n;
            if (type === 0) {
                out.push({ key, seq, deleted: true });
            } else {
                out.push({
                    key,
                    seq,
                    deleted: false,
                    value: Buffer.from(ent.value),
                });
            }
        }
    }
    return out;
}

// --- Discord settings --------------------------------------------------------

function hostMatches(host, list) {
    return list.some((d) => host === d || host.endsWith(`.${d}`));
}

function positiveInt(v) {
    return typeof v === "number" && Number.isInteger(v) && v > 0
        ? v
        : undefined;
}

// Discord stores some src values protocol-relative. Returns "" when the src is
// unusable or points at an expiring Discord link.
function normaliseSrc(src) {
    if (typeof src !== "string") return "";
    let s = src.trim();
    if (s.startsWith("//")) s = `https:${s}`;
    let u;
    try {
        u = new URL(s);
    } catch {
        return "";
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (u.protocol === "http:") {
        u.protocol = "https:";
        if (u.port === "80") u.port = "";
    }
    if (hostMatches(u.hostname, DISCORD_SRC_HOSTS)) return "";
    return u.href;
}

// Turns Discord's favoriteGifs map into candidates, newest first (higher order
// is newer in Discord's settings).
function discordFavouriteCandidates(gifsMap) {
    let skippedDiscord = 0;
    let invalid = 0;
    const seen = new Set();
    const candidates = [];
    if (!gifsMap || typeof gifsMap !== "object") {
        return { skippedDiscord, invalid, candidates };
    }
    for (const [rawUrl, entry] of Object.entries(gifsMap)) {
        let u;
        try {
            u = new URL(rawUrl);
        } catch {
            invalid++;
            continue;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") {
            invalid++;
            continue;
        }
        if (hostMatches(u.hostname, DISCORD_HOSTS)) {
            skippedDiscord++;
            continue;
        }
        if (!entry || typeof entry !== "object") {
            invalid++;
            continue;
        }
        if (seen.has(u.href)) continue;
        seen.add(u.href);
        candidates.push({
            url: u.href,
            src: normaliseSrc(entry.src),
            video: entry.format === 2,
            width: positiveInt(entry.width),
            height: positiveInt(entry.height),
            order:
                typeof entry.order === "number" && Number.isFinite(entry.order)
                    ? entry.order
                    : -Infinity,
        });
    }
    candidates.sort((a, b) =>
        a.order === b.order ? 0 : a.order > b.order ? -1 : 1,
    );
    return { skippedDiscord, invalid, candidates };
}

// Decodes a localStorage value: first byte 0 = UTF-16LE, 1 = latin-1.
function decodeStorageValue(v) {
    if (!v || v.length < 1) return null;
    if (v[0] === 0) return v.subarray(1).toString("utf16le");
    if (v[0] === 1) return v.subarray(1).toString("latin1");
    return null;
}

// Finds the newest live settings key in one Discord data directory and returns
// its favoriteGifs map, or null when there is no key or it cannot be read.
async function readFavouriteGifsFromDir(dir) {
    const lsDir = path.join(dir, "Local Storage", "leveldb");
    let names;
    try {
        names = await fs.promises.readdir(lsDir);
    } catch (err) {
        logCode(err);
        return null;
    }
    const wanted = ORIGIN_KEY + SETTINGS_PREFIX;
    // Only keys with the wanted prefix are stored; others are never kept.
    const latest = new Map();
    for (const name of names) {
        const isLog = name.endsWith(".log");
        if (!isLog && !name.endsWith(".ldb")) continue;
        let buf;
        try {
            buf = await fs.promises.readFile(path.join(lsDir, name));
        } catch (err) {
            logCode(err);
            continue;
        }
        const entries = isLog ? parseLogFile(buf) : parseTableFile(buf);
        for (const e of entries) {
            const k = e.key.toString("latin1");
            if (!k.startsWith(wanted)) continue;
            const prev = latest.get(k);
            if (!prev || e.seq > prev.seq) {
                latest.set(k, {
                    seq: e.seq,
                    deleted: e.deleted,
                    value: e.value,
                });
            }
        }
    }
    let best = null;
    for (const e of latest.values()) {
        if (e.deleted) continue;
        if (!best || e.seq > best.seq) best = e;
    }
    if (!best) return null;
    const text = decodeStorageValue(best.value);
    if (text === null) return null;
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        console.warn("[discord-favourites] skipped: settings not JSON");
        return null;
    }
    const gifs = parsed?.favoriteGifs?.gifs;
    return { gifs: gifs && typeof gifs === "object" ? gifs : {} };
}

// The Discord data folders to try, in order.
function discordFavouriteDirs(
    appData,
    { home = os.homedir(), platform = process.platform } = {},
) {
    // Path rules follow `platform` (not the host) so the list is testable.
    const p = platform === "win32" ? path.win32 : path.posix;
    const names = ["discord", "discordcanary", "discordptb"];
    const dirs = names.map((n) => p.join(appData, n));
    if (platform === "linux") {
        // Inside Zam's own Flatpak, appData is Zam's sandbox config folder,
        // so also look in the real ~/.config (HOME stays the host's home).
        for (const n of names) dirs.push(p.join(home, ".config", n));
        // Discord's own Flatpaks and Snaps keep their config in their own
        // per-app folders. Zam's Flatpak manifest grants read-only access to
        // each of these paths; keep the two lists in step.
        dirs.push(
            p.join(home, ".var/app/com.discordapp.Discord/config/discord"),
            p.join(
                home,
                ".var/app/com.discordapp.DiscordCanary/config/discordcanary",
            ),
            p.join(home, "snap/discord/current/.config/discord"),
            p.join(home, "snap/discord-canary/current/.config/discordcanary"),
        );
    }
    // appData is usually ~/.config already, which would list it twice.
    return [...new Set(dirs)];
}

// Result contract for the renderer (discord-favourites:read IPC). Link checks
// happen in the renderer through the homeserver URL preview, so no network
// access happens here.
async function readDiscordFavouriteGifs({ dirs }) {
    for (const dir of dirs || []) {
        let found;
        try {
            found = await readFavouriteGifsFromDir(dir);
        } catch (err) {
            logCode(err);
            found = null;
        }
        if (!found) continue;
        const total = Object.keys(found.gifs).length;
        const { skippedDiscord, invalid, candidates } =
            discordFavouriteCandidates(found.gifs);
        const items = candidates.map((c) => {
            const item = { url: c.url, video: c.video };
            if (c.src) item.src = c.src;
            if (c.width !== undefined) item.width = c.width;
            if (c.height !== undefined) item.height = c.height;
            return item;
        });
        return { found: true, total, skippedDiscord, invalid, items };
    }
    return { found: false };
}

module.exports = {
    snappyDecompress,
    parseLogFile,
    parseTableFile,
    discordFavouriteCandidates,
    readDiscordFavouriteGifs,
    readFavouriteGifsFromDir,
    discordFavouriteDirs,
};
