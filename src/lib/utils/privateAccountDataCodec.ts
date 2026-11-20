// Encrypted account data: the wire envelope and the AES-256-GCM codec behind it.
//
// Pure: the key is passed in, and nothing here touches storage or the SDK, so
// the whole format can be tested on its own. The account data TYPE is bound in
// as additional data, so a ciphertext copied under another type will not
// decrypt. Account data is untrusted on read, so every reader here validates
// its input and reports failure rather than throwing.

export const PRIVATE_ENVELOPE_VERSION = 1;
export const PRIVATE_ALG = "A256GCM";
/** AES-256 key length. */
export const PRIVATE_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Upper bound on a ciphertext we are willing to decode (16 MiB). */
const MAX_CIPHERTEXT_BYTES = 16 * 1024 * 1024;

export interface PrivateEnvelope {
    v: 1;
    alg: "A256GCM";
    /** base64 of the 12-byte GCM nonce. */
    iv: string;
    /** base64 of the ciphertext with its 16-byte tag appended. */
    ciphertext: string;
}

export type DecryptResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: "malformed" | "undecryptable" | "not-json" };

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Strict base64 decode, or null for anything that is not canonical base64. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
    if (text.length % 4 !== 0 || !BASE64.test(text)) return null;
    let binary: string;
    try {
        binary = atob(text);
    } catch {
        return null;
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

/** A raw private key from its base64 form, or null unless it is exactly 32 bytes. */
export function decodeKey(text: unknown): Uint8Array<ArrayBuffer> | null {
    if (typeof text !== "string") return null;
    const bytes = fromBase64(text);
    return bytes && bytes.length === PRIVATE_KEY_BYTES ? bytes : null;
}

/** A fresh random private key. */
export function generatePrivateKeyBytes(): Uint8Array<ArrayBuffer> {
    return crypto.getRandomValues(new Uint8Array(PRIVATE_KEY_BYTES));
}

/** The WebCrypto key for raw bytes. Not extractable: callers keep the bytes. */
export function importPrivateKey(
    bytes: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
    ]);
}

/** Whether `raw` is shaped like an envelope we can decrypt. */
export function parseEnvelope(raw: unknown): PrivateEnvelope | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    if (record.v !== PRIVATE_ENVELOPE_VERSION) return null;
    if (record.alg !== PRIVATE_ALG) return null;
    if (
        typeof record.iv !== "string" ||
        typeof record.ciphertext !== "string"
    ) {
        return null;
    }
    const iv = fromBase64(record.iv);
    if (!iv || iv.length !== IV_BYTES) return null;
    if (record.ciphertext.length > MAX_CIPHERTEXT_BYTES * 1.4) return null;
    const ciphertext = fromBase64(record.ciphertext);
    if (!ciphertext || ciphertext.length < TAG_BYTES) return null;
    return {
        v: PRIVATE_ENVELOPE_VERSION,
        alg: PRIVATE_ALG,
        iv: record.iv,
        ciphertext: record.ciphertext,
    };
}

/** Encrypt a JSON-serialisable value for the account data type `type`. */
export async function encryptPrivate(
    key: CryptoKey,
    type: string,
    value: unknown,
): Promise<PrivateEnvelope> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
            additionalData: encoder.encode(type),
            tagLength: TAG_BYTES * 8,
        },
        key,
        encoder.encode(JSON.stringify(value)),
    );
    return {
        v: PRIVATE_ENVELOPE_VERSION,
        alg: PRIVATE_ALG,
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(sealed)),
    };
}

/**
 * Decrypt what `raw` holds for the account data type `type`. Never throws:
 * a malformed envelope, a wrong key, a tampered ciphertext or a wrong type
 * each come back as a reason.
 */
export async function decryptPrivate(
    key: CryptoKey,
    type: string,
    raw: unknown,
): Promise<DecryptResult> {
    const envelope = parseEnvelope(raw);
    if (!envelope) return { ok: false, reason: "malformed" };
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.ciphertext);
    if (!iv || !ciphertext) return { ok: false, reason: "malformed" };
    let plain: ArrayBuffer;
    try {
        plain = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: encoder.encode(type),
                tagLength: TAG_BYTES * 8,
            },
            key,
            ciphertext,
        );
    } catch {
        return { ok: false, reason: "undecryptable" };
    }
    try {
        return { ok: true, value: JSON.parse(decoder.decode(plain)) };
    } catch {
        return { ok: false, reason: "not-json" };
    }
}
