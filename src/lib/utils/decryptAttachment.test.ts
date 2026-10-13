import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
    decryptAttachment,
    createStreamDecryptor,
    base64ToBytes,
    type EncryptedFileInfo,
} from "./decryptAttachment";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

function bytesToBase64(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}
function bytesToBase64url(bytes: Uint8Array): string {
    return bytesToBase64(bytes)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/** Produce a valid Matrix-style encrypted attachment from a known plaintext. */
async function encryptFixture(
    plaintext: Uint8Array<ArrayBuffer>,
    lowCounter = 0n,
) {
    const keyBytes = new Uint8Array(32);
    webcrypto.getRandomValues(keyBytes);
    // 16-byte counter block: random 64-bit nonce in the high half, low half 0
    // unless a caller wants to start near the 2^64 wrap.
    const iv = new Uint8Array(16);
    const nonce = new Uint8Array(8);
    webcrypto.getRandomValues(nonce);
    iv.set(nonce, 0);
    new DataView(iv.buffer).setBigUint64(8, lowCounter);
    const key = await subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-CTR" },
        false,
        ["encrypt"],
    );
    const ciphertext = await subtle.encrypt(
        { name: "AES-CTR", counter: iv, length: 64 },
        key,
        plaintext,
    );
    const digest = await subtle.digest("SHA-256", ciphertext);
    const info: EncryptedFileInfo = {
        key: {
            kty: "oct",
            alg: "A256CTR",
            ext: true,
            key_ops: ["encrypt", "decrypt"],
            k: bytesToBase64url(keyBytes),
        },
        iv: bytesToBase64(iv),
        hashes: { sha256: bytesToBase64(new Uint8Array(digest)) },
        v: "v2",
    };
    return { ciphertext, info };
}

const enc = new TextEncoder();

describe("base64ToBytes", () => {
    it("decodes standard padded base64", () => {
        expect([...base64ToBytes("aGVsbG8=")]).toEqual([
            ...enc.encode("hello"),
        ]);
    });
    it("decodes unpadded base64", () => {
        expect([...base64ToBytes("aGVsbG8")]).toEqual([...enc.encode("hello")]);
    });
    it("decodes url-safe base64 (- and _)", () => {
        // 0xfb 0xff 0xbf -> standard "+/+/" ; url-safe "-_-_"
        const std = base64ToBytes("-_-_");
        const url = base64ToBytes("+/+/");
        expect([...std]).toEqual([...url]);
    });
    it("rejects an impossible length", () => {
        expect(() => base64ToBytes("A")).toThrow();
    });
});

describe("decryptAttachment", () => {
    it("round-trips a short text attachment", async () => {
        const plaintext = enc.encode("hello encrypted world");
        const { ciphertext, info } = await encryptFixture(plaintext);
        const out = await decryptAttachment(ciphertext, info, subtle);
        expect(Array.from(new Uint8Array(out))).toEqual(Array.from(plaintext));
    });

    it("round-trips a larger binary attachment", async () => {
        const plaintext = webcrypto.getRandomValues(new Uint8Array(5000));
        const { ciphertext, info } = await encryptFixture(plaintext);
        const out = await decryptAttachment(ciphertext, info, subtle);
        expect(Array.from(new Uint8Array(out))).toEqual(Array.from(plaintext));
    });

    it("rejects a hash mismatch instead of returning plaintext", async () => {
        const { ciphertext, info } = await encryptFixture(enc.encode("secret"));
        // corrupt the declared hash
        const bad = {
            ...info,
            hashes: { sha256: bytesToBase64(new Uint8Array(32)) },
        };
        await expect(
            decryptAttachment(ciphertext, bad, subtle),
        ).rejects.toThrow(/integrity/i);
    });

    it("rejects when the ciphertext was tampered with", async () => {
        const { ciphertext, info } = await encryptFixture(enc.encode("secret"));
        const tampered = ciphertext.slice(0);
        new Uint8Array(tampered)[0] ^= 0xff;
        await expect(decryptAttachment(tampered, info, subtle)).rejects.toThrow(
            /integrity/i,
        );
    });

    it("throws on a missing key / iv / hash", async () => {
        const { ciphertext, info } = await encryptFixture(enc.encode("x"));
        await expect(
            decryptAttachment(ciphertext, { ...info, key: { k: "" } }, subtle),
        ).rejects.toThrow(/key/i);
        await expect(
            decryptAttachment(ciphertext, { ...info, iv: "" }, subtle),
        ).rejects.toThrow(/iv/i);
        await expect(
            decryptAttachment(
                ciphertext,
                { ...info, hashes: {} as { sha256: string } },
                subtle,
            ),
        ).rejects.toThrow(/hash/i);
    });

    it("rejects a key that is not 256 bits", async () => {
        const { ciphertext, info } = await encryptFixture(enc.encode("x"));
        const shortKey = {
            ...info,
            key: { ...info.key, k: bytesToBase64url(new Uint8Array(16)) },
        };
        // hash still matches (over ciphertext), so this reaches the key check
        await expect(
            decryptAttachment(ciphertext, shortKey, subtle),
        ).rejects.toThrow(/256 bits/i);
    });
});

