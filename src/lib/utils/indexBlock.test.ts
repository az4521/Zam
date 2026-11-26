import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { initPpmd } from "./ppmd";
import {
    decodeBlockKeys,
    decodeIndexBlock,
    encodeIndexBlock,
    eventIdHash,
    ppmdBlockCodec,
    storedBlockCodec,
    type CompactEntry,
    type EncodedIndexBlock,
} from "./indexBlock";

const base = (i: number, over: Partial<CompactEntry> = {}): CompactEntry => ({
    h: (i * 2654435761) >>> 0,
    t: 1_700_000_000_000 + i * 1000,
    s: "@alice:hs",
    m: "m.text",
    b: `message ${i}`,
    ...over,
});

const utf8Len = (s: string): number => new TextEncoder().encode(s).length;

function varied(): CompactEntry[] {
    const many: CompactEntry[] = Array.from({ length: 300 }, (_, i) =>
        base(100 + i, {
            s: `@user${i}:hs`,
            t: 1_700_000_003_000 + i,
            b: `msg ${i}`,
        }),
    );
    return [
        base(0, { b: "héllo wörld 👋🏽 中文 한국어" }),
        base(1, { h: 0xffffffff, t: 1_700_000_000_000, b: "" }),
        base(2, { b: "line1\nline2\r\n\n" }),
        base(3, { b: "fixed typo", o: 0xdeadbeef }),
        base(4, { m: "m.audio", b: "voice note", v: 1 }),
        base(5, { m: "m.image", b: "pics", g: ["m.image", "m.video"] }),
        base(6, { m: "m.image", b: "empty gallery", g: [] }),
        base(7, { h: 0, t: 0, s: "", m: "", b: "epoch zero" }),
        base(8, {
            t: Number.MAX_SAFE_INTEGER,
            b: "far future",
            v: 1,
            o: 1,
            g: ["x"],
        }),
        ...many,
    ];
}

/** Stable sort by t, the order decodeIndexBlock must return. */
const sortedByT = (xs: CompactEntry[]): CompactEntry[] =>
    xs.slice().sort((a, b) => a.t - b.t);

describe("eventIdHash", () => {
    it("is FNV-1a 32 over the id string", () => {
        expect(eventIdHash("")).toBe(0x811c9dc5);
        expect(eventIdHash("$abc")).toBe(0x06461f6d);
    });

    it("always returns a uint32", () => {
        for (const id of ["$x", "!room:hs", "$é👋", "￿"]) {
            const h = eventIdHash(id);
            expect(Number.isInteger(h)).toBe(true);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThanOrEqual(0xffffffff);
        }
    });
});

describe("encodeIndexBlock / decodeIndexBlock (stored codec)", () => {
    it("round trips varied entries in ascending timestamp order", () => {
        const entries = varied();
        const before = entries.map((e) => e.h);
        const block = encodeIndexBlock(entries, storedBlockCodec);
        expect(entries.map((e) => e.h)).toEqual(before);
        const decoded = decodeIndexBlock(block, storedBlockCodec);
        expect(decoded).toEqual(sortedByT(entries));
    });

    it("keeps v, o and g presence exactly (empty g stays an empty array)", () => {
        const block = encodeIndexBlock(
            [base(0), base(1, { v: 1 }), base(2, { g: [] })],
            storedBlockCodec,
        );
        const [a, b, c] = decodeIndexBlock(block, storedBlockCodec);
        expect("v" in a).toBe(false);
        expect(b.v).toBe(1);
        expect("o" in a).toBe(false);
        expect("g" in a).toBe(false);
        expect(c.g).toEqual([]);
    });

    it("keeps equal timestamps in input order (stable sort)", () => {
        const entries = [
            base(0, { t: 5, b: "first" }),
            base(1, { t: 5, b: "second" }),
            base(2, { t: 3, b: "earliest" }),
        ];
        const decoded = decodeIndexBlock(
            encodeIndexBlock(entries, storedBlockCodec),
            storedBlockCodec,
        );
        expect(decoded.map((e) => e.b)).toEqual([
            "earliest",
            "first",
            "second",
        ]);
    });

    it("round trips an empty block", () => {
        const block = encodeIndexBlock([], storedBlockCodec);
        expect(decodeIndexBlock(block, storedBlockCodec)).toEqual([]);
        const keys = decodeBlockKeys(block, storedBlockCodec);
        expect(keys.count).toBe(0);
        expect(keys.bodyRaw).toBe(0);
    });

    it("replaces U+0000 in bodies with U+FFFD", () => {
        const block = encodeIndexBlock(
            [base(0, { b: "a\u0000b\u0000" }), base(1, { b: "\u0000" })],
            storedBlockCodec,
        );
        const decoded = decodeIndexBlock(block, storedBlockCodec);
        expect(decoded.map((e) => e.b)).toEqual(["a�b�", "�"]);
    });

    it("rejects invalid entries before encoding", () => {
        expect(() =>
            encodeIndexBlock([base(0, { t: -1 })], storedBlockCodec),
        ).toThrow();
        expect(() =>
            encodeIndexBlock([base(0, { t: 1.5 })], storedBlockCodec),
        ).toThrow();
        expect(() =>
            encodeIndexBlock([base(0, { h: 2 ** 32 })], storedBlockCodec),
        ).toThrow();
        expect(() =>
            encodeIndexBlock([base(0, { o: -1 })], storedBlockCodec),
        ).toThrow();
    });
});

