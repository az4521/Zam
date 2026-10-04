/**
 * Pure helper for naming the rust-crypto IndexedDB store. Kept out of the SDK
 * boundary so it can be unit-tested and shared between crypto init and the
 * teardown/wipe paths.
 *
 * The matrix-js-sdk warns that sharing one crypto IndexedDB across clients
 * causes "data corruption and decryption failures", so the store MUST be keyed
 * per account. This mirrors the sync-store name (`…:sync`) with a `:crypto`
 * suffix, using the same encoding so the two never collide.
 */
export function getCryptoDbName(userId: string, deviceId: string): string {
    return `matrix-client:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:crypto`;
}

/**
 * The Web Lock guarding that store. A page running crypto on it holds it
 * shared; the push-notification decryptor (pushDecryptHeadless.ts) takes it
 * exclusively, so the two never open the store at the same time.
 */
export function getCryptoLockName(userId: string, deviceId: string): string {
    return `${getCryptoDbName(userId, deviceId)}:lock`;
}
