import { describe, it, expect } from "vitest";
import {
    unwrapPrivateKey,
    wrapNeedsUpdate,
    wrapPrivateKey,
    type BackupWrapContent,
} from "./privateKeyBackupWrap";
import {
    fromBase64,
    generatePrivateKeyBytes,
    toBase64,
} from "./privateAccountDataCodec";

const VERSION = "7";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function wrapped(
    priv = generatePrivateKeyBytes(),
    backup = generatePrivateKeyBytes(),
    version = VERSION,
): Promise<{
    priv: Uint8Array<ArrayBuffer>;
    backup: Uint8Array<ArrayBuffer>;
    content: BackupWrapContent;
}> {
    const content = await wrapPrivateKey(priv, backup, version);
    return { priv, backup, content };
}

describe("privateKeyBackupWrap", () => {
    it("round-trips the private key under the same backup key and version", async () => {
        const { priv, backup, content } = await wrapped();
        expect(content.v).toBe(1);
        expect(content.backup_version).toBe(VERSION);
        expect(content.ciphertext).not.toBe(toBase64(priv));
        const out = await unwrapPrivateKey(content, backup, VERSION);
        expect(out).not.toBeNull();
        expect(bytesEqual(out!, priv)).toBe(true);
    });

    it("uses a fresh nonce on every wrap", async () => {
        const priv = generatePrivateKeyBytes();
        const backup = generatePrivateKeyBytes();
        const a = await wrapPrivateKey(priv, backup, VERSION);
        const b = await wrapPrivateKey(priv, backup, VERSION);
        expect(a.iv).not.toBe(b.iv);
        expect(a.ciphertext).not.toBe(b.ciphertext);
    });

    it("refuses a private key that is not 32 bytes", async () => {
        await expect(
            wrapPrivateKey(
                new Uint8Array(16),
                generatePrivateKeyBytes(),
                VERSION,
            ),
        ).rejects.toThrow();
    });

    it("returns null for a wrong backup key", async () => {
        const { content } = await wrapped();
        await expect(
            unwrapPrivateKey(content, generatePrivateKeyBytes(), VERSION),
        ).resolves.toBeNull();
    });

    it("returns null when the backup version does not match", async () => {
        const { backup, content } = await wrapped();
        await expect(
            unwrapPrivateKey(content, backup, "8"),
        ).resolves.toBeNull();
    });

    it("returns null when the content claims another version (tag is bound to it)", async () => {
        const { backup, content } = await wrapped();
        const relabelled = { ...content, backup_version: "8" };
        await expect(
            unwrapPrivateKey(relabelled, backup, "8"),
        ).resolves.toBeNull();
    });

    it("returns null for malformed content", async () => {
        const backup = generatePrivateKeyBytes();
        const bad: unknown[] = [
            null,
            undefined,
            "text",
            [],
            {},
            { v: 2, backup_version: VERSION, iv: "", ciphertext: "" },
            { v: 1, backup_version: 7, iv: "", ciphertext: "" },
            { v: 1, backup_version: VERSION, iv: 12, ciphertext: "" },
            { v: 1, backup_version: VERSION, iv: "AAAA", ciphertext: "AAAA" },
            {
                v: 1,
                backup_version: VERSION,
                iv: "not base64!",
                ciphertext: "x",
            },
        ];
        for (const raw of bad) {
            await expect(
                unwrapPrivateKey(raw, backup, VERSION),
            ).resolves.toBeNull();
        }
    });

    it("returns null when the ciphertext or iv is tampered with", async () => {
        const { backup, content } = await wrapped();
        const ct = fromBase64(content.ciphertext)!;
        ct[0] ^= 0x01;
        const flipped = { ...content, ciphertext: toBase64(ct) };
        await expect(
            unwrapPrivateKey(flipped, backup, VERSION),
        ).resolves.toBeNull();

        const iv = fromBase64(content.iv)!;
        iv[0] ^= 0x01;
        const newIv = { ...content, iv: toBase64(iv) };
        await expect(
            unwrapPrivateKey(newIv, backup, VERSION),
        ).resolves.toBeNull();
    });

    it("returns null for a truncated ciphertext", async () => {
        const { backup, content } = await wrapped();
        const short = toBase64(fromBase64(content.ciphertext)!.slice(0, 40));
        await expect(
            unwrapPrivateKey(
                { ...content, ciphertext: short },
                backup,
                VERSION,
            ),
        ).resolves.toBeNull();
    });

    describe("wrapNeedsUpdate", () => {
        it("is true when the copy is missing or empty", async () => {
            const priv = generatePrivateKeyBytes();
            const backup = generatePrivateKeyBytes();
            await expect(
                wrapNeedsUpdate(null, backup, VERSION, priv),
            ).resolves.toBe(true);
            await expect(
                wrapNeedsUpdate({}, backup, VERSION, priv),
            ).resolves.toBe(true);
        });

        it("is false when the copy already holds this key under this version", async () => {
            const { priv, backup, content } = await wrapped();
            await expect(
                wrapNeedsUpdate(content, backup, VERSION, priv),
            ).resolves.toBe(false);
        });

        it("is true for another backup version", async () => {
            const { priv, backup, content } = await wrapped();
            await expect(
                wrapNeedsUpdate(content, backup, "8", priv),
            ).resolves.toBe(true);
        });

        it("is true when the copy holds a different private key", async () => {
            const { backup, content } = await wrapped();
            await expect(
                wrapNeedsUpdate(
                    content,
                    backup,
                    VERSION,
                    generatePrivateKeyBytes(),
                ),
            ).resolves.toBe(true);
        });

        it("is true when the copy does not unwrap with this backup key", async () => {
            const { priv, content } = await wrapped();
            await expect(
                wrapNeedsUpdate(
                    content,
                    generatePrivateKeyBytes(),
                    VERSION,
                    priv,
                ),
            ).resolves.toBe(true);
        });
    });
});
