import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
    initPpmd,
    ppmdDecode,
    ppmdEncode,
    ppmdReady,
    type PpmdOptions,
} from "./ppmd";
import { PPMD_FIXTURE_CASES, PPMD_FIXTURE_INPUTS } from "./ppmd.fixtures";

const wasm = readFileSync(resolve(process.cwd(), "src/lib/utils/ppmd.wasm"));

function b64(s: string): Uint8Array {
    return new Uint8Array(Buffer.from(s, "base64"));
}

/** Deterministic PRNG (LCG) so generated inputs are stable across runs. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        return s >>> 8;
    };
}

function randomBytes(n: number, seed: number): Uint8Array {
    const next = rng(seed);
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = next() & 0xff;
    return out;
}

const WORDS = (
    "the of and to in is you that it he was for on are as with his they at be this have from or one had " +
    "compression model context symbol escape frequency range coder memory order stream archive message room"
).split(" ");

function englishLike(n: number, seed: number): Uint8Array {
    const next = rng(seed);
    const parts: string[] = [];
    let len = 0;
    while (len < n) {
        const k = 4 + (next() % 12);
        const words: string[] = [];
        for (let i = 0; i < k; i++) words.push(WORDS[next() % WORDS.length]);
        const s = words.join(" ") + (next() % 5 === 0 ? ", " : ". ");
        parts.push(s);
        len += s.length;
    }
    return new TextEncoder().encode(parts.join("").slice(0, n));
}

/** Varied input: text, binary, repeats and runs, to exercise model restarts. */
function mixed(n: number, seed: number): Uint8Array {
    const next = rng(seed);
    const out = new Uint8Array(n);
    let pos = 0;
    while (pos < n) {
        const r = next() % 10;
        const len = Math.min(n - pos, 200 + (next() % 20000));
        let seg: Uint8Array;
        if (r < 4) seg = englishLike(len, next());
        else if (r < 6) seg = randomBytes(len, next());
        else if (r < 8 && pos > 0) {
            const from = next() % Math.max(1, pos - len);
            seg = out.slice(from, from + len);
        } else seg = new Uint8Array(len).fill(next() & 0xff);
        out.set(seg.subarray(0, Math.min(seg.length, n - pos)), pos);
        pos += Math.min(seg.length, n - pos);
    }
    return out;
}

function expectBytes(actual: Uint8Array, expected: Uint8Array): void {
    expect(actual.length).toBe(expected.length);
    expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
}

function roundTrip(input: Uint8Array, opts: PpmdOptions): void {
    const packed = ppmdEncode(input, opts);
    expectBytes(ppmdDecode(packed, input.length, opts), input);
}

beforeAll(async () => {
    await initPpmd(wasm);
});

