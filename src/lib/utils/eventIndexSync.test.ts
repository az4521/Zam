import { describe, it, expect } from "vitest";
import {
    addRange,
    subtractRanges,
    intersectRanges,
    rangesCover,
    packEntries,
    unpackBlock,
    dedupeEntries,
    entriesInRange,
    parseSyncBlock,
    parseSyncRequest,
    peerRefusal,
    windowRanges,
    type IndexSyncBlock,
    type Range,
} from "./eventIndexSync";
import { encodeBlock, type IndexEntry } from "./eventIndex";

const entry = (id: string, t: number, b = `body ${id}`): IndexEntry => ({
    e: id,
    s: "@a:x",
    t,
    m: "m.text",
    b,
});

/** Deterministic pseudo-random text, so the blocks don't compress away. */
function noise(seed: number, length: number): string {
    let x = seed || 1;
    let out = "";
    while (out.length < length) {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        out += x.toString(36);
    }
    return out.slice(0, length);
}

const validBlock = (): IndexSyncBlock => ({
    id: "req1",
    roomId: "!r:x",
    range: [0, 10],
    seq: 0,
    total: 1,
    data: "AAAA",
});

describe("addRange", () => {
    it("adds to an empty list", () => {
        expect(addRange([], [1, 5])).toEqual([[1, 5]]);
    });

    it("keeps disjoint ranges sorted", () => {
        expect(addRange([[10, 12]], [1, 3])).toEqual([
            [1, 3],
            [10, 12],
        ]);
    });

    it("merges overlapping and contained ranges", () => {
        expect(addRange([[1, 5]], [3, 9])).toEqual([[1, 9]]);
        expect(addRange([[1, 9]], [3, 4])).toEqual([[1, 9]]);
    });

    it("merges ranges that are adjacent (next starts 1 ms after the last ends)", () => {
        expect(addRange([[0, 4]], [5, 9])).toEqual([[0, 9]]);
    });

    it("leaves a 2 ms gap unmerged", () => {
        expect(addRange([[0, 4]], [6, 9])).toEqual([
            [0, 4],
            [6, 9],
        ]);
    });

    it("bridges several ranges with one addition", () => {
        expect(
            addRange(
                [
                    [0, 1],
                    [5, 6],
                    [10, 11],
                ],
                [1, 10],
            ),
        ).toEqual([[0, 11]]);
    });

    it("does not mutate its input", () => {
        const input: Range[] = [[0, 4]];
        addRange(input, [5, 9]);
        expect(input).toEqual([[0, 4]]);
    });

    it("ignores an invalid range", () => {
        expect(addRange([[0, 4]], [9, 1])).toEqual([[0, 4]]);
        expect(addRange([[0, 4]], [NaN, 9])).toEqual([[0, 4]]);
    });
});

describe("subtractRanges", () => {
    it("returns the whole want when nothing is covered", () => {
        expect(subtractRanges([0, 10], [])).toEqual([[0, 10]]);
    });

    it("returns nothing when fully covered", () => {
        expect(subtractRanges([2, 8], [[0, 10]])).toEqual([]);
        expect(subtractRanges([0, 10], [[0, 10]])).toEqual([]);
    });

    it("returns the gap in the middle", () => {
        expect(subtractRanges([0, 10], [[3, 5]])).toEqual([
            [0, 2],
            [6, 10],
        ]);
    });

    it("trims the left and right edges", () => {
        expect(subtractRanges([0, 10], [[0, 4]])).toEqual([[5, 10]]);
        expect(subtractRanges([0, 10], [[6, 20]])).toEqual([[0, 5]]);
    });

    it("returns several holes sorted", () => {
        expect(
            subtractRanges(
                [0, 20],
                [
                    [12, 14],
                    [3, 4],
                    [8, 9],
                ],
            ),
        ).toEqual([
            [0, 2],
            [5, 7],
            [10, 11],
            [15, 20],
        ]);
    });

    it("treats adjacent covering ranges as one cover", () => {
        expect(
            subtractRanges(
                [0, 9],
                [
                    [0, 4],
                    [5, 9],
                ],
            ),
        ).toEqual([]);
    });

    it("ignores have ranges outside want", () => {
        expect(
            subtractRanges(
                [10, 20],
                [
                    [0, 5],
                    [30, 40],
                ],
            ),
        ).toEqual([[10, 20]]);
    });

    it("handles an unsorted, overlapping have list", () => {
        expect(
            subtractRanges(
                [0, 10],
                [
                    [6, 8],
                    [2, 7],
                ],
            ),
        ).toEqual([
            [0, 1],
            [9, 10],
        ]);
    });

    it("returns nothing for an empty or invalid want", () => {
        expect(subtractRanges([5, 4], [])).toEqual([]);
        expect(subtractRanges([NaN, 4], [])).toEqual([]);
    });
});

