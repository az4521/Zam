import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
    decryptAttachment,
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
async function encryptFixture(plaintext: Uint8Array<ArrayBuffer>) {
    const keyBytes = new Uint8Array(32);
    webcrypto.getRandomValues(keyBytes);
    // 16-byte counter block: random 64-bit nonce in the high half, low half 0.
    const iv = new Uint8Array(16);
    const nonce = new Uint8Array(8);
    webcrypto.getRandomValues(nonce);
    iv.set(nonce, 0);
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
