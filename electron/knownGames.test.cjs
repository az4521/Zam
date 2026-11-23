// Run with: node --test electron/knownGames.test.cjs
// (vitest only collects src/**, so the Electron-side tests use node's runner.)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createKnownGames, indexGames } = require("./knownGames.cjs");
const { encodeGames, decodeGames } = require("./knownGamesCodec.cjs");

// The index as it was before it was made compact. The compact one must give
// the same answers to every lookup a consumer makes.
function referenceIndex(games, platform) {
    const byId = new Map();
    const byExe = new Map();
    const wineExe = new Map();
    for (const game of games ?? []) {
        byId.set(game.id, { name: game.name, icon: game.icon });
        for (const exe of game.exe) {
            const wine =
                platform === "linux" &&
                exe.os === "win32" &&
                /\.exe$/i.test(exe.name);
            if (exe.os !== platform && !wine) continue;
            const exact = exe.name.startsWith(">");
            const key = (exact ? exe.name.slice(1) : exe.name).toLowerCase();
            const into = wine ? wineExe : byExe;
            let list = into.get(key);
            if (!list) into.set(key, (list = []));
            list.push({ id: game.id, exact, args: exe.args, wine });
        }
    }
    for (const [key, list] of wineExe)
        if (!byExe.has(key)) byExe.set(key, list);
    return { platform, byId, byExe };
}

const HEX = (seed) => seed.toString(16).padStart(8, "0").repeat(4);

const games = [
    {
        id: "100",
        name: "Alpha",
        icon: HEX(0x0123abcd),
        exe: [
            { os: "win32", name: "alpha.exe" },
            { os: "linux", name: "alpha", args: "-x" },
        ],
    },
    {
        id: "200",
        name: "Beta",
        icon: null,
        exe: [
            { os: "win32", name: ">beta.exe", args: "--fast" },
            { os: "darwin", name: "beta" },
        ],
    },
    {
        // An icon that is not a hash is kept as it was given.
        id: "300",
        name: "Gamma",
        icon: "not-a-hash",
        exe: [{ os: "win32", name: "Alpha.EXE" }],
    },
    {
        // A native Linux executable named like a Windows one: it wins on Linux.
        id: "400",
        name: "Delta",
        icon: HEX(0xdeadbeef),
        exe: [{ os: "linux", name: "alpha.exe" }],
    },
    {
        // Exact name on the same key as game 100, later in the list.
        id: "500",
        name: "Epsilon",
        icon: null,
        exe: [{ os: "linux", name: ">alpha" }],
    },
    {
        // A game with no executables must not break the index.
        id: "600",
        name: "Zeta",
        icon: HEX(0),
        exe: [],
    },
];

const PROBE_KEYS = [
    "missing",
    "alpha",
    "alpha.exe",
    "beta",
    "beta.exe",
    "ALPHA.EXE",
    "x",
];
const PROBE_IDS = ["100", "200", "300", "400", "500", "600", "999"];

function assertSameIndex(actual, expected, extraKeys = []) {
    assert.equal(actual.platform, expected.platform);
    assert.equal(actual.byId.size, expected.byId.size, "byId.size");
    assert.equal(actual.byExe.size, expected.byExe.size, "byExe.size");
    for (const id of [...PROBE_IDS, ...expected.byId.keys()]) {
        assert.equal(
            actual.byId.has(id),
            expected.byId.has(id),
            `byId.has ${id}`,
        );
        assert.deepStrictEqual(
            actual.byId.get(id),
            expected.byId.get(id),
            `byId.get ${id}`,
        );
    }
    const keys = [...PROBE_KEYS, ...extraKeys, ...expected.byExe.keys()];
    for (const key of keys) {
        assert.equal(
            actual.byExe.has(key),
            expected.byExe.has(key),
            `byExe.has ${key}`,
        );
        assert.deepStrictEqual(
            actual.byExe.get(key),
            expected.byExe.get(key),
            `byExe.get ${key}`,
        );
    }
}

for (const platform of ["linux", "win32", "darwin"]) {
    test(`compact index matches the old one on ${platform}`, () => {
        assertSameIndex(
            indexGames(games, platform),
            referenceIndex(games, platform),
        );
    });
}