describe("intersectRanges", () => {
    it("returns the overlap of two lists", () => {
        expect(
            intersectRanges(
                [
                    [0, 10],
                    [20, 30],
                ],
                [[5, 25]],
            ),
        ).toEqual([
            [5, 10],
            [20, 25],
        ]);
    });

    it("returns nothing for disjoint lists", () => {
        expect(intersectRanges([[0, 4]], [[5, 9]])).toEqual([]);
    });

    it("returns nothing when either side is empty", () => {
        expect(intersectRanges([], [[0, 9]])).toEqual([]);
        expect(intersectRanges([[0, 9]], [])).toEqual([]);
    });

    it("keeps a single shared millisecond", () => {
        expect(intersectRanges([[0, 5]], [[5, 9]])).toEqual([[5, 5]]);
    });

    it("merges adjacent input ranges before intersecting", () => {
        expect(
            intersectRanges(
                [
                    [0, 4],
                    [5, 9],
                ],
                [[3, 6]],
            ),
        ).toEqual([[3, 6]]);
    });
});

describe("rangesCover", () => {
    it("is true when one range covers the whole request", () => {
        expect(rangesCover([[0, 100]], [10, 20])).toBe(true);
    });

    it("is true across adjacent ranges", () => {
        expect(
            rangesCover(
                [
                    [0, 4],
                    [5, 9],
                ],
                [0, 9],
            ),
        ).toBe(true);
    });

    it("is false when a gap remains", () => {
        expect(
            rangesCover(
                [
                    [0, 4],
                    [6, 9],
                ],
                [0, 9],
            ),
        ).toBe(false);
    });

    it("is false for an invalid request", () => {
        expect(rangesCover([[0, 100]], [20, 10])).toBe(false);
    });
});

