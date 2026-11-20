// Run with: node --test electron/discordFavourites.test.cjs
// (vitest only collects src/**, so the Electron-side tests use node's runner.)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
    snappyDecompress,
    parseLogFile,
    parseTableFile,
    discordFavouriteCandidates,
    readDiscordFavouriteGifs,
    discordFavouriteDirs,
} = require("./discordFavourites.cjs");

const SETTINGS_KEY =
    "_https://discord.com\x00\x01UserSettingsProtoStore:parsed:2:AAAA";

// --- Encoders used to build fixtures -----------------------------------------

function varint(n) {
    const out = [];
    let v = n;
    while (v >= 128) {
        out.push((v % 128) | 0x80);
        v = Math.floor(v / 128);
    }
    out.push(v);
    return Buffer.from(out);
}

// Snappy literal-only encoding (chunks of up to 60 bytes, plus the 61 form).
function snappyLiterals(data) {
    const parts = [varint(data.length)];
    if (data.length > 60 && data.length <= 300) {
        // Tag 61: length-1 in two little-endian bytes.
        const n = data.length - 1;
        parts.push(Buffer.from([61 << 2, n & 0xff, n >> 8]), data);
        return Buffer.concat(parts);
    }
    for (let i = 0; i < data.length; i += 60) {
        const chunk = data.subarray(i, Math.min(i + 60, data.length));
        parts.push(Buffer.from([(chunk.length - 1) << 2]), chunk);
    }
    return Buffer.concat(parts);
}

function writeBatch(seq, ops) {
    const parts = [Buffer.alloc(12)];
    parts[0].writeBigUInt64LE(BigInt(seq), 0);
    parts[0].writeUInt32LE(ops.length, 8);
    for (const op of ops) {
        const key = Buffer.from(op.key, "latin1");
        if (op.value === undefined) {
            parts.push(Buffer.from([0]), varint(key.length), key);
        } else {
            const value = Buffer.from(op.value, "latin1");
            parts.push(
                Buffer.from([1]),
                varint(key.length),
                key,
                varint(value.length),
                value,
            );
        }
    }
    return Buffer.concat(parts);
}

// Splits records into 32 KiB log blocks the way LevelDB's writer does.
function encodeLog(records) {
    const out = [];
    let block = 0;
    for (const rec of records) {
        let rest = rec;
        let begin = true;
        do {
            let left = 32768 - block;
            if (left < 7) {
                out.push(Buffer.alloc(left));
                block = 0;
                left = 32768;
            }
            const n = Math.min(left - 7, rest.length);
            const end = n === rest.length;
            const type = begin && end ? 1 : begin ? 2 : end ? 4 : 3;
            const hdr = Buffer.alloc(7);
            hdr.writeUInt16LE(n, 4);
            hdr[6] = type;
            out.push(hdr, rest.subarray(0, n));
            rest = rest.subarray(n);
            block = (block + 7 + n) % 32768;
            begin = false;
        } while (rest.length > 0);
    }
    return Buffer.concat(out);
}

// A data/index/metaindex block with restart points every two entries.
function encodeBlock(entries) {
    const parts = [];
    const restarts = [];
    let total = 0;
    let prev = Buffer.alloc(0);
    entries.forEach((e, i) => {
        const restart = i % 2 === 0;
        if (restart) restarts.push(total);
        let shared = 0;
        if (!restart) {
            while (
                shared < prev.length &&
                shared < e.key.length &&
                prev[shared] === e.key[shared]
            ) {
                shared++;
            }
        }
        const chunk = Buffer.concat([
            varint(shared),
            varint(e.key.length - shared),
            varint(e.value.length),
            e.key.subarray(shared),
            e.value,
        ]);
        parts.push(chunk);
        total += chunk.length;
        prev = e.key;
    });
    const trailer = Buffer.alloc(4 * restarts.length + 4);
    restarts.forEach((r, i) => trailer.writeUInt32LE(r, i * 4));
    trailer.writeUInt32LE(restarts.length, trailer.length - 4);
    return Buffer.concat([...parts, trailer]);
}

// Appends a block plus its compression byte and crc; returns its handle.
function place(file, block, compression = 0) {
    const offset = file.reduce((n, b) => n + b.length, 0);
    const body = compression === 1 ? snappyLiterals(block) : Buffer.from(block);
    file.push(body, Buffer.from([compression, 0, 0, 0, 0]));
    return { offset, size: body.length };
}

