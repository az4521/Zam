/**
 * E2EE (rust-crypto) boundary — Layer 0: bootstrap, decrypt reactivity, and a
 * couple of read helpers. Kept out of the 3.6k-line `client.ts` because crypto
 * is a whole subsystem with four more layers to come; it shares the single
 * `matrixClient` via the `getClient()` accessor exported from `client.ts`.
 *
 * Layer 0 scope only: initialise crypto so incoming `m.room.encrypted` events
 * decrypt and outgoing messages auto-encrypt in already-encrypted rooms. No
 * verification, cross-signing, key backup, or enable-encryption UI (those are
 * Layers 1–4). Incoming verification requests are ignored (not surfaced), by
 * design, until Layer 1.
 */

import { MatrixEventEvent } from "matrix-js-sdk";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { getClient } from "$lib/matrix/client";
import { getCryptoDbName } from "$lib/utils/cryptoStore";
import { bumpTimelineTick } from "$lib/stores/messages.svelte";

// Graceful-degradation flag. Stays false if rust-crypto fails to initialise
// (e.g. WASM can't load): the app keeps working for unencrypted rooms and
// encrypted rooms render UTD placeholders instead of crashing.
let cryptoAvailable = false;

// Remembers the last client we attached the decryption listener to so a
// re-init (account switch) doesn't stack duplicate listeners.
let decryptionListenerClient: MatrixClient | null = null;
let decryptionHandler: ((event: MatrixEvent) => void) | null = null;

/** Whether rust-crypto initialised successfully for the current session. */
export function isCryptoAvailable(): boolean {
    return cryptoAvailable;
}

/**
 * Initialise rust-crypto for a freshly-authenticated client. Call at the end of
 * `createAuthenticatedClient`, before `startClient`, so the crypto layer is
 * ready before sync processes to-device / encrypted events.
 *
 * The crypto IndexedDB is keyed per account via `cryptoDatabasePrefix` — the
 * SDK warns that sharing one crypto store across accounts corrupts data and
 * breaks decryption. At-rest encryption of the store is deferred (Layer 0 uses
 * a plaintext store, same as Element Web's default).
 *
 * Never throws: on failure it logs, leaves `cryptoAvailable` false, and returns
 * so sync can proceed unencrypted.
 */
export async function initCrypto(
    client: MatrixClient,
    userId: string,
    deviceId: string,
): Promise<void> {
    cryptoAvailable = false;
    try {
        await client.initRustCrypto({
            cryptoDatabasePrefix: getCryptoDbName(userId, deviceId),
        });
        cryptoAvailable = true;
        attachDecryptionListener(client);
    } catch (err) {
        console.warn(
            "[matrix] rust-crypto init failed; encrypted rooms will show " +
                "placeholders and this session can't send to encrypted rooms",
            err,
        );
    }
}

/**
 * Bump the timeline tick when an event decrypts after it was first rendered
 * (keys arrived mid-session). The derived timeline re-runs and the UTD
 * placeholder row swaps to real content. The MatrixClient re-emits
 * `MatrixEventEvent.Decrypted` for events it manages.
 */
function attachDecryptionListener(client: MatrixClient): void {
    if (decryptionListenerClient === client) return;
    detachDecryptionListener();
    const handler = (_event: MatrixEvent): void => {
        bumpTimelineTick();
    };
    client.on(MatrixEventEvent.Decrypted as never, handler as never);
    decryptionListenerClient = client;
    decryptionHandler = handler;
}

function detachDecryptionListener(): void {
    if (decryptionListenerClient && decryptionHandler) {
        decryptionListenerClient.off(
            MatrixEventEvent.Decrypted as never,
            decryptionHandler as never,
        );
    }
    decryptionListenerClient = null;
    decryptionHandler = null;
}

/**
 * Synchronous read of whether a room has encryption switched on, from its
 * `m.room.encryption` state event. Depends on `roomsState.roomsTick` at the
 * call site to re-run (the Room object mutates in place).
 */
export function isRoomEncrypted(room: Room | null | undefined): boolean {
    if (!room) return false;
    try {
        return room.hasEncryptionStateEvent();
    } catch {
        return false;
    }
}

/**
 * Best-effort wipe of a NON-active account's rust-crypto IndexedDB when it is
 * removed from this device (the account has no live client, so `clearStores`
 * isn't available). Deletes the same two databases the SDK's `clearStores`
 * targets, keyed by the per-account prefix — so it can only ever touch that
 * account's stores, never the active session's. Failures are ignored (private
 * browsing rejects deleteDatabase; a missing DB is a no-op).
 *
 * The active account's own sign-out already wipes its crypto store via
 * `client.clearStores({ cryptoDatabasePrefix })` in `logout()`.
 */
export async function deleteCryptoStore(
    userId: string,
    deviceId: string,
): Promise<void> {
    let indexedDB: IDBFactory | undefined;
    try {
        indexedDB = globalThis.indexedDB;
    } catch {
        return;
    }
    if (!indexedDB) return;
    const prefix = getCryptoDbName(userId, deviceId);
    const names = [
        `${prefix}::matrix-sdk-crypto`,
        `${prefix}::matrix-sdk-crypto-meta`,
    ];
    await Promise.all(
        names.map(
            (name) =>
                new Promise<void>((resolve) => {
                    try {
                        const req = indexedDB.deleteDatabase(name);
                        req.onsuccess = () => resolve();
                        req.onerror = () => resolve();
                        req.onblocked = () => resolve();
                    } catch {
                        resolve();
                    }
                }),
        ),
    );
}

/**
 * This device's public identity keys, for the read-only Settings status line.
 * Null when crypto isn't available yet.
 */
export async function getOwnDeviceKeyInfo(): Promise<{
    ed25519: string;
    curve25519: string;
} | null> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return null;
    try {
        return await crypto.getOwnDeviceKeys();
    } catch {
        return null;
    }
}
