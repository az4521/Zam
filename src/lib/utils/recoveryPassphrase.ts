/**
 * Pure helpers for passphrase-based 4S recovery. SDK-free (structural mirrors
 * of matrix-js-sdk's `PassphraseInfo`) so they unit-test without rust-crypto's
 * WASM; the actual PBKDF2 derivation is the SDK's
 * `deriveRecoveryKeyFromPassphrase`, driven from crypto.ts.
 *
 * Why the runtime guards: the SDK types `passphrase` as REQUIRED on
 * `SecretStorageKeyDescriptionCommon` (secret-storage.d.ts:25), but a 4S key
 * created without a passphrase simply has no `passphrase` object in
 * account_data. Trusting the type here would crash on every random-key account.
 */

/** Validated PBKDF2 parameters, ready to hand to the SDK's derivation helper. */
export interface PassphraseParams {
    salt: string;
    iterations: number;
    bits: number;
}

/** SDK-free mirror of the parts of `SecretStorageKeyDescription` we read. */
interface KeyInfoLike {
    passphrase?: {
        algorithm?: string;
        salt?: string;
        iterations?: number;
        bits?: number;
    };
}

/** The spec's only defined derivation algorithm for 4S passphrases. */
const PBKDF2 = "m.pbkdf2";

/** The spec's default when `bits` is omitted from the key description. */
const DEFAULT_BITS = 256;

/**
 * Extract usable PBKDF2 parameters from a 4S key description, or null when the
 * key can't be unlocked by passphrase (no passphrase info, unknown algorithm,
 * or nonsense parameters). Null is the "offer recovery-key entry only" signal.
 */
export function passphraseParams(
    keyInfo: KeyInfoLike | null | undefined,
): PassphraseParams | null {
    const info = keyInfo?.passphrase;
    if (!info || info.algorithm !== PBKDF2) return null;
    const { salt, iterations } = info;
    if (typeof salt !== "string" || salt.length === 0) return null;
    if (typeof iterations !== "number" || iterations <= 0) return null;
    const bits = info.bits ?? DEFAULT_BITS;
    if (typeof bits !== "number" || bits <= 0) return null;
    return { salt, iterations, bits };
}

/** Shortest passphrase we'll let a user commit to as their only recovery path. */
export const MIN_PASSPHRASE_LENGTH = 8;

/**
 * Validate a user-typed passphrase, returning an actionable message or null
 * when it's acceptable. Deliberately NOT a strength meter — the recovery key
 * remains the primary path and is always shown.
 *
 * Length is measured on the TRIMMED value so that padding whitespace can't buy
 * its way past the minimum, but the passphrase itself is never trimmed: the
 * derivation uses the verbatim string the user typed, spaces and all.
 */
export function passphraseIssue(passphrase: string): string | null {
    if (passphrase.trim().length === 0) return "Enter a passphrase.";
    if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
        return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
    }
    return null;
}