/** Feed `ciphertext` through a StreamDecryptor in `size`-byte pieces. */
async function streamDecrypt(
    ciphertext: ArrayBuffer,
    info: EncryptedFileInfo,
    size: number,
): Promise<Uint8Array> {
    const dec = await createStreamDecryptor(info, subtle);
    const bytes = new Uint8Array(ciphertext);
    const parts: Uint8Array[] = [];
    for (let at = 0; at < bytes.length; at += size) {
        parts.push(await dec.push(bytes.slice(at, at + size)));
    }
    parts.push(await dec.finish());
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

describe("createStreamDecryptor", () => {
    // Sizes straddling the 16-byte AES block on purpose: 1 and 7 never fill a
    // block, 16 is exact, 17 and 1000 leave a remainder every time.
    it.each([1, 7, 16, 17, 1000])(
        "matches the one-shot result in %i-byte chunks",
        async (size) => {
            const plaintext = webcrypto.getRandomValues(new Uint8Array(2053));
            const { ciphertext, info } = await encryptFixture(plaintext);
            const out = await streamDecrypt(ciphertext, info, size);
            expect(Array.from(out)).toEqual(Array.from(plaintext));
        },
    );

    it("keeps the counter right across the 2^64 wrap", async () => {
        const plaintext = webcrypto.getRandomValues(new Uint8Array(160));
        // Two blocks before the wrap, so most of the stream is past it.
        const { ciphertext, info } = await encryptFixture(
            plaintext,
            (1n << 64n) - 2n,
        );
        const out = await streamDecrypt(ciphertext, info, 23);
        expect(Array.from(out)).toEqual(Array.from(plaintext));
    });

    it("handles an empty file", async () => {
        const { ciphertext, info } = await encryptFixture(new Uint8Array(0));
        const out = await streamDecrypt(ciphertext, info, 16);
        expect(out.length).toBe(0);
    });

    it("rejects at finish() when the ciphertext was tampered with", async () => {
        const { ciphertext, info } = await encryptFixture(
            webcrypto.getRandomValues(new Uint8Array(100)),
        );
        const tampered = ciphertext.slice(0);
        new Uint8Array(tampered)[50] ^= 0xff;
        const dec = await createStreamDecryptor(info, subtle);
        // Chunks decrypt without complaint: the hash can only be checked once
        // everything has arrived.
        await dec.push(new Uint8Array(tampered));
        await expect(dec.finish()).rejects.toThrow(/integrity/i);
    });

    it("rejects at finish() when the stream was truncated", async () => {
        const { ciphertext, info } = await encryptFixture(
            webcrypto.getRandomValues(new Uint8Array(100)),
        );
        const dec = await createStreamDecryptor(info, subtle);
        await dec.push(new Uint8Array(ciphertext).slice(0, 64));
        await expect(dec.finish()).rejects.toThrow(/integrity/i);
    });

    it("throws on a missing key / iv / hash, and a short key", async () => {
        const { info } = await encryptFixture(enc.encode("x"));
        await expect(
            createStreamDecryptor({ ...info, key: { k: "" } }, subtle),
        ).rejects.toThrow(/key/i);
        await expect(
            createStreamDecryptor({ ...info, iv: "" }, subtle),
        ).rejects.toThrow(/iv/i);
        await expect(
            createStreamDecryptor(
                { ...info, hashes: {} as { sha256: string } },
                subtle,
            ),
        ).rejects.toThrow(/hash/i);
        await expect(
            createStreamDecryptor(
                {
                    ...info,
                    key: {
                        ...info.key,
                        k: bytesToBase64url(new Uint8Array(16)),
                    },
                },
                subtle,
            ),
        ).rejects.toThrow(/256 bits/i);
    });
});
