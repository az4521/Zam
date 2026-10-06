// src/lib/utils/keyExportFile.ts
/**
 * The Matrix "key export" file format (spec: Client-Server API, End-to-End
 * Encryption, "Key exports"): the passphrase-encrypted text file Element and
 * other clients write from "Export E2E room keys" and read back on import.
 * SDK-free and WebCrypto-only so it is testable and works everywhere the app
 * does (a secure context is required, as for all of crypto.subtle).
 *
 * Binary layout before base64 armouring:
 *   1 byte   version (0x01)
 *   16 bytes salt S
 *   16 bytes IV
 *   4 bytes  PBKDF2 rounds N, big-endian
 *   n bytes  AES-256-CTR ciphertext of the JSON key list
 *   32 bytes HMAC-SHA-256 of everything above
 * Keys: PBKDF2-HMAC-SHA-512(passphrase, S, N) -> 512 bits; the first 256 are
 * the AES key, the last 256 the HMAC key.
 */

const HEADER = "-----BEGIN MEGOLM SESSION DATA-----";
const FOOTER = "-----END MEGOLM SESSION DATA-----";
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 16;
const ROUNDS_LEN = 4;
const MAC_LEN = 32;
const HEADER_LEN = 1 + SALT_LEN + IV_LEN + ROUNDS_LEN;
const LINE_LEN = 96;

/** Element's default; the spec recommends at least 100000. */
export const DEFAULT_KDF_ROUNDS = 500_000;

export type KeyExportFileErrorReason =
    | "format" // not a key export file, or damaged
    | "version" // a newer format than this code reads
    | "passphrase"; // wrong passphrase (or the file was altered)

export class KeyExportFileError extends Error {
    constructor(readonly reason: KeyExportFileErrorReason) {
        super(`key export file: ${reason}`);
        this.name = "KeyExportFileError";
    }
}

async function deriveKeys(
    passphrase: string,
    salt: Uint8Array<ArrayBuffer>,
    rounds: number,
): Promise<{ aesKey: CryptoKey; hmacKey: CryptoKey }> {
    const subtle = globalThis.crypto.subtle;
    const base = await subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
    );
    const bits = new Uint8Array(
        await subtle.deriveBits(
            { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-512" },
            base,
            512,
        ),
    );
    const [aesKey, hmacKey] = await Promise.all([
        subtle.importKey("raw", bits.slice(0, 32), { name: "AES-CTR" }, false, [
            "encrypt",
            "decrypt",
        ]),
        subtle.importKey(
            "raw",
            bits.slice(32),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"],
        ),
    ]);
    return { aesKey, hmacKey };
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
    let binary: string;
    try {
        binary = atob(text);
    } catch {
        throw new KeyExportFileError("format");
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

/** Encrypt an exported key list (JSON) into a key export file's text. */
export async function encryptKeyExportFile(
    json: string,
    passphrase: string,
    rounds: number = DEFAULT_KDF_ROUNDS,
): Promise<string> {
    const subtle = globalThis.crypto.subtle;
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
    // Clear bit 63 of the counter block, as the spec asks, so the 64-bit
    // counter can never wrap into the IV half on another implementation.
    iv[8] &= 0x7f;
    const { aesKey, hmacKey } = await deriveKeys(passphrase, salt, rounds);
    const ciphertext = new Uint8Array(
        await subtle.encrypt(
            { name: "AES-CTR", counter: iv, length: 64 },
            aesKey,
            new TextEncoder().encode(json),
        ),
    );

    const body = new Uint8Array(HEADER_LEN + ciphertext.length + MAC_LEN);
    body[0] = VERSION;
    body.set(salt, 1);
    body.set(iv, 1 + SALT_LEN);
    new DataView(body.buffer).setUint32(1 + SALT_LEN + IV_LEN, rounds);
    body.set(ciphertext, HEADER_LEN);
    const signed = body.subarray(0, HEADER_LEN + ciphertext.length);
    const mac = new Uint8Array(await subtle.sign("HMAC", hmacKey, signed));
    body.set(mac, HEADER_LEN + ciphertext.length);

    const b64 = toBase64(body);
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += LINE_LEN) {
        lines.push(b64.slice(i, i + LINE_LEN));
    }
    return [HEADER, ...lines, FOOTER, ""].join("\n");
}

/**
 * Decrypt a key export file's text back to the exported key list (JSON).
 * Throws KeyExportFileError: "format", "version" or "passphrase".
 */
export async function decryptKeyExportFile(
    text: string,
    passphrase: string,
): Promise<string> {
    const start = text.indexOf(HEADER);
    const end = text.indexOf(FOOTER);
    if (start < 0 || end < start) throw new KeyExportFileError("format");
    const body = fromBase64(
        text.slice(start + HEADER.length, end).replace(/\s+/g, ""),
    );
    if (body.length < HEADER_LEN + MAC_LEN) {
        throw new KeyExportFileError("format");
    }
    if (body[0] !== VERSION) throw new KeyExportFileError("version");

    const salt = body.slice(1, 1 + SALT_LEN);
    const iv = body.slice(1 + SALT_LEN, 1 + SALT_LEN + IV_LEN);
    const rounds = new DataView(body.buffer).getUint32(1 + SALT_LEN + IV_LEN);
    if (rounds === 0) throw new KeyExportFileError("format");
    const macStart = body.length - MAC_LEN;
    const ciphertext = body.slice(HEADER_LEN, macStart);

    const subtle = globalThis.crypto.subtle;
    const { aesKey, hmacKey } = await deriveKeys(passphrase, salt, rounds);
    const ok = await subtle.verify(
        "HMAC",
        hmacKey,
        body.slice(macStart),
        body.slice(0, macStart),
    );
    if (!ok) throw new KeyExportFileError("passphrase");
    const plain = await subtle.decrypt(
        { name: "AES-CTR", counter: iv, length: 64 },
        aesKey,
        ciphertext,
    );
    return new TextDecoder().decode(plain);
}