describe("packEntries", () => {
    it("returns one block for a small set with the request fields", async () => {
        const blocks = await packEntries(
            "!room:x",
            "req-1",
            [100, 200],
            [entry("$b", 150), entry("$a", 120)],
        );
        expect(blocks).toHaveLength(1);
        const [b] = blocks;
        expect(b).toMatchObject({
            id: "req-1",
            roomId: "!room:x",
            range: [100, 200],
            seq: 0,
            total: 1,
        });
        expect(b.data.length).toBeLessThanOrEqual(40_000);
    });

    it("returns one empty block when there are no entries", async () => {
        const blocks = await packEntries("!r:x", "req", [0, 50], []);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]).toMatchObject({ seq: 0, total: 1, range: [0, 50] });
        expect(await unpackBlock(blocks[0])).toEqual([]);
    });

    it("sorts entries by timestamp before packing", async () => {
        const blocks = await packEntries(
            "!r:x",
            "req",
            [0, 100],
            [entry("$c", 30), entry("$a", 10), entry("$b", 20)],
        );
        const out = await unpackBlock(blocks[0]);
        expect(out.map((e) => e.t)).toEqual([10, 20, 30]);
    });

    it("does not mutate its entries array", async () => {
        const entries = [entry("$b", 20), entry("$a", 10)];
        await packEntries("!r:x", "req", [0, 100], entries);
        expect(entries.map((e) => e.e)).toEqual(["$b", "$a"]);
    });

    it("splits 2000 entries into several blocks, each within maxBytes", async () => {
        const entries: IndexEntry[] = [];
        for (let i = 0; i < 2000; i++) {
            entries.push(entry(`$e${i}`, 1_000_000 - i * 7, noise(i + 1, 120)));
        }
        const maxBytes = 40_000;
        const blocks = await packEntries(
            "!big:x",
            "req-big",
            [0, 2_000_000],
            entries,
            maxBytes,
        );

        expect(blocks.length).toBeGreaterThan(1);
        blocks.forEach((b, i) => {
            expect(b.seq).toBe(i);
            expect(b.total).toBe(blocks.length);
            expect(b.data.length).toBeLessThanOrEqual(maxBytes);
            expect(b.range).toEqual([0, 2_000_000]);
            expect(b.roomId).toBe("!big:x");
        });

        const unpacked: IndexEntry[] = [];
        for (const b of blocks) unpacked.push(...(await unpackBlock(b)));
        expect(unpacked).toHaveLength(2000);
        expect(new Set(unpacked.map((e) => e.e)).size).toBe(2000);
        expect(unpacked.map((e) => e.t)).toEqual(
            [...unpacked.map((e) => e.t)].sort((a, b) => a - b),
        );
    });

    it("shortens the body of an entry too big to fit alone", async () => {
        const big = entry("$huge", 5, noise(7, 200_000));
        const blocks = await packEntries("!r:x", "req", [0, 10], [big]);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].data.length).toBeLessThanOrEqual(40_000);
        const [out] = await unpackBlock(blocks[0]);
        expect(out.e).toBe("$huge");
        expect(out.t).toBe(5);
        expect(out.b.length).toBeGreaterThan(0);
        expect(out.b.length).toBeLessThan(big.b.length);
        expect(big.b.startsWith(out.b)).toBe(true);
    });

    it("throws when maxBytes cannot hold even an empty block", async () => {
        await expect(packEntries("!r:x", "req", [0, 1], [], 1)).rejects.toThrow(
            RangeError,
        );
    });

    it("throws when maxBytes cannot hold one entry with an empty body", async () => {
        await expect(
            packEntries("!r:x", "req", [0, 1], [entry("$a", 1)], 1),
        ).rejects.toThrow(RangeError);
    });
});

describe("unpackBlock", () => {
    it("roundtrips the entries packed into a block", async () => {
        const entries = [entry("$1", 1, "héllo"), entry("$2", 2, "日本語")];
        const [block] = await packEntries("!r:x", "req", [0, 5], entries);
        expect(await unpackBlock(block)).toEqual(entries);
    });

    it("keeps optional edit and voice fields", async () => {
        const edit: IndexEntry = { ...entry("$3", 3, "fixed"), v: 1, o: "$1" };
        const [block] = await packEntries("!r:x", "req", [0, 5], [edit]);
        expect(await unpackBlock(block)).toEqual([edit]);
    });

    it("drops malformed items inside a block", async () => {
        const junk = [
            entry("$good", 1),
            { e: "$no-time", s: "@a:x", m: "m.text", b: "x" },
            { e: "$nan", s: "@a:x", t: NaN, m: "m.text", b: "x" },
            { e: "$bad-v", s: "@a:x", t: 4, m: "m.text", b: "x", v: 2 },
            null,
            "text",
        ] as unknown as IndexEntry[];
        // Built directly: packEntries assumes well-typed entries.
        const { data } = await encodeBlock(junk);
        let binary = "";
        for (const byte of data) binary += String.fromCharCode(byte);
        const out = await unpackBlock({ ...validBlock(), data: btoa(binary) });
        expect(out.map((e) => e.e)).toEqual(["$good"]);
    });

    it("rejects data that is not base64 deflate", async () => {
        await expect(
            unpackBlock({ ...validBlock(), data: "%%%not base64%%%" }),
        ).rejects.toThrow();
    });
});