function handle(h) {
    return Buffer.concat([varint(h.offset), varint(h.size)]);
}

function encodeTable(entries, { compressData = false } = {}) {
    const file = [];
    const data = encodeBlock(entries);
    const dataHandle = place(file, data, compressData ? 1 : 0);
    const index = encodeBlock([
        { key: Buffer.from("zz"), value: handle(dataHandle) },
    ]);
    const indexHandle = place(file, index);
    const metaHandle = place(file, encodeBlock([]));
    const footer = Buffer.alloc(40);
    const f = Buffer.concat([handle(metaHandle), handle(indexHandle)]);
    f.copy(footer);
    return Buffer.concat([
        ...file,
        footer,
        Buffer.from("57fb808b247547db", "hex"),
    ]);
}

function internalKey(userKey, seq, type) {
    const k = Buffer.alloc(8);
    k.writeBigUInt64LE((BigInt(seq) << 8n) | BigInt(type), 0);
    return Buffer.concat([Buffer.from(userKey, "latin1"), k]);
}

// Value encoding used by Chromium localStorage: first byte picks the codec.
function storageValue(text) {
    return Buffer.concat([Buffer.from([1]), Buffer.from(text, "latin1")]);
}

// --- snappy ------------------------------------------------------------------

test("snappy: literals, long literal form, and overlapping copies", () => {
    assert.equal(
        snappyDecompress(snappyLiterals(Buffer.from("hello"))).toString(),
        "hello",
    );
    const long = Buffer.alloc(200, 0x61);
    assert.deepEqual(snappyDecompress(snappyLiterals(long)), long);
    // "abc" then copy len 6 offset 3 (copy-1 form: len 4+(2), offset 3).
    const buf = Buffer.concat([
        varint(9),
        Buffer.from([(3 - 1) << 2]),
        Buffer.from("abc"),
        Buffer.from([((2 & 7) << 2) | 1, 3]),
    ]);
    assert.equal(snappyDecompress(buf).toString(), "abcabcabc");
});

test("snappy: copy-2 and copy-4 forms", () => {
    const head = Buffer.from("0123456789", "latin1");
    const pre = Buffer.concat([
        varint(14),
        Buffer.from([(10 - 1) << 2]),
        head,
        Buffer.from([((4 - 1) << 2) | 2, 10, 0]),
    ]);
    assert.equal(snappyDecompress(pre).toString(), "0123456789" + "0123");
    const pre4 = Buffer.concat([
        varint(14),
        Buffer.from([(10 - 1) << 2]),
        head,
        Buffer.from([((4 - 1) << 2) | 3, 10, 0, 0, 0]),
    ]);
    assert.equal(snappyDecompress(pre4).toString(), "0123456789" + "0123");
});

test("snappy: rejects bad copies and length mismatch", () => {
    // Copy offset 5 with only 2 bytes produced.
    const badOffset = Buffer.concat([
        varint(6),
        Buffer.from([(2 - 1) << 2]),
        Buffer.from("ab"),
        Buffer.from([0x01, 5]),
    ]);
    assert.throws(() => snappyDecompress(badOffset));
    const short = Buffer.concat([
        varint(9),
        snappyLiterals(Buffer.from("ab")).subarray(1),
    ]);
    assert.throws(() => snappyDecompress(short));
});

// --- .log --------------------------------------------------------------------

test("log: batch ops get base+index sequences and fragments reassemble", () => {
    const small = writeBatch(10, [{ key: "a", value: "1" }, { key: "b" }]);
    const big = writeBatch(20, [
        { key: "big", value: "x".repeat(40000) },
        { key: "after", value: "y" },
    ]);
    const entries = parseLogFile(encodeLog([small, big]));
    const summary = entries.map((e) => [
        e.key.toString(),
        e.seq.toString(),
        e.deleted,
        e.value ? e.value.length : undefined,
    ]);
    assert.deepEqual(summary, [
        ["a", "10", false, 1],
        ["b", "11", true, undefined],
        ["big", "20", false, 40000],
        ["after", "21", false, 1],
    ]);
});

