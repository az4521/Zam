import { describe, expect, it } from "vitest";
import { encryptAttachment } from "./encryptAttachment";
import { decryptAttachment, createStreamDecryptor } from "./decryptAttachment";
import {
    contentRangeStart,
    resumeBodyReader,
    resumeOffset,
    type ByteReader,
} from "./thumbnailResume";

/** A body reader over `bytes`, yielding `chunk`-sized pieces (odd sizes help). */
function bodyOf(bytes: Uint8Array, chunk = 1000): ByteReader {
    let at = 0;
    return {
        async read() {
            if (at >= bytes.length) return { done: true, value: undefined };
            const value = bytes.slice(at, at + chunk);
            at += value.length;
            return { done: false, value };
        },
    };
}

async function drain(reader: ByteReader): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    for (;;) {
        const r = await reader.read();
        if (r.done) break;
        parts.push(r.value);
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

function plaintext(n: number): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (i * 31 + (i >> 8) * 7) & 0xff;
    return out;
}

const FILE_SIZE = 100_003; // not a block multiple, so the tail is a partial block

describe("resumeOffset", () => {
    it("is the last AES block boundary at or before the prefix end", () => {
        expect(resumeOffset(0)).toBe(0);
        expect(resumeOffset(15)).toBe(0);
        expect(resumeOffset(16)).toBe(16);
        expect(resumeOffset(17)).toBe(16);
        expect(resumeOffset(1_000_003)).toBe(1_000_000);
    });
});

describe("contentRangeStart", () => {
    it("reads the first byte of a satisfied range", () => {
        expect(contentRangeStart("bytes 16-99/100")).toBe(16);
        expect(contentRangeStart("bytes 0-0/1")).toBe(0);
    });
    it("is null for anything else", () => {
        expect(contentRangeStart(null)).toBeNull();
        expect(contentRangeStart("bytes */100")).toBeNull();
        expect(contentRangeStart("items 16-99/100")).toBeNull();
    });
});

describe("encrypted resume", () => {
    const cases = [0, 15, 16, 17, 65_537 /* large odd */, 4_099];
    for (const n of cases) {
        it(`prefix of ${n} bytes: ranged decrypt equals the full decrypt`, async () => {
            const plain = plaintext(FILE_SIZE).buffer as ArrayBuffer;
            const { data, info } = await encryptAttachment(plain);
            const cipher = new Uint8Array(data);
            const full = new Uint8Array(await decryptAttachment(data, info));
            const prefix = full.slice(0, n);

            const offset = resumeOffset(n);
            const reader = await resumeBodyReader(
                bodyOf(cipher.subarray(offset)),
                { prefix, decrypt: info },
            );
            const got = await drain(reader);
            expect(got).toEqual(full);
        });
    }

    it("rejects a tampered byte inside the held prefix (hash mismatch)", async () => {
        const { data, info } = await encryptAttachment(
            plaintext(FILE_SIZE).buffer as ArrayBuffer,
        );
        const cipher = new Uint8Array(data);
        const full = new Uint8Array(await decryptAttachment(data, info));
        const prefix = full.slice(0, 40_000);
        prefix[100] ^= 0x01; // inside the skipped part, not the overlap
        const reader = await resumeBodyReader(
            bodyOf(cipher.subarray(resumeOffset(prefix.length))),
            { prefix, decrypt: info },
        );
        await expect(drain(reader)).rejects.toThrow(/integrity/);
    });

    it("rejects a tampered overlap byte before any of the rest is passed on", async () => {
        const { data, info } = await encryptAttachment(
            plaintext(FILE_SIZE).buffer as ArrayBuffer,
        );
        const cipher = new Uint8Array(data);
        const full = new Uint8Array(await decryptAttachment(data, info));
        const n = 40_007; // 40_000 is the offset; 7 overlap bytes
        const prefix = full.slice(0, n);
        prefix[n - 1] ^= 0x80;
        const reader = await resumeBodyReader(
            bodyOf(cipher.subarray(resumeOffset(n))),
            { prefix, decrypt: info },
        );
        await expect(drain(reader)).rejects.toThrow(/does not match/);
    });

    it("the prefix bytes come out first, before the body is read", async () => {
        const { data, info } = await encryptAttachment(
            plaintext(FILE_SIZE).buffer as ArrayBuffer,
        );
        const full = new Uint8Array(await decryptAttachment(data, info));
        const prefix = full.slice(0, 5_000);
        let reads = 0;
        const body = bodyOf(new Uint8Array(data).subarray(4_992));
        const counted: ByteReader = {
            async read() {
                reads++;
                return body.read();
            },
        };
        const reader = await resumeBodyReader(counted, {
            prefix,
            decrypt: info,
        });
        const first = await reader.read();
        expect(first.done).toBe(false);
        expect(first.value).toEqual(full.slice(0, 4_992));
        expect(reads).toBe(0);
    });

    it("a resume offset that is not a block is refused", async () => {
        const { info } = await encryptAttachment(new ArrayBuffer(64));
        await expect(
            createStreamDecryptor(info, globalThis.crypto.subtle, {
                offset: 17,
                plaintext: new Uint8Array(17),
            }),
        ).rejects.toThrow(/block/);
    });
});

describe("plain resume", () => {
    it("yields the whole file from the held prefix and the body", async () => {
        const full = plaintext(FILE_SIZE);
        const n = 50_001;
        const reader = await resumeBodyReader(
            bodyOf(full.subarray(resumeOffset(n))),
            { prefix: full.slice(0, n) },
        );
        expect(await drain(reader)).toEqual(full);
    });

    it("rejects an overlap that does not match the file", async () => {
        const full = plaintext(FILE_SIZE);
        const n = 50_001;
        const prefix = full.slice(0, n);
        prefix[n - 1] ^= 0x10; // the overlap is [offset, n): its last byte
        const reader = await resumeBodyReader(
            bodyOf(full.subarray(resumeOffset(n))),
            { prefix },
        );
        await expect(drain(reader)).rejects.toThrow(/does not match/);
    });

    it("rejects a file shorter than its prefix", async () => {
        const full = plaintext(FILE_SIZE);
        const n = 50_001;
        // The body stops one byte inside the overlap.
        const short = full.subarray(resumeOffset(n), n - 1);
        const reader = await resumeBodyReader(bodyOf(short), {
            prefix: full.slice(0, n),
        });
        await expect(drain(reader)).rejects.toThrow(/shorter/);
    });

    it("a prefix under one block resumes from byte 0 with nothing to skip", async () => {
        const full = plaintext(FILE_SIZE);
        const reader = await resumeBodyReader(bodyOf(full), {
            prefix: full.slice(0, 9),
        });
        expect(await drain(reader)).toEqual(full);
    });
});
