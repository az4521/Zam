// The detectable-games list in its shipped form, electron/knownGames.bin.
//
// The list is ~10,000 games, so it is stored compactly: games sorted by
// application id, ids as base-36 deltas, icon hashes as 16 raw bytes (they are
// random hex, which no compressor can shrink as text), the rest as JSON, all
// of it brotli-compressed.
//
//   [uint32 length of JSON][JSON: { ids, names, exe }][16 bytes per game: icon]
//
// `game` below is { id, name, icon: hex | null, exe: [{ os, name, args? }] }.

const zlib = require("zlib");

const OS_CODES = { win32: "w", darwin: "d", linux: "l" };
const OS_NAMES = Object.fromEntries(
    Object.entries(OS_CODES).map(([name, code]) => [code, name]),
);
const ICON_BYTES = 16;
const NO_ICON = Buffer.alloc(ICON_BYTES);

function fromBase36(s) {
    let n = 0n;
    for (const c of s) n = n * 36n + BigInt(parseInt(c, 36));
    return n;
}

function encodeGames(games) {
    const sorted = [...games].sort((a, b) => {
        const d = BigInt(a.id) - BigInt(b.id);
        return d < 0n ? -1 : d > 0n ? 1 : 0;
    });
    const ids = [];
    let prev = 0n;
    for (const g of sorted) {
        const id = BigInt(g.id);
        ids.push((id - prev).toString(36));
        prev = id;
    }
    const exe = sorted.map((g) =>
        g.exe
            .filter((e) => OS_CODES[e.os])
            .map((e) =>
                e.args
                    ? `${OS_CODES[e.os]}${e.name}\0${e.args}`
                    : `${OS_CODES[e.os]}${e.name}`,
            ),
    );
    const json = Buffer.from(
        JSON.stringify({ ids, names: sorted.map((g) => g.name), exe }),
        "utf8",
    );
    const head = Buffer.alloc(4);
    head.writeUInt32LE(json.length);
    const icons = Buffer.concat(
        sorted.map((g) =>
            g.icon && /^[0-9a-f]{32}$/.test(g.icon)
                ? Buffer.from(g.icon, "hex")
                : NO_ICON,
        ),
    );
    return zlib.brotliCompressSync(Buffer.concat([head, json, icons]), {
        params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: json.length,
        },
    });
}

function decodeGames(bytes) {
    const raw = zlib.brotliDecompressSync(bytes);
    const jsonLength = raw.readUInt32LE(0);
    const { ids, names, exe } = JSON.parse(
        raw.subarray(4, 4 + jsonLength).toString("utf8"),
    );
    const icons = raw.subarray(4 + jsonLength);
    const games = [];
    let id = 0n;
    for (let i = 0; i < ids.length; i++) {
        id += fromBase36(ids[i]);
        const icon = icons.subarray(i * ICON_BYTES, (i + 1) * ICON_BYTES);
        games.push({
            id: id.toString(),
            name: names[i],
            icon: icon.equals(NO_ICON) ? null : icon.toString("hex"),
            exe: exe[i].map((e) => {
                const [name, args] = e.slice(1).split("\0");
                return {
                    os: OS_NAMES[e[0]],
                    name,
                    ...(args ? { args } : {}),
                };
            }),
        });
    }
    return games;
}

module.exports = { encodeGames, decodeGames };