describe("ppmd wasm codec", () => {
    it("reports ready after init and is idempotent", async () => {
        expect(ppmdReady()).toBe(true);
        await expect(initPpmd(wasm)).resolves.toBeUndefined();
    });

    it("throws before init", async () => {
        vi.resetModules();
        const fresh = await import("./ppmd");
        expect(fresh.ppmdReady()).toBe(false);
        expect(() =>
            fresh.ppmdEncode(new Uint8Array(1), { order: 8, memSize: 65536 }),
        ).toThrow(/not initialised/);
    });

    describe("7-Zip oracle fixtures", () => {
        for (const c of PPMD_FIXTURE_CASES) {
            const input = b64(PPMD_FIXTURE_INPUTS[c.input]);
            const packed = b64(c.packed);
            const opts = { order: c.order, memSize: c.memSize };

            it(`decodes ${c.name} to its input`, () => {
                expectBytes(ppmdDecode(packed, input.length, opts), input);
            });

            it(`encodes ${c.name} to the 7-Zip packed bytes`, () => {
                expectBytes(ppmdEncode(input, opts), packed);
            });
        }
    });

    it("round-trips random and text data at several option sets", () => {
        const sets: PpmdOptions[] = [
            { order: 2, memSize: 2048 },
            { order: 6, memSize: 1 << 16 },
            { order: 8, memSize: 1 << 20 },
            { order: 16, memSize: 1 << 22 },
            { order: 64, memSize: 1 << 24 },
        ];
        const data = [
            englishLike(30000, 7),
            randomBytes(20000, 9),
            mixed(60000, 11),
        ];
        for (const opts of sets) for (const d of data) roundTrip(d, opts);
    });

    it("round-trips through memory-full model restarts (1 MiB, ~3 MB input)", () => {
        const input = mixed(3 * 1024 * 1024, 42);
        roundTrip(input, { order: 8, memSize: 1 << 20 });
    }, 60000);

    it("round-trips empty input", () => {
        for (const opts of [
            { order: 2, memSize: 2048 },
            { order: 8, memSize: 1 << 16 },
        ]) {
            const packed = ppmdEncode(new Uint8Array(0), opts);
            expect(packed.length).toBeGreaterThan(0);
            expect(ppmdDecode(packed, 0, opts).length).toBe(0);
        }
    });

    it("returns copies, not views into wasm memory", () => {
        const input = englishLike(1000, 3);
        const opts = { order: 8, memSize: 1 << 16 };
        const a = ppmdEncode(input, opts);
        const b = ppmdEncode(input, opts);
        expectBytes(a, b);
        const dec = ppmdDecode(a, input.length, opts);
        // A later call must not change an earlier result.
        ppmdDecode(ppmdEncode(randomBytes(500, 5), opts), 500, opts);
        expectBytes(dec, input);
    });

    it("rejects invalid options", () => {
        const data = new Uint8Array(4);
        expect(() => ppmdEncode(data, { order: 1, memSize: 65536 })).toThrow(
            RangeError,
        );
        expect(() => ppmdEncode(data, { order: 65, memSize: 65536 })).toThrow(
            RangeError,
        );
        expect(() => ppmdEncode(data, { order: 8, memSize: 2047 })).toThrow(
            RangeError,
        );
        expect(() =>
            ppmdDecode(data, 4, { order: 8.5, memSize: 65536 }),
        ).toThrow(RangeError);
        expect(() =>
            ppmdDecode(data, -1, { order: 8, memSize: 65536 }),
        ).toThrow(RangeError);
    });

    it("throws on every truncation of a small stream", () => {
        const c = PPMD_FIXTURE_CASES.find(
            (x) => x.name === "text4k_o8_mem16m",
        )!;
        const input = b64(PPMD_FIXTURE_INPUTS[c.input]);
        const packed = b64(c.packed);
        const opts = { order: c.order, memSize: c.memSize };
        for (let len = 0; len < packed.length; len++) {
            expect(
                () => ppmdDecode(packed.subarray(0, len), input.length, opts),
                `len ${len}`,
            ).toThrow();
        }
    });

    it("throws on trailing bytes after a complete stream", () => {
        const c = PPMD_FIXTURE_CASES.find(
            (x) => x.name === "text4k_o8_mem16m",
        )!;
        const input = b64(PPMD_FIXTURE_INPUTS[c.input]);
        const extended = new Uint8Array(b64(c.packed).length + 1);
        extended.set(b64(c.packed));
        expect(() =>
            ppmdDecode(extended, input.length, {
                order: c.order,
                memSize: c.memSize,
            }),
        ).toThrow();
    });

    it("does not hang on garbage input and still works afterwards", () => {
        const opts = { order: 8, memSize: 1 << 16 };
        const next = rng(1234);
        for (let trial = 0; trial < 300; trial++) {
            const len = 1 + (next() % 200);
            const junk = randomBytes(len, next());
            junk[0] = 0; // a valid range coder header byte, so the decoder really runs
            try {
                const out = ppmdDecode(junk, 2000, opts);
                expect(out.length).toBe(2000);
            } catch (err) {
                expect(err).toBeInstanceOf(Error);
            }
        }
        const data = englishLike(5000, 77);
        roundTrip(data, opts);
    });

    it("reports bad headers and wrong sizes as errors", () => {
        const opts = { order: 8, memSize: 1 << 16 };
        const packed = ppmdEncode(englishLike(2000, 8), opts);
        const badHeader = packed.slice();
        badHeader[0] = 1; // first byte of a 7z range coder stream must be zero
        expect(() => ppmdDecode(badHeader, 2000, opts)).toThrow(
            /bad range coder header/,
        );
        // Asking for more output than the stream holds must not read past the input.
        expect(() => ppmdDecode(packed, 200000, opts)).toThrow();
    });
});
