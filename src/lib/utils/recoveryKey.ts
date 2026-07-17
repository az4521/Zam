/**
 * Pure helpers for the recovery key (4S secret-storage key) UI: formatting the
 * encoded key for display and a cheap, non-throwing shape check on a pasted key.
 * SDK-free (plain string ops + the base58 alphabet) so it unit-tests without the
 * rust-crypto WASM. The authoritative decode/parity/prefix check is the SDK's
 * `decodeRecoveryKey`, driven from `crypto.ts` (used in Layer 3's unlock flow).
 */

// Matrix recovery keys are base58-encoded per the spec's cryptographic key
// representation (Bitcoin alphabet: no 0, O, I, or l).
const BASE58_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// A valid key encodes 35 bytes (2-byte prefix + 32-byte key + 1 parity byte),
// which base58s to ~48–49 chars. Keep a generous window so we never reject a
// real key; this is only a "looks plausible" gate, not a validation.
const MIN_KEY_LEN = 40;
const MAX_KEY_LEN = 60;

/** Strip all whitespace → the canonical, decodable form. */
export function normalizeRecoveryKey(input: string): string {
    return input.replace(/\s+/g, "");
}

/**
 * Regroup an encoded recovery key into space-separated blocks (default 4) for
 * display. Idempotent regardless of the input's existing spacing — the SDK's
 * `encodeRecoveryKey` already groups in fours, but a user-pasted key may not.
 */
export function formatRecoveryKey(input: string, blockSize = 4): string {
    const compact = normalizeRecoveryKey(input);
    if (compact === "") return "";
    const size = blockSize > 0 ? blockSize : compact.length;
    return compact.match(new RegExp(`.{1,${size}}`, "g"))?.join(" ") ?? compact;
}

/**
 * Cheap non-throwing shape check for a pasted recovery key: after stripping
 * whitespace it must be entirely base58 characters and a plausible length. This
 * does NOT verify the parity byte or prefix — that's the SDK's
 * `decodeRecoveryKey` (Layer 3). Use it to enable a "Continue" button before
 * paying for a real decode attempt.
 */
export function isLikelyRecoveryKey(input: string): boolean {
    const compact = normalizeRecoveryKey(input);
    if (compact.length < MIN_KEY_LEN || compact.length > MAX_KEY_LEN) {
        return false;
    }
    for (const ch of compact) {
        if (!BASE58_ALPHABET.includes(ch)) return false;
    }
    return true;
}