test("exact names, args, wine on linux and native-wins behave as before", () => {
    const linux = indexGames(games, "linux");
    // Game 400's native "alpha.exe" replaces game 100's Windows entry.
    assert.deepStrictEqual(linux.byExe.get("alpha.exe"), [
        { id: "400", exact: false, args: undefined, wine: false },
    ]);
    // Two games on one key keep their order; the exact one is flagged.
    assert.deepStrictEqual(linux.byExe.get("alpha"), [
        { id: "100", exact: false, args: "-x", wine: false },
        { id: "500", exact: true, args: undefined, wine: false },
    ]);
    // A Windows .exe is a wine entry on linux, and a plain one elsewhere.
    assert.deepStrictEqual(indexGames(games, "win32").byExe.get("beta.exe"), [
        { id: "200", exact: true, args: "--fast", wine: false },
    ]);
    assert.deepStrictEqual(linux.byExe.get("beta.exe"), [
        { id: "200", exact: true, args: "--fast", wine: true },
    ]);
});

test("wine entries are kept when no native entry shares the name", () => {
    const only = [
        {
            id: "1",
            name: "One",
            icon: null,
            exe: [{ os: "win32", name: "one.exe" }],
        },
        {
            id: "2",
            name: "Two",
            icon: null,
            exe: [{ os: "win32", name: "one.exe" }],
        },
    ];
    assert.deepStrictEqual(indexGames(only, "linux").byExe.get("one.exe"), [
        { id: "1", exact: false, args: undefined, wine: true },
        { id: "2", exact: false, args: undefined, wine: true },
    ]);
});

test("lookups that find nothing give undefined, and an absent list is empty", () => {
    const idx = indexGames(games, "linux");
    assert.equal(idx.byId.get("999"), undefined);
    assert.equal(idx.byExe.get("nope.exe"), undefined);
    assert.equal(idx.byExe.has("nope.exe"), false);
    const empty = indexGames(null, "linux");
    assert.equal(empty.byId.size, 0);
    assert.equal(empty.byExe.size, 0);
    assert.equal(empty.byExe.get("alpha"), undefined);
});

test("icons come back as the hash they were given, or as given when not a hash", () => {
    const idx = indexGames(games, "linux");
    assert.equal(idx.byId.get("100").icon, HEX(0x0123abcd));
    assert.equal(idx.byId.get("200").icon, null);
    assert.equal(idx.byId.get("300").icon, "not-a-hash");
    assert.equal(idx.byId.get("600").icon, HEX(0));
});

test("a later game with the same id replaces the earlier one, as before", () => {
    const dup = [
        {
            id: "7",
            name: "First",
            icon: null,
            exe: [{ os: "linux", name: "a" }],
        },
        {
            id: "7",
            name: "Second",
            icon: HEX(1),
            exe: [{ os: "linux", name: "b" }],
        },
    ];
    assertSameIndex(indexGames(dup, "linux"), referenceIndex(dup, "linux"), [
        "a",
        "b",
    ]);
    assert.equal(indexGames(dup, "linux").byId.get("7").name, "Second");
});

test("a large pseudo-random list matches the old index on every key", () => {
    // A small deterministic generator, so a failure can be repeated.
    let seed = 12345;
    const rnd = (n) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
    };
    const pool = ["a", "b", "c.exe", "d", ">a", "B.EXE", "x64", "dir/e"];
    const oses = ["win32", "linux", "darwin"];
    const big = [];
    for (let i = 0; i < 800; i++) {
        const exe = [];
        for (let j = rnd(4); j > 0; j--) {
            const o = { os: oses[rnd(3)], name: pool[rnd(pool.length)] };
            if (rnd(3) === 0) o.args = `-arg${rnd(3)}`;
            exe.push(o);
        }
        big.push({
            id: String(100000 + i * 7),
            name: `Game ${i}`,
            icon: rnd(2) ? HEX(i) : null,
            exe,
        });
    }
    const extra = pool.flatMap((k) => [k, k.toUpperCase(), `>${k}`]);
    for (const platform of ["linux", "win32", "darwin"]) {
        assertSameIndex(
            indexGames(big, platform),
            referenceIndex(big, platform),
            extra,
        );
    }
});

test("load() reads the list from disk into the same index", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zam-known-"));
    try {
        const file = path.join(dir, "known-games.bin");
        // The codec only keeps hex icons, so give it the same list it would keep.
        const list = games.map((g) =>
            typeof g.icon === "string" && !/^[0-9a-f]{32}$/.test(g.icon)
                ? { ...g, icon: null }
                : g,
        );
        fs.writeFileSync(file, encodeGames(list));
        const known = createKnownGames({ file, now: () => 0 });
        const decoded = decodeGames(fs.readFileSync(file));
        const got = await known.load("linux");
        assertSameIndex(got, referenceIndex(decoded, "linux"));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
