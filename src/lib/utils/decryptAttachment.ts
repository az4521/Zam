/**
 * Decrypt a Matrix end-to-end-encrypted attachment (`m.room.message`'s
 * `content.file`, an EncryptedFile). The scheme is AES-CTR-256 with a JWK key,
 * a 16-byte IV used as the initial counter block, and a SHA-256 taken over the
 * CIPHERTEXT that MUST be verified before the plaintext is trusted.
 *
 * SDK-free (browser Web Crypto only) so it unit-tests without rust-crypto. The
 * key is imported from its raw bytes rather than the JWK object on purpose:
 * "A256CTR" is not a JWA-registered JWK `alg`, so a `jwk` import is rejected by
 * some engines — the raw 32-byte key sidesteps that entirely.
 */

/** The `content.file.key` JWK, narrowed to the fields we need. */
export interface EncryptedFileKey {
    /** base64url key material (32 bytes for A256CTR). */
    k: string;
    /** "oct". */
    kty?: string;
    /** "A256CTR". */
    alg?: string;
    key_ops?: string[];
    ext?: boolean;
}

/** Minimal shape of a Matrix `EncryptedFile` needed to decrypt it. */
export interface EncryptedFileInfo {
    key: EncryptedFileKey;
    /** base64 (16-byte) initial counter block. */
    iv: string;
    /** Integrity hashes over the ciphertext; `sha256` is required. */
    hashes: { sha256: string; [alg: string]: string };
    v?: string;
}

/** Decode standard OR url-safe base64, padded or not, to bytes. */
export function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
    let s = input.replace(/-/g, "+").replace(/_/g, "/");
    // atob wants padding to a multiple of 4.
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad === 1) throw new Error("Invalid base64 length");
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Constant-length byte compare (not early-exit) for the integrity hash. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

/**
 * Verify the ciphertext hash, then AES-CTR-decrypt it. Throws (without ever
 * returning plaintext) if the SHA-256 does not match — a tampered or corrupt
 * attachment must never be shown as if it were genuine.
 *
 * @param ciphertext the raw encrypted bytes downloaded from `file.url`
 * @param info the `content.file` EncryptedFile metadata
 * @param subtle injectable for tests; defaults to the platform Web Crypto
 */
export async function decryptAttachment(
    ciphertext: ArrayBuffer,
    info: EncryptedFileInfo,
    subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<ArrayBuffer> {
    if (!info?.key?.k) throw new Error("Encrypted file is missing its key");
    if (!info.iv) throw new Error("Encrypted file is missing its IV");
    if (!info.hashes?.sha256) {
        throw new Error("Encrypted file is missing its integrity hash");
    }

    // 1. Integrity: SHA-256 over the CIPHERTEXT must match before we decrypt.
    const digest = await subtle.digest("SHA-256", ciphertext);
    if (
        !bytesEqual(new Uint8Array(digest), base64ToBytes(info.hashes.sha256))
    ) {
        throw new Error("Attachment integrity check failed (hash mismatch)");
    }

    // 2. Import the 256-bit key from its raw bytes (see file header note).
    const keyBytes = base64ToBytes(info.key.k);
    if (keyBytes.length !== 32) {
        throw new Error("Encrypted file key is not 256 bits");
    }
    const key = await subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-CTR" },
        false,
        ["decrypt"],
    );

    // 3. AES-CTR with the 16-byte IV as the counter block. Matrix advances only
    //    the low 64 bits, so `length` is 64.
    const counter = base64ToBytes(info.iv);
    if (counter.length !== 16) {
        throw new Error("Encrypted file IV is not 16 bytes");
    }
    return subtle.decrypt(
        { name: "AES-CTR", counter, length: 64 },
        key,
        ciphertext,
    );
}
