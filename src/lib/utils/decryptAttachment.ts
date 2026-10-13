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

const AES_BLOCK = 16;
const LOW_64 = (1n << 64n) - 1n;

/** The counter block for the `blockIndex`th AES block: the IV with its low 64
 *  bits advanced, wrapping (Matrix, like `length: 64` above, never carries
 *  into the high half). */
function counterAt(
    iv: Uint8Array,
    blockIndex: bigint,
): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(iv);
    const view = new DataView(out.buffer);
    view.setBigUint64(8, (view.getBigUint64(8) + blockIndex) & LOW_64);
    return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

/**
 * Incremental counterpart of {@link decryptAttachment}, for playing media while
 * it is still downloading. AES-CTR is a stream cipher, so each chunk can be
 * decrypted as it arrives; the SHA-256 integrity check cannot, because it
 * covers the whole ciphertext, so it runs in `finish()`.
 *
 * ⚠ That means plaintext handed out by `push()` is UNVERIFIED until `finish()`
 * resolves. Callers must treat a rejection from `finish()` as "everything you
 * played was tampered with" and tear it down, and must not persist or hand the
 * bytes anywhere (a blob URL, a download) before it resolves.
 */
export interface StreamDecryptor {
    /** Decrypt the next ciphertext chunk. May return fewer bytes than given
     *  (a partial AES block is held back until the next chunk). */
    push(chunk: Uint8Array): Promise<Uint8Array>;
    /** Decrypt the held-back tail and verify the SHA-256 over everything
     *  pushed. Rejects, returning no plaintext, on a mismatch. */
    finish(): Promise<Uint8Array>;
}

export async function createStreamDecryptor(
    info: EncryptedFileInfo,
    subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<StreamDecryptor> {
    if (!info?.key?.k) throw new Error("Encrypted file is missing its key");
    if (!info.iv) throw new Error("Encrypted file is missing its IV");
    if (!info.hashes?.sha256) {
        throw new Error("Encrypted file is missing its integrity hash");
    }
    const keyBytes = base64ToBytes(info.key.k);
    if (keyBytes.length !== 32) {
        throw new Error("Encrypted file key is not 256 bits");
    }
    const iv = base64ToBytes(info.iv);
    if (iv.length !== AES_BLOCK) {
        throw new Error("Encrypted file IV is not 16 bytes");
    }
    const expected = base64ToBytes(info.hashes.sha256);
    const key = await subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-CTR" },
        false,
        ["decrypt"],
    );

    // Retained for the final digest: WebCrypto has no incremental SHA-256.
    const seen: Uint8Array[] = [];
    let carry: Uint8Array<ArrayBuffer> = new Uint8Array(0);
    let blocks = 0n;
    let finished = false;

    const decrypt = async (data: Uint8Array<ArrayBuffer>) =>
        new Uint8Array(
            await subtle.decrypt(
                {
                    name: "AES-CTR",
                    counter: counterAt(iv, blocks),
                    length: 64,
                },
                key,
                data,
            ),
        );

    return {
        async push(chunk) {
            if (finished) throw new Error("Stream decryptor already finished");
            seen.push(chunk);
            const data = concat(carry, chunk);
            const usable = data.length - (data.length % AES_BLOCK);
            carry = data.slice(usable);
            if (usable === 0) return new Uint8Array(0);
            const out = await decrypt(data.subarray(0, usable));
            blocks += BigInt(usable / AES_BLOCK);
            return out;
        },
        async finish() {
            if (finished) throw new Error("Stream decryptor already finished");
            finished = true;
            const total = seen.reduce((n, c) => n + c.length, 0);
            const all = new Uint8Array(total);
            let at = 0;
            for (const c of seen) {
                all.set(c, at);
                at += c.length;
            }
            seen.length = 0;
            const digest = await subtle.digest("SHA-256", all);
            if (!bytesEqual(new Uint8Array(digest), expected)) {
                throw new Error(
                    "Attachment integrity check failed (hash mismatch)",
                );
            }
            return carry.length ? decrypt(carry) : new Uint8Array(0);
        },
    };
}
