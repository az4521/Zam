/**
 * Encrypt a Matrix attachment following the Matrix spec v2 EncryptedFile scheme.
 * AES-CTR-256 with a random 32-byte key, 16-byte IV (low 8 bytes zero), and a
 * SHA-256 hash computed over the CIPHERTEXT for integrity verification.
 *
 * The returned `info` omits the `url` field — the caller adds it after upload.
 * Reuses types from `decryptAttachment.ts` for round-trip compatibility.
 */

import type { EncryptedFileInfo } from "./decryptAttachment";

/** Encode bytes to standard base64, then strip padding. */
function bytesToBase64(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=+$/, "");
}

/** Encode bytes to url-safe base64, then strip padding. */
function bytesToBase64url(bytes: Uint8Array): string {
    return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Encrypt an attachment for a Matrix encrypted room. Returns the ciphertext
 * and the EncryptedFile metadata (without `url` — caller adds it post-upload).
 *
 * @param plaintext the raw file bytes to encrypt
 * @param subtle injectable for tests; defaults to the platform Web Crypto
 * @param getRandomValues injectable for tests; defaults to crypto.getRandomValues
 */
export async function encryptAttachment(
    plaintext: ArrayBuffer,
    subtle: SubtleCrypto = globalThis.crypto.subtle,
    getRandomValues: (
        array: Uint8Array,
    ) => Uint8Array = globalThis.crypto.getRandomValues.bind(globalThis.crypto),
): Promise<{ data: ArrayBuffer; info: EncryptedFileInfo }> {
    // 1. Generate a random 256-bit key.
    const keyBytes = new Uint8Array(32);
    getRandomValues(keyBytes);

    // 2. Generate a 16-byte IV with the low 8 bytes (indices 8..15) zero.
    //    The high 8 bytes are random; Matrix spec uses the low 64 bits as counter.
    const iv = new Uint8Array(16);
    const nonce = new Uint8Array(8);
    getRandomValues(nonce);
    iv.set(nonce, 0);
    // indices 8..15 remain zero (Uint8Array is zero-filled by default)

    // 3. Import the key for AES-CTR encryption, then export it as raw to build JWK.
    const key = await subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-CTR" },
        true,
        ["encrypt"],
    );

    // 4. Encrypt the plaintext with AES-CTR (counter length 64).
    const ciphertext = await subtle.encrypt(
        { name: "AES-CTR", counter: iv, length: 64 },
        key,
        plaintext,
    );

    // 5. Compute SHA-256 over the CIPHERTEXT for integrity verification.
    const digest = await subtle.digest("SHA-256", ciphertext);

    // 6. Build the EncryptedFile metadata (v2 format, JWK key).
    const info: EncryptedFileInfo = {
        v: "v2",
        key: {
            kty: "oct",
            alg: "A256CTR",
            ext: true,
            key_ops: ["encrypt", "decrypt"],
            k: bytesToBase64url(keyBytes),
        },
        iv: bytesToBase64(iv),
        hashes: {
            sha256: bytesToBase64(new Uint8Array(digest)),
        },
    };

    return { data: ciphertext, info };
}

/**
 * Decide whether to encrypt an attachment upload for the given room and msgtype.
 * Returns false for m.video (encrypted video playback is queued as item 2b),
 * otherwise returns whether the room is encrypted.
 */
export function shouldEncryptUpload(
    roomEncrypted: boolean,
    msgtype: string,
): boolean {
    // Skip m.video until encrypted video playback lands (queue item 2b).
    if (msgtype === "m.video") return false;
    return roomEncrypted;
}

/** Where an attachment upload landed: a plaintext `url` or an EncryptedFile. */
export type UploadedAttachment =
    | { url: string }
    | { file: EncryptedFileInfo & { url: string } };

/**
 * Map an uploaded thumbnail to its `info` fields: `thumbnail_url` for a
 * plaintext upload, `thumbnail_file` for an encrypted one. Never both.
 */
export function thumbnailFields(
    upload: UploadedAttachment,
):
    | { thumbnail_url: string }
    | { thumbnail_file: EncryptedFileInfo & { url: string } } {
    return "file" in upload
        ? { thumbnail_file: upload.file }
        : { thumbnail_url: upload.url };
}