test("log: a corrupt record skips its block but later blocks still parse", () => {
    const junk = Buffer.alloc(32768, 0xff);
    const good = writeBatch(5, [{ key: "k", value: "v" }]);
    const parsed = parseLogFile(Buffer.concat([junk, encodeLog([good])]));
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].key.toString(), "k");
});

test("log: truncated input yields what is complete", () => {
    const full = encodeLog([writeBatch(1, [{ key: "a", value: "1" }])]);
    assert.doesNotThrow(() => parseLogFile(full.subarray(0, full.length - 3)));
    assert.deepEqual(parseLogFile(Buffer.alloc(0)), []);
});

// --- .ldb --------------------------------------------------------------------

test("table: internal keys yield sequence and deletion type, raw and snappy", () => {
    const entries = [
        { key: internalKey("aa", 3, 1), value: Buffer.from("one") },
        { key: internalKey("ab", 7, 0), value: Buffer.alloc(0) },
        { key: internalKey("ac", 9, 1), value: Buffer.from("three") },
    ];
    for (const compressData of [false, true]) {
        const parsed = parseTableFile(encodeTable(entries, { compressData }));
        assert.deepEqual(
            parsed.map((e) => [e.key.toString(), e.seq.toString(), e.deleted]),
            [
                ["aa", "3", false],
                ["ab", "7", true],
                ["ac", "9", false],
            ],
        );
        assert.equal(parsed[0].value.toString(), "one");
    }
});

test("table: bad magic, short files and bad blocks yield nothing", () => {
    assert.deepEqual(parseTableFile(Buffer.alloc(10)), []);
    const t = encodeTable([
        { key: internalKey("a", 1, 1), value: Buffer.from("v") },
    ]);
    const badMagic = Buffer.from(t);
    badMagic[badMagic.length - 1] ^= 0xff;
    assert.deepEqual(parseTableFile(badMagic), []);
    const badBlock = Buffer.from(t);
    badBlock[0] = 0x7f; // corrupt the first data block's bytes
    assert.doesNotThrow(() => parseTableFile(badBlock));
});

// --- Candidates --------------------------------------------------------------

test("candidates: filters Discord hosts, invalid urls, dedupes and sorts newest first", () => {
    const gifs = {
        "https://media.tenor.com/a.gif": {
            format: 1,
            src: "//media.tenor.com/a.mp4",
            width: 200,
            height: 100,
            order: 1,
        },
        "https://cdn.discordapp.com/x.gif": { format: 1, order: 9 },
        "https://evildiscordapp.com/x.gif": { format: 1, order: 2 },
        "https://discord.gg/abc": { format: 1, order: 3 },
        "not a url": { format: 1, order: 4 },
        "ftp://files.example/x.gif": { format: 1, order: 5 },
        "https://g.example/video.mp4": {
            format: 2,
            src: "https://cdn.discordapp.net/proxy.mp4",
            width: 0,
            height: 3.5,
            order: 8,
        },
        "https://g.example/nosrc.gif": {
            format: 1,
            src: "http://media.example/n.gif",
            width: 12,
            order: 6,
        },
    };
    const r = discordFavouriteCandidates(gifs);
    assert.equal(r.skippedDiscord, 2);
    assert.equal(r.invalid, 2);
    assert.deepEqual(
        r.candidates.map((c) => c.url),
        [
            "https://g.example/video.mp4",
            "https://g.example/nosrc.gif",
            "https://evildiscordapp.com/x.gif",
            "https://media.tenor.com/a.gif",
        ],
    );
    const video = r.candidates[0];
    assert.equal(video.video, true);
    assert.equal(video.src, "", "discordapp.net src is unusable");
    assert.equal(video.width, undefined);
    assert.equal(video.height, undefined);
    assert.equal(r.candidates[1].src, "https://media.example/n.gif");
    assert.equal(r.candidates[1].width, 12);
    assert.equal(r.candidates[3].src, "https://media.tenor.com/a.mp4");
    assert.equal(r.candidates[3].video, false);
});

test("candidates: non-object input is empty", () => {
    assert.deepEqual(discordFavouriteCandidates(null), {
        skippedDiscord: 0,
        invalid: 0,
        candidates: [],
    });
});

// --- Reader ------------------------------------------------------------------

function makeDiscordDir(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "discord-fav-test-"));
    const ls = path.join(root, "Local Storage", "leveldb");
    fs.mkdirSync(ls, { recursive: true });
    for (const [name, data] of Object.entries(files)) {
        fs.writeFileSync(path.join(ls, name), data);
    }
    return root;
}

