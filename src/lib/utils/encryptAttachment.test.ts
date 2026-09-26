import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
    encryptAttachment,
    shouldEncryptUpload,
    thumbnailFields,
} from "./encryptAttachment";
import { decryptAttachment, base64ToBytes } from "./decryptAttachment";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const getRandomValues = webcrypto.getRandomValues.bind(
    webcrypto,
) as unknown as (array: Uint8Array) => Uint8Array;
const enc = new TextEncoder();

describe("encryptAttachment", () => {
    it("round-trips through decryptAttachment", async () => {
        const plaintext = enc.encode("hello encrypted world");
        const { data, info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        const decrypted = await decryptAttachment(data, info, subtle);
        expect(Array.from(new Uint8Array(decrypted))).toEqual(
            Array.from(plaintext),
        );
    });

    it("round-trips a larger binary attachment", async () => {
        const plaintext = webcrypto.getRandomValues(new Uint8Array(5000));
        const { data, info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        const decrypted = await decryptAttachment(data, info, subtle);
        expect(Array.from(new Uint8Array(decrypted))).toEqual(
            Array.from(plaintext),
        );
    });

    it("produces an IV with 16 bytes and low 8 bytes zero", async () => {
        const plaintext = enc.encode("test");
        const { info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        const iv = base64ToBytes(info.iv);
        expect(iv.length).toBe(16);
        // Low 8 bytes (indices 8..15) must be zero
        for (let i = 8; i < 16; i++) {
            expect(iv[i]).toBe(0);
        }
    });

    it("produces a ciphertext that makes decryptAttachment throw when tampered", async () => {
        const plaintext = enc.encode("secret");
        const { data, info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        const tampered = data.slice(0);
        new Uint8Array(tampered)[0] ^= 0xff;
        await expect(decryptAttachment(tampered, info, subtle)).rejects.toThrow(
            /integrity/i,
        );
    });

    it("produces the exact JWK shape", async () => {
        const plaintext = enc.encode("test");
        const { info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        expect(info.v).toBe("v2");
        expect(info.key.kty).toBe("oct");
        expect(info.key.alg).toBe("A256CTR");
        expect(info.key.ext).toBe(true);
        expect(info.key.key_ops).toEqual(["encrypt", "decrypt"]);
        expect(typeof info.key.k).toBe("string");
        expect(typeof info.iv).toBe("string");
        expect(typeof info.hashes.sha256).toBe("string");
    });

    it("produces unpadded base64url k (no = + /)", async () => {
        const plaintext = enc.encode("test");
        const { info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        // No padding
        expect(info.key.k).not.toContain("=");
        // URL-safe (no + or /)
        expect(info.key.k).not.toContain("+");
        expect(info.key.k).not.toContain("/");
    });

    it("produces unpadded base64 iv and sha256 (no =)", async () => {
        const plaintext = enc.encode("test");
        const { info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        expect(info.iv).not.toContain("=");
        expect(info.hashes.sha256).not.toContain("=");
    });

    it("produces different keys and IVs on two calls", async () => {
        const plaintext = enc.encode("same plaintext");
        const enc1 = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        const enc2 = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        expect(enc1.info.key.k).not.toBe(enc2.info.key.k);
        expect(enc1.info.iv).not.toBe(enc2.info.iv);
    });

    it("produces ciphertext different from plaintext", async () => {
        const plaintext = enc.encode("plaintext bytes");
        const { data } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        expect(Array.from(new Uint8Array(data))).not.toEqual(
            Array.from(plaintext),
        );
    });

    it("does not include url in the returned info", async () => {
        const plaintext = enc.encode("test");
        const { info } = await encryptAttachment(
            plaintext.buffer,
            subtle,
            getRandomValues,
        );
        expect("url" in info).toBe(false);
    });
});

describe("shouldEncryptUpload", () => {
    it("returns false when room is not encrypted", () => {
        expect(shouldEncryptUpload(false, "m.image")).toBe(false);
        expect(shouldEncryptUpload(false, "m.file")).toBe(false);
        expect(shouldEncryptUpload(false, "m.video")).toBe(false);
        expect(shouldEncryptUpload(false, "m.audio")).toBe(false);
    });

    it("returns false for m.video even when room is encrypted", () => {
        expect(shouldEncryptUpload(true, "m.video")).toBe(false);
    });

    it("returns true for non-video types when room is encrypted", () => {
        expect(shouldEncryptUpload(true, "m.image")).toBe(true);
        expect(shouldEncryptUpload(true, "m.file")).toBe(true);
        expect(shouldEncryptUpload(true, "m.audio")).toBe(true);
    });
});

describe("thumbnailFields", () => {
    it("maps a plaintext upload to thumbnail_url only", () => {
        expect(thumbnailFields({ url: "mxc://s/thumb" })).toEqual({
            thumbnail_url: "mxc://s/thumb",
        });
    });

    it("maps an encrypted upload to thumbnail_file only", () => {
        const file = {
            v: "v2",
            key: { kty: "oct", alg: "A256CTR", k: "abc", ext: true },
            iv: "iv",
            hashes: { sha256: "h" },
            url: "mxc://s/thumb",
        };
        const out = thumbnailFields({ file });
        expect(out).toEqual({ thumbnail_file: file });
        expect(out).not.toHaveProperty("thumbnail_url");
    });
});
