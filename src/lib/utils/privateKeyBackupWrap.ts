// The private account data key, wrapped under the message-history backup
// decryption key. A verified session holds that backup key already (the SDK
// gossips it to every verified session of the account), so it can unwrap the
// private key without the recovery key and without another session online.
// This is not a downgrade: the backup key already decrypts the message history.
//
// Pure: the keys are passed in, and nothing here touches storage or the SDK.
// Account data is untrusted on read, so unwrapPrivateKey reports failure as
// null rather than throwing.

import {
    PRIVATE_KEY_BYTES,
    fromBase64,
    toBase64,
} from "$lib/utils/privateAccountDataCodec";

export const BACKUP_WRAP_VERSION = 1;
/** HKDF info, and the label bound into the AES-GCM additional data. */
const WRAP_INFO = "com.zam.private_account_data_key.backup_wrap.v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const encoder = new TextEncoder();

/** The account data content: the wrapped key and the backup version it belongs to. */
export interface BackupWrapContent {
    v: 1;
    /** The key-backup version the backup decryption key was saved under. */
    backup_version: string;
    /** base64 of the 12-byte GCM nonce. */
    iv: string;
    /** base64 of the 32-byte private key with its 16-byte tag appended. */
    ciphertext: string;
}

/** AES-256-GCM key derived from the backup decryption key by HKDF-SHA256. */
async function wrappingKey(
    backupKeyBytes: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
    const base = await crypto.subtle.importKey(
        "raw",
        backupKeyBytes,
        "HKDF",
        false,
        ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: encoder.encode(WRAP_INFO),
        },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

/** Binds the backup version into the tag, so a copied version does not unwrap. */
function additionalData(backupVersion: string): Uint8Array<ArrayBuffer> {
    return encoder.encode(`${WRAP_INFO}\n${backupVersion}`);
}

/**
 * Wrap the private account data key under the backup decryption key. Throws
 * when the key is not 32 bytes (a caller bug, not bad data).
 */
export async function wrapPrivateKey(
    privateKeyBytes: Uint8Array<ArrayBuffer>,
    backupKeyBytes: Uint8Array<ArrayBuffer>,
    backupVersion: string,
): Promise<BackupWrapContent> {
    if (privateKeyBytes.length !== PRIVATE_KEY_BYTES) {
        throw new Error(
            "privateKeyBackupWrap: the private key must be 32 bytes",
        );
    }
    const key = await wrappingKey(backupKeyBytes);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
            additionalData: additionalData(backupVersion),
            tagLength: TAG_BYTES * 8,
        },
        key,
        privateKeyBytes,
    );
    return {
        v: BACKUP_WRAP_VERSION,
        backup_version: backupVersion,
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(sealed)),
    };
}

/** Whether `raw` is shaped like a wrap of a 32-byte key. */
function parseWrap(raw: unknown): BackupWrapContent | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    if (record.v !== BACKUP_WRAP_VERSION) return null;
    if (typeof record.backup_version !== "string") return null;
    if (
        typeof record.iv !== "string" ||
        typeof record.ciphertext !== "string"
    ) {
        return null;
    }
    const iv = fromBase64(record.iv);
    if (!iv || iv.length !== IV_BYTES) return null;
    const ciphertext = fromBase64(record.ciphertext);
    if (!ciphertext || ciphertext.length !== PRIVATE_KEY_BYTES + TAG_BYTES) {
        return null;
    }
    return {
        v: BACKUP_WRAP_VERSION,
        backup_version: record.backup_version,
        iv: record.iv,
        ciphertext: record.ciphertext,
    };
}

/**
 * The private account data key inside `content`, or null when the content is
 * malformed, was wrapped under another backup version, or does not decrypt
 * with `backupKeyBytes`. Never throws.
 */
export async function unwrapPrivateKey(
    content: unknown,
    backupKeyBytes: Uint8Array<ArrayBuffer>,
    backupVersion: string,
): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
        const parsed = parseWrap(content);
        if (!parsed || parsed.backup_version !== backupVersion) return null;
        const iv = fromBase64(parsed.iv);
        const ciphertext = fromBase64(parsed.ciphertext);
        if (!iv || !ciphertext) return null;
        const key = await wrappingKey(backupKeyBytes);
        const plain = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: additionalData(backupVersion),
                tagLength: TAG_BYTES * 8,
            },
            key,
            ciphertext,
        );
        const bytes = new Uint8Array(plain);
        return bytes.length === PRIVATE_KEY_BYTES ? bytes : null;
    } catch {
        return null;
    }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/**
 * Whether the copy at `existing` (the account data as it stands, null when
 * absent) must be rewritten: it is missing, is under another backup version,
 * or does not unwrap to `privateKeyBytes`.
 */
export async function wrapNeedsUpdate(
    existing: unknown,
    backupKeyBytes: Uint8Array<ArrayBuffer>,
    backupVersion: string,
    privateKeyBytes: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
    const unwrapped = await unwrapPrivateKey(
        existing,
        backupKeyBytes,
        backupVersion,
    );
    return !unwrapped || !sameBytes(unwrapped, privateKeyBytes);
}