describe("dedupeEntries", () => {
    it("drops ids already known", () => {
        const out = dedupeEntries(
            [entry("$a", 1), entry("$b", 2)],
            new Set(["$a"]),
        );
        expect(out.map((e) => e.e)).toEqual(["$b"]);
    });

    it("keeps the first of repeated ids within incoming", () => {
        const out = dedupeEntries(
            [entry("$a", 1, "first"), entry("$a", 2, "second")],
            new Set(),
        );
        expect(out).toEqual([entry("$a", 1, "first")]);
    });

    it("returns an empty list for empty input", () => {
        expect(dedupeEntries([], new Set(["$a"]))).toEqual([]);
    });
});

describe("entriesInRange", () => {
    const entries = [
        entry("$1", 0),
        entry("$2", 5),
        entry("$3", 10),
        entry("$4", 20),
    ];

    it("includes both ends of a range", () => {
        expect(entriesInRange(entries, [[5, 10]]).map((e) => e.e)).toEqual([
            "$2",
            "$3",
        ]);
    });

    it("matches any of several ranges", () => {
        expect(
            entriesInRange(entries, [
                [0, 0],
                [20, 30],
            ]).map((e) => e.e),
        ).toEqual(["$1", "$4"]);
    });

    it("returns nothing for no ranges", () => {
        expect(entriesInRange(entries, [])).toEqual([]);
    });
});

describe("parseSyncBlock", () => {
    it("accepts a well-formed block", () => {
        expect(parseSyncBlock(validBlock())).toEqual(validBlock());
    });

    it("accepts the upper limits", () => {
        const max = {
            ...validBlock(),
            seq: 999,
            total: 1000,
            data: "A".repeat(100_000),
        };
        expect(parseSyncBlock(max)).not.toBeNull();
    });

    it("returns a fresh object without extra fields", () => {
        const parsed = parseSyncBlock({ ...validBlock(), extra: 1 });
        expect(parsed).toEqual(validBlock());
        expect(parsed).not.toBe(validBlock());
    });

    it.each([
        ["null", null],
        ["a string", "block"],
        ["an array", []],
        ["missing id", { ...validBlock(), id: undefined }],
        ["empty id", { ...validBlock(), id: "" }],
        ["numeric roomId", { ...validBlock(), roomId: 5 }],
        ["range not an array", { ...validBlock(), range: "0-10" }],
        ["range of length 3", { ...validBlock(), range: [0, 5, 9] }],
        ["NaN in range", { ...validBlock(), range: [NaN, 10] }],
        ["infinite range end", { ...validBlock(), range: [0, Infinity] }],
        ["from > to", { ...validBlock(), range: [10, 0] }],
        ["total 0", { ...validBlock(), total: 0 }],
        ["total 1001", { ...validBlock(), total: 1001 }],
        ["fractional total", { ...validBlock(), total: 1.5 }],
        ["negative seq", { ...validBlock(), seq: -1 }],
        ["seq equal to total", { ...validBlock(), seq: 1, total: 1 }],
        ["fractional seq", { ...validBlock(), seq: 0.5 }],
        ["data not a string", { ...validBlock(), data: 42 }],
        ["empty data", { ...validBlock(), data: "" }],
        ["data over 100000", { ...validBlock(), data: "A".repeat(100_001) }],
    ])("rejects %s", (_name, content) => {
        expect(parseSyncBlock(content)).toBeNull();
    });
});

