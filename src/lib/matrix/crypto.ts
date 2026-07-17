/**
 * E2EE (rust-crypto) boundary. Kept out of the 3.6k-line `client.ts` because
 * crypto is a whole subsystem with several stacked layers; it shares the single
 * `matrixClient` via the `getClient()` accessor exported from `client.ts`.
 *
 * Layer 0: initialise crypto so incoming `m.room.encrypted` events decrypt and
 * outgoing messages auto-encrypt in already-encrypted rooms.
 * Layer 1 (this file too): SAS (emoji) device & user verification — request
 * wrappers, an incoming-request subscription, and trust-status reads. The raw
 * `VerificationRequest`/`Verifier` SDK objects never leave this module; callers
 * drive a plain `VerificationController`. Cross-signing, key backup, and
 * enable-encryption UI are Layers 2–4.
 */

import { MatrixEventEvent } from "matrix-js-sdk";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import {
    CryptoEvent,
    VerificationPhase,
    VerificationRequestEvent,
    VerifierEvent,
} from "matrix-js-sdk/lib/crypto-api";
import type {
    VerificationRequest,
    Verifier,
    ShowSasCallbacks,
    EmojiMapping,
} from "matrix-js-sdk/lib/crypto-api";
import { VerificationMethod } from "matrix-js-sdk/lib/types";
import { getClient, createDirectMessage } from "$lib/matrix/client";
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

// ─── Layer 1: device & user verification (SAS emoji) ─────────────────────────
//
// The raw `VerificationRequest`/`Verifier` SDK objects never leave this module.
// Components and stores drive a plain `VerificationController` instead — a small
// state machine that owns the request/verifier plumbing and hands out a
// `VerificationView` snapshot plus a `subscribe()` for re-renders.

/** Plain snapshot of a verification's state, for the store/UI. */
export interface VerificationView {
    /** Stable id for keying UI (transaction id once assigned, else synthetic). */
    id: string;
    /** The other party's user id. */
    otherUserId: string;
    /** For to-device (own-device) verifications, the other device id; else null. */
    otherDeviceId: string | null;
    /** True when the other party is one of our own devices. */
    isSelfVerification: boolean;
    /** Raw `VerificationPhase` number (map via utils/verification). */
    phase: number;
    /** The 7 SAS emoji `[symbol, name]` tuples, or null before they're ready. */
    sasEmoji: EmojiMapping[] | null;
}

/** A driven verification flow. All SDK types stay hidden behind it. */
export interface VerificationController {
    readonly id: string;
    /** Current snapshot. Call after each `subscribe` notification. */
    view(): VerificationView;
    /** Register a change listener; returns an unsubscribe. */
    subscribe(cb: () => void): () => void;
    /** Accept an incoming request (sends `.ready`). */
    accept(): Promise<void>;
    /** Confirm the SAS matches. */
    confirm(): Promise<void>;
    /** Report the SAS does NOT match (security event). */
    mismatch(): void;
    /** Cancel / decline at any point. Always safe. */
    cancel(): void;
}

let verificationCounter = 0;

/**
 * Wrap a live `VerificationRequest` in a `VerificationController`. The
 * controller auto-advances the SAS handshake: once the request is `Ready` it
 * starts (or picks up) the SAS verifier, hooks its `ShowSas` callback, and runs
 * `verify()`. Both sides converge on the emoji compare with no extra taps — the
 * user only decides match / no-match / cancel.
 */