describe("decodeBlockKeys", () => {
    it("matches the decoded entries without reading the body", () => {
        const entries = varied();
        const block = encodeIndexBlock(entries, storedBlockCodec);
        const sorted = sortedByT(entries);
        const keys = decodeBlockKeys(block, storedBlockCodec);
        expect(keys.count).toBe(entries.length);
        expect(Array.from(keys.h)).toEqual(sorted.map((e) => e.h));
        expect(Array.from(keys.t)).toEqual(sorted.map((e) => e.t));
        expect(keys.minTs).toBe(sorted[0].t);
        expect(keys.maxTs).toBe(sorted[sorted.length - 1].t);
        const bodyRaw = sorted.reduce(
            (n, e) => n + utf8Len(e.b.split("\u0000").join("�")) + 1,
            0,
        );
        expect(keys.bodyRaw).toBe(bodyRaw);
    });

    it("decodes keys from a block whose body is garbage", () => {
        const block = encodeIndexBlock([base(0), base(1)], storedBlockCodec);
        const keys = decodeBlockKeys(
            { meta: block.meta, body: new Uint8Array(0) },
            storedBlockCodec,
        );
        expect(keys.count).toBe(2);
    });
});

describe("untrusted input", () => {
    const small = (): EncodedIndexBlock =>
        encodeIndexBlock(
            [
                base(0, { s: "@a:hs", m: "m.text", b: "one", o: 7 }),
                base(1, { s: "@b:hs", m: "m.image", b: "two", g: ["m.video"] }),
                base(2, { s: "@a:hs", b: "three", v: 1 }),
            ],
            storedBlockCodec,
        );

    it("every truncation of a valid meta throws", () => {
        const block = small();
        for (let n = 0; n < block.meta.length; n++) {
            const cut = { meta: block.meta.slice(0, n), body: block.body };
            expect(() => decodeBlockKeys(cut, storedBlockCodec)).toThrow();
            expect(() => decodeIndexBlock(cut, storedBlockCodec)).toThrow();
        }
    });

    it("every truncation of a valid body throws", () => {
        const block = small();
        for (let n = 0; n < block.body.length; n++) {
            const cut = { meta: block.meta, body: block.body.slice(0, n) };
            expect(() => decodeIndexBlock(cut, storedBlockCodec)).toThrow();
        }
    });

    it("a body with the wrong number of terminators throws", () => {
        const block = small();
        const body = block.body.slice();
        body[body.indexOf(0)] = 0x41;
        expect(() =>
            decodeIndexBlock({ meta: block.meta, body }, storedBlockCodec),
        ).toThrow(/terminator/);
    });

    it("rejects an unknown format version", () => {
        const block = small();
        const meta = block.meta.slice();
        meta[0] = 3;
        expect(() =>
            decodeBlockKeys({ meta, body: block.body }, storedBlockCodec),
        ).toThrow();
    });

    it("rejects counts and raw sizes above the caps", () => {
        // version 2, count 200001 (varint C1 9A 0C), meta codec/p1/p2, raw 0, body codec/p1/p2, raw 0
        const tooMany = new Uint8Array([
            2, 0xc1, 0x9a, 0x0c, 0, 0, 0, 0, 0, 0, 0, 0,
        ]);
        expect(() =>
            decodeBlockKeys(
                { meta: tooMany, body: new Uint8Array(0) },
                storedBlockCodec,
            ),
        ).toThrow(/count/);
        // meta raw size 64 MiB + 1, must be refused before any allocation
        const huge = new Uint8Array([
            2, 0, 0, 0, 0, 0x81, 0x80, 0x80, 0x20, 0, 0, 0, 0,
        ]);
        expect(() =>
            decodeBlockKeys(
                { meta: huge, body: new Uint8Array(0) },
                storedBlockCodec,
            ),
        ).toThrow(/size/);
    });

    it("random garbage either decodes or throws an Error", () => {
        let seed = 0x9e3779b9;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 0x100000000;
        };
        for (let iter = 0; iter < 500; iter++) {
            const meta = new Uint8Array(Math.floor(rand() * 80));
            for (let i = 0; i < meta.length; i++) {
                meta[i] = Math.floor(rand() * 256);
            }
            if (meta.length > 0 && rand() < 0.5) meta[0] = 2;
            const body = new Uint8Array(Math.floor(rand() * 40));
            for (let i = 0; i < body.length; i++) {
                body[i] = Math.floor(rand() * 256);
            }
            try {
                decodeIndexBlock({ meta, body }, storedBlockCodec);
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
            }
        }
    });
});