describe("parseSyncRequest", () => {
    const valid = () => ({
        id: "req1",
        rooms: [
            { roomId: "!r:x", missing: [[0, 10] as Range, [20, 30] as Range] },
        ],
    });

    it("accepts a well-formed request", () => {
        expect(parseSyncRequest(valid())).toEqual(valid());
    });

    it("accepts a request with no rooms", () => {
        expect(parseSyncRequest({ id: "req", rooms: [] })).toEqual({
            id: "req",
            rooms: [],
        });
    });

    it("accepts a room with no missing ranges", () => {
        expect(
            parseSyncRequest({
                id: "req",
                rooms: [{ roomId: "!r:x", missing: [] }],
            }),
        ).toEqual({ id: "req", rooms: [{ roomId: "!r:x", missing: [] }] });
    });

    it("accepts 200 rooms and 50 ranges", () => {
        const rooms = Array.from({ length: 200 }, (_, i) => ({
            roomId: `!r${i}:x`,
            missing: Array.from({ length: 50 }, (_, j): Range => [j, j]),
        }));
        expect(parseSyncRequest({ id: "req", rooms })).not.toBeNull();
    });

    it("rejects more than 200 rooms", () => {
        const rooms = Array.from({ length: 201 }, (_, i) => ({
            roomId: `!r${i}:x`,
            missing: [],
        }));
        expect(parseSyncRequest({ id: "req", rooms })).toBeNull();
    });

    it("rejects more than 50 ranges in a room", () => {
        const missing = Array.from({ length: 51 }, (_, j) => [j, j]);
        expect(
            parseSyncRequest({
                id: "req",
                rooms: [{ roomId: "!r:x", missing }],
            }),
        ).toBeNull();
    });

    it.each([
        ["null", null],
        ["missing id", { rooms: [] }],
        ["empty id", { id: "", rooms: [] }],
        ["rooms not an array", { id: "req", rooms: {} }],
        ["room is a string", { id: "req", rooms: ["!r:x"] }],
        ["room missing roomId", { id: "req", rooms: [{ missing: [] }] }],
        [
            "missing not an array",
            { id: "req", rooms: [{ roomId: "!r:x", missing: "x" }] },
        ],
        [
            "bad range inside missing",
            {
                id: "req",
                rooms: [
                    {
                        roomId: "!r:x",
                        missing: [
                            [0, 1],
                            [NaN, 2],
                        ],
                    },
                ],
            },
        ],
        [
            "reversed range inside missing",
            { id: "req", rooms: [{ roomId: "!r:x", missing: [[5, 1]] }] },
        ],
    ])("rejects %s", (_name, content) => {
        expect(parseSyncRequest(content)).toBeNull();
    });
});

describe("windowRanges", () => {
    const at = (t: number): IndexEntry => ({
        e: `$${t}`,
        s: "@a:x",
        t,
        m: "m.text",
        b: "x",
    });

    it("tiles the range exactly, newest first", () => {
        const entries = [10, 20, 30, 40, 50].map(at);
        const w = windowRanges(entries, [0, 100], 2);
        expect(w).toEqual([
            [50, 100],
            [30, 49],
            [0, 29],
        ]);
    });

    it("never splits entries with the same timestamp", () => {
        const entries = [10, 20, 20, 20, 30].map(at);
        const w = windowRanges(entries, [0, 99], 2);
        for (const [lo, hi] of w) expect(lo <= hi).toBe(true);
        const starts = w.map((r) => r[0]);
        // 20 appears three times: it can't be a window start between them.
        expect(entries.filter((e) => e.t === 20).length).toBe(3);
        expect(w.filter(([lo, hi]) => lo <= 20 && 20 <= hi).length).toBe(1);
        expect(starts[starts.length - 1]).toBe(0);
    });

    it("returns the whole range for few or no entries", () => {
        expect(windowRanges([], [5, 9], 100)).toEqual([[5, 9]]);
        expect(windowRanges([at(7)], [5, 9], 100)).toEqual([[5, 9]]);
    });
});

describe("peerRefusal", () => {
    const ok = {
        encrypted: true,
        fromUser: "@me:x",
        ownUserId: "@me:x",
        fromDevice: "PHONE",
        ownDeviceId: "DESK",
        verified: true,
        allowed: true,
    };

    it("accepts a verified session of our own account", () => {
        expect(peerRefusal(ok)).toBeNull();
    });

    it.each([
        [{ encrypted: false }, "not Olm-encrypted"],
        [{ fromUser: "@other:x" }, "not our own account"],
        [{ fromDevice: undefined }, "unknown device"],
        [{ fromDevice: "DESK" }, "from this session"],
        [{ verified: false }, "session is not verified"],
        [{ allowed: false }, "session excluded by our settings"],
    ])("refuses %j", (patch, why) => {
        expect(peerRefusal({ ...ok, ...patch })).toBe(why);
    });
});