function createVerificationController(
    request: VerificationRequest,
): VerificationController {
    const id = request.transactionId ?? `verification-${++verificationCounter}`;
    let sasCallbacks: ShowSasCallbacks | null = null;
    let startRequested = false;
    let verifierHooked = false;
    const subscribers = new Set<() => void>();
    const emit = (): void => {
        for (const cb of subscribers) cb();
    };

    const hookVerifier = (verifier: Verifier): void => {
        if (verifierHooked) return;
        verifierHooked = true;
        verifier.on(VerifierEvent.ShowSas, (callbacks) => {
            sasCallbacks = callbacks;
            emit();
        });
        verifier.on(VerifierEvent.Cancel, () => emit());
        // verify() resolves when both sides confirm and rejects on cancel /
        // mismatch / timeout; either way the terminal state shows via `phase`.
        verifier.verify().catch(() => emit());
    };

    const advance = (): void => {
        // The side that reaches Ready without a verifier sends the `.start`.
        // If the other side already started, `request.verifier` is set and we
        // just hook it — the rust SDK resolves any simultaneous-start race.
        if (
            !startRequested &&
            request.phase === VerificationPhase.Ready &&
            !request.verifier
        ) {
            startRequested = true;
            request.startVerification(VerificationMethod.Sas).then(
                (verifier) => hookVerifier(verifier),
                () => emit(),
            );
        }
        if (request.verifier) hookVerifier(request.verifier);
    };

    request.on(VerificationRequestEvent.Change, () => {
        advance();
        emit();
    });
    // The request may already be past `Requested` when we wrap it.
    advance();

    return {
        id,
        view: () => ({
            id,
            otherUserId: request.otherUserId,
            otherDeviceId: request.otherDeviceId ?? null,
            isSelfVerification: request.isSelfVerification,
            phase: request.phase,
            sasEmoji: sasCallbacks?.sas.emoji ?? null,
        }),
        subscribe: (cb) => {
            subscribers.add(cb);
            return () => subscribers.delete(cb);
        },
        accept: () => request.accept(),
        confirm: async () => {
            await sasCallbacks?.confirm();
        },
        mismatch: () => sasCallbacks?.mismatch(),
        cancel: () => {
            void request.cancel();
        },
    };
}

/**
 * Start verifying one of our OWN other sessions (to-device SAS). The target
 * device shows an incoming request; both sides then compare emoji.
 */
export async function startDeviceVerification(
    deviceId: string,
): Promise<VerificationController> {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = client?.getUserId();
    if (!crypto || !userId) {
        throw new Error("Encryption is not ready on this session");
    }
    const request = await crypto.requestDeviceVerification(userId, deviceId);
    return createVerificationController(request);
}

/**
 * Start verifying ANOTHER user. Verification rides in a DM with them (created
 * if one doesn't exist yet), matching Element's in-room verification model.
 */
export async function startUserVerification(
    userId: string,
): Promise<VerificationController> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) {
        throw new Error("Encryption is not ready on this session");
    }
    const roomId = await createDirectMessage(userId);
    const request = await crypto.requestVerificationDM(userId, roomId);
    return createVerificationController(request);
}

/**
 * Subscribe to incoming verification requests (from another of our devices or
 * from another user). Each is wrapped in a controller and handed to `cb`; the
 * caller decides whether to surface it (we never auto-accept). Returns an
 * unsubscribe. No-op (returns a no-op unsub) when there's no client yet.
 */
export function onIncomingVerificationRequest(
    cb: (controller: VerificationController) => void,
): () => void {
    const client = getClient();
    if (!client) return () => {};
    const handler = (request: VerificationRequest): void => {
        cb(createVerificationController(request));
    };
    client.on(CryptoEvent.VerificationRequestReceived, handler);
    return () => client.off(CryptoEvent.VerificationRequestReceived, handler);
}

/**
 * Any to-device verification requests already in progress for us when the app
 * boots (arrived before the listener attached). Empty when crypto isn't ready.
 */
export function getPendingVerificationControllers(): VerificationController[] {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = client?.getUserId();
    if (!crypto || !userId) return [];
    try {
        return crypto
            .getVerificationRequestsToDeviceInProgress(userId)
            .map(createVerificationController);
    } catch {
        return [];
    }
}

/**
 * Trust badge inputs for a single device (reduced from the SDK's
 * `DeviceVerificationStatus`). Null when unknown or crypto isn't ready.
 */
export async function getDeviceTrust(
    userId: string,
    deviceId: string,
): Promise<{ isVerified: boolean; signedByOwner: boolean } | null> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return null;
    try {
        const status = await crypto.getDeviceVerificationStatus(
            userId,
            deviceId,
        );
        if (!status) return null;
        return {
            isVerified: status.isVerified(),
            signedByOwner: status.signedByOwner,
        };
    } catch {
        return null;
    }
}

/**
 * Trust badge inputs for a user (reduced from the SDK's
 * `UserVerificationStatus`). Null when crypto isn't ready.
 */
export async function getUserTrust(userId: string): Promise<{
    isVerified: boolean;
    needsApproval: boolean;
    known: boolean;
} | null> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return null;
    try {
        const status = await crypto.getUserVerificationStatus(userId);
        return {
            isVerified: status.isVerified(),
            needsApproval: status.needsUserApproval,
            known: status.known,
        };
    } catch {
        return null;
    }
}
