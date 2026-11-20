import { describe, it, expect } from "vitest";
import {
    decodeKey,
    decryptPrivate,
    encryptPrivate,
    fromBase64,
    generatePrivateKeyBytes,
    importPrivateKey,
    parseEnvelope,
    toBase64,
} from "./privateAccountDataCodec";

const TYPE = "com.zam.private.favourites";
const value = { gifs: [{ url: "https://example.org/a.gif", addedAt: 1 }] };

async function freshKey(): Promise<CryptoKey> {
    return importPrivateKey(generatePrivateKeyBytes());
}

describe("privateAccountDataCodec", () => {
    it("round-trips a value under the same key and type", async () => {
        const key = await freshKey();
        const env = await encryptPrivate(key, TYPE, value);
        expect(parseEnvelope(env)).not.toBeNull();
        expect(env.ciphertext).not.toContain("example.org");
        await expect(decryptPrivate(key, TYPE, env)).resolves.toEqual({
            ok: true,
            value,
        });
    });

    it("uses a fresh nonce for every encryption", async () => {
        const key = await freshKey();
        const a = await encryptPrivate(key, TYPE, value);
        const b = await encryptPrivate(key, TYPE, value);
        expect(a.iv).not.toBe(b.iv);
        expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("rejects a wrong key as undecryptable", async () => {
        const env = await encryptPrivate(await freshKey(), TYPE, value);
        await expect(
            decryptPrivate(await freshKey(), TYPE, env),
        ).resolves.toEqual({ ok: false, reason: "undecryptable" });
    });

    it("detects a tampered ciphertext", async () => {
        const key = await freshKey();
        const env = await encryptPrivate(key, TYPE, value);
        const bytes = fromBase64(env.ciphertext)!;
        bytes[0] ^= 0x01;
        const tampered = { ...env, ciphertext: toBase64(bytes) };
        await expect(decryptPrivate(key, TYPE, tampered)).resolves.toEqual({
            ok: false,
            reason: "undecryptable",
        });
    });

    it("detects a tampered nonce", async () => {
        const key = await freshKey();
        const env = await encryptPrivate(key, TYPE, value);
        const iv = fromBase64(env.iv)!;
        iv[11] ^= 0x80;
        const tampered = { ...env, iv: toBase64(iv) };
        const result = await decryptPrivate(key, TYPE, tampered);
        expect(result.ok).toBe(false);
    });

    it("binds the ciphertext to its account data type", async () => {
        const key = await freshKey();
        const env = await encryptPrivate(key, TYPE, value);
        await expect(
            decryptPrivate(key, "com.zam.private.other", env),
        ).resolves.toEqual({ ok: false, reason: "undecryptable" });
    });

    it("rejects malformed envelopes without throwing", async () => {
        const key = await freshKey();
        const env = await encryptPrivate(key, TYPE, value);
        const bad: unknown[] = [
            null,
            undefined,
            "text",
            [],
            {},
            { ...env, v: 2 },
            { ...env, alg: "AES-CBC" },
            { ...env, iv: 42 },
            { ...env, iv: "AAAA" },
            { ...env, ciphertext: "not base64!" },
            { ...env, ciphertext: "AAAA" },
            { gifs: [] },
        ];
        for (const raw of bad) {
            expect(parseEnvelope(raw)).toBeNull();
            await expect(decryptPrivate(key, TYPE, raw)).resolves.toEqual({
                ok: false,
                reason: "malformed",
            });
        }
    });

    it("reports plaintext that is not JSON", async () => {
        const key = await freshKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const sealed = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: new TextEncoder().encode(TYPE),
            },
            key,
            new TextEncoder().encode("{not json"),
        );
        const raw = {
            v: 1,
            alg: "A256GCM",
            iv: toBase64(iv),
            ciphertext: toBase64(new Uint8Array(sealed)),
        };
        await expect(decryptPrivate(key, TYPE, raw)).resolves.toEqual({
            ok: false,
            reason: "not-json",
        });
    });

    it("accepts only 32-byte keys", () => {
        expect(decodeKey(toBase64(generatePrivateKeyBytes()))?.length).toBe(32);
        expect(decodeKey(toBase64(new Uint8Array(16)))).toBeNull();
        expect(decodeKey(toBase64(new Uint8Array(33)))).toBeNull();
        expect(decodeKey(undefined)).toBeNull();
        expect(decodeKey("%%%")).toBeNull();
    });

    it("decodes only canonical base64", () => {
        expect(fromBase64("AQID")).toEqual(new Uint8Array([1, 2, 3]));
        expect(fromBase64("AQI")).toBeNull();
        expect(fromBase64("AQ I")).toBeNull();
    });
});