const GIFS = {
    "https://media.tenor.com/keep.gif": { format: 1, order: 2, width: 5 },
    "https://cdn.discordapp.com/skip.gif": { format: 1, order: 3 },
};

test("reader: picks the newest live settings key and ignores other keys", async () => {
    const older = internalKey(
        "_https://discord.com\x00\x01UserSettingsProtoStore:parsed:2:OLD",
        4,
        1,
    );
    const liveNew = internalKey(SETTINGS_KEY.slice(0, -4) + "NEW1", 9, 1);
    const token = internalKey("_https://discord.com\x00\x01token", 20, 1);
    const log = encodeLog([
        writeBatch(1, [
            {
                key: SETTINGS_KEY,
                value:
                    "\x01" +
                    JSON.stringify({ favoriteGifs: { gifs: { x: 1 } } }),
            },
            {
                key: "_https://discord.com\x00\x01token",
                value: "\x01secret-token-value",
            },
        ]),
    ]);
    const table = encodeTable([
        {
            key: older,
            value: storageValue(JSON.stringify({ favoriteGifs: { gifs: {} } })),
        },
        {
            key: liveNew,
            value: storageValue(
                JSON.stringify({ favoriteGifs: { gifs: GIFS } }),
            ),
        },
        { key: token, value: Buffer.from("\x01nope", "latin1") },
    ]);
    const deletedLog = encodeLog([writeBatch(12, [{ key: SETTINGS_KEY }])]);
    const dir = makeDiscordDir({
        "000001.log": log,
        "000002.log": deletedLog,
        "000003.ldb": table,
    });
    try {
        const result = await readDiscordFavouriteGifs({ dirs: [dir] });
        assert.equal(result.found, true);
        assert.equal(result.total, 2);
        assert.equal(result.skippedDiscord, 1);
        assert.equal(result.invalid, 0);
        assert.deepEqual(result.items, [
            {
                url: "https://media.tenor.com/keep.gif",
                video: false,
                width: 5,
            },
        ]);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("reader: a folder with no key or no install is found:false", async () => {
    const empty = makeDiscordDir({});
    try {
        assert.deepEqual(
            await readDiscordFavouriteGifs({
                dirs: [empty, path.join(empty, "missing")],
            }),
            { found: false },
        );
    } finally {
        fs.rmSync(empty, { recursive: true, force: true });
    }
});

test("reader: falls through to the next directory that has the key", async () => {
    const withKey = makeDiscordDir({
        "000001.log": encodeLog([
            writeBatch(1, [
                {
                    key: SETTINGS_KEY,
                    value:
                        "\x01" +
                        JSON.stringify({ favoriteGifs: { gifs: GIFS } }),
                },
            ]),
        ]),
    });
    try {
        const r = await readDiscordFavouriteGifs({
            dirs: [path.join(withKey, "nope"), withKey],
        });
        assert.equal(r.found, true);
        assert.equal(r.total, 2);
    } finally {
        fs.rmSync(withKey, { recursive: true, force: true });
    }
});

test("dirs: linux adds the flatpak folder; other platforms do not", () => {
    const win = discordFavouriteDirs("C:\\AppData", {
        home: "C:\\Users\\x",
        platform: "win32",
    });
    assert.equal(win.length, 3);
    const linux = discordFavouriteDirs("/home/x/.config", {
        home: "/home/x",
        platform: "linux",
    });
    // ~/.config is appData already, so it is not listed twice.
    assert.equal(linux.length, 7);
    assert.ok(linux.some((d) => d.includes("com.discordapp.Discord/")));
    assert.ok(linux.some((d) => d.includes("com.discordapp.DiscordCanary/")));
    assert.ok(linux.some((d) => d.includes("snap/discord/")));
    assert.ok(linux.some((d) => d.includes("snap/discord-canary/")));
    // Zam in its own Flatpak: appData is the sandbox, the real ~/.config is
    // still searched.
    const sandboxed = discordFavouriteDirs(
        "/home/x/.var/app/moe.crafty.matrix/config",
        { home: "/home/x", platform: "linux" },
    );
    assert.equal(sandboxed.length, 10);
    assert.ok(sandboxed.includes("/home/x/.config/discordcanary"));
});