describe("ppmdBlockCodec", () => {
    beforeAll(async () => {
        await initPpmd(readFileSync("src/lib/utils/ppmd.wasm"));
    });

    it("round trips varied entries through PPMd", () => {
        const entries = varied();
        const block = encodeIndexBlock(entries, ppmdBlockCodec);
        expect(decodeIndexBlock(block, ppmdBlockCodec)).toEqual(
            sortedByT(entries),
        );
        expect(decodeBlockKeys(block, ppmdBlockCodec).count).toBe(
            entries.length,
        );
    });
});

describe("origin timestamps (ot)", () => {
    const base = (id: string, t: number, extra: Partial<CompactEntry> = {}) =>
        ({
            h: eventIdHash(id),
            t,
            s: "@a:x",
            m: "m.text",
            b: `body ${id}`,
            ...extra,
        }) as CompactEntry;

    it("round-trips the original's time of each edit, before or after it", () => {
        const entries: CompactEntry[] = [
            base("$orig", 1000),
            base("$e1", 2000, { o: eventIdHash("$orig"), ot: 1000 }),
            base("$e2", 3000, { o: eventIdHash("$orig"), ot: 1500 }),
            // An edit whose original is stamped later (clock skew): the delta is negative.
            base("$e3", 4000, { o: eventIdHash("$other"), ot: 5000 }),
            base("$e4", 6000, { o: eventIdHash("$lost") }),
        ];
        const enc = encodeIndexBlock(entries, storedBlockCodec);
        const back = decodeIndexBlock(enc, storedBlockCodec);
        expect(back).toEqual([...entries].sort((a, b) => a.t - b.t));
        expect(back.find((e) => e.h === eventIdHash("$e4"))).not.toHaveProperty(
            "ot",
        );
    });

    it("lists each timed edit's original (hash and time) in the keys", () => {
        const enc = encodeIndexBlock(
            [
                base("$orig", 1000),
                base("$e1", 2000, { o: eventIdHash("$orig"), ot: 1000 }),
                base("$e4", 6000, { o: eventIdHash("$lost") }),
            ],
            storedBlockCodec,
        );
        const keys = decodeBlockKeys(enc, storedBlockCodec);
        expect(Array.from(keys.targets)).toEqual([eventIdHash("$orig")]);
        expect(Array.from(keys.targetTs)).toEqual([1000]);
    });

    it("refuses an origin time without an edit target", () => {
        expect(() =>
            encodeIndexBlock([base("$x", 1, { ot: 1 })], storedBlockCodec),
        ).toThrow();
    });

    it("rejects a block whose origin time is out of range", () => {
        const enc = encodeIndexBlock(
            [
                base("$orig", 1000),
                base("$e", 2000, { o: eventIdHash("$orig"), ot: 1000 }),
            ],
            storedBlockCodec,
        );
        // Meta ends with: the two flag bytes, the edit's u32 target, then the
        // edit's origin delta (zigzag of 1000: two varint bytes). Set a
        // reserved bit on the edit's flags byte.
        const meta = new Uint8Array(enc.meta);
        const flagIdx = meta.length - 7;
        meta[flagIdx] |= 0x40;
        expect(() =>
            decodeIndexBlock({ meta, body: enc.body }, storedBlockCodec),
        ).toThrow();
    });
});
