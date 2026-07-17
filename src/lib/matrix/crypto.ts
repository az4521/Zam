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
import type {
    AuthDict,
    MatrixClient,
    MatrixError,
    MatrixEvent,
    Room,
    UIAuthCallback,
} from "matrix-js-sdk";
import {
    CryptoEvent,
    VerificationPhase,
    VerificationRequestEvent,
    VerifierEvent,
    ImportRoomKeyStage,
    decodeRecoveryKey,
    DecryptionKeyDoesNotMatchError,
} from "matrix-js-sdk/lib/crypto-api";
import type {
    VerificationRequest,
    Verifier,
    ShowSasCallbacks,
    EmojiMapping,
    CryptoCallbacks,
    ImportRoomKeyProgressData,
} from "matrix-js-sdk/lib/crypto-api";
import { VerificationMethod } from "matrix-js-sdk/lib/types";
import { getClient, createDirectMessage } from "$lib/matrix/client";
import { getCryptoDbName } from "$lib/utils/cryptoStore";
import { normalizeRecoveryKey } from "$lib/utils/recoveryKey";
import type { RestoreProgress } from "$lib/utils/keyBackup";
import { supportsPasswordUia } from "$lib/utils/deviceSessions";
import { bumpTimelineTick } from "$lib/stores/messages.svelte";
import { bumpSecurityTick } from "$lib/stores/security.svelte";

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
        attachSecurityListeners(client);
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

// Crypto events that change the Security & Encryption view-model (Layers 2-3):
// cross-signing keys appearing/changing, and key-backup state flipping (backup
// enabled/disabled, the backup key getting cached on unlock, a backup failure).
// Any of them bumps `securityTick` so the settings section re-reads
// `getSecurityStatus()` / `getBackupStatus()`.
const SECURITY_EVENTS = [
    CryptoEvent.KeysChanged,
    CryptoEvent.KeyBackupStatus,
    CryptoEvent.KeyBackupDecryptionKeyCached,
    CryptoEvent.KeyBackupFailed,
] as const;

let securityListenerClient: MatrixClient | null = null;
let securityHandler: (() => void) | null = null;

function attachSecurityListeners(client: MatrixClient): void {
    if (securityListenerClient === client) return;
    detachSecurityListeners();
    const handler = (): void => bumpSecurityTick();
    for (const event of SECURITY_EVENTS) {
        client.on(event as never, handler as never);
    }
    securityListenerClient = client;
    securityHandler = handler;
}

function detachSecurityListeners(): void {
    if (securityListenerClient && securityHandler) {
        for (const event of SECURITY_EVENTS) {
            securityListenerClient.off(
                event as never,
                securityHandler as never,
            );
        }
    }
    securityListenerClient = null;
    securityHandler = null;
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
    /** True if we started this request (vs received it from the other side). */
    initiatedByMe: boolean;
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
            initiatedByMe: request.initiatedByMe,
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

// ─── Layer 2: cross-signing + secret storage (4S) ────────────────────────────
//
// Establishes the user's cross-signing identity and a secret-storage (4S/SSSS)
// store protected by a recovery key, and mints the key backup in the same pass.
// The recovery key is shown to the user exactly once and never persisted by us.

// In-memory 4S key cache backing the `cryptoCallbacks` the SDK invokes when it
// needs to read/write secret storage (during setup, and when a new secret
// arrives). Keyed by secret-storage key id → raw private key. Never persisted;
// dropped when the tab/module tears down. Layer 3's unlock flow will populate
// this from a user-entered recovery key.
const secretStorageKeys = new Map<string, Uint8Array<ArrayBuffer>>();

/**
 * The application `cryptoCallbacks` passed to `createClient` (the Layer 0 seam).
 * The SDK calls these whenever it needs the secret-storage key — e.g. inside
 * `bootstrapSecretStorage`, or when it receives a secret from another session.
 * Backing them with a short-lived in-memory cache avoids prompting the user
 * repeatedly for the same key. We never persist the key or log it.
 */
export function getCryptoCallbacks(): CryptoCallbacks {
    return {
        getSecretStorageKey: async ({ keys }) => {
            for (const keyId of Object.keys(keys)) {
                const cached = secretStorageKeys.get(keyId);
                if (cached) return [keyId, cached];
            }
            return null;
        },
        cacheSecretStorageKey: (keyId, _keyInfo, key) => {
            secretStorageKeys.set(keyId, key);
        },
    };
}

/**
 * Build the `authUploadDeviceSigningKeys` callback that `bootstrapCrossSigning`
 * runs to upload the new signing keys. Servers guard that upload behind
 * User-Interactive Auth: probe once with no auth, expect the 401 challenge, then
 * complete the single `m.login.password` stage. Mirrors `deleteOwnDevice` /
 * `completeWithPasswordUia` in client.ts. Throws "Incorrect password" on a
 * rejected retry; a non-password-only flow (SSO, multi-stage) is surfaced as an
 * actionable error.
 */
function makeUiaPasswordCallback(
    userId: string,
    password: string,
): UIAuthCallback<void> {
    return async (makeRequest) => {
        try {
            // Probe with no auth to trigger the server's UIA challenge.
            return await makeRequest(null);
        } catch (e) {
            const uia = e as MatrixError;
            const data = (uia.data ?? {}) as {
                session?: string;
                flows?: { stages: string[] }[];
            };
            if (uia.httpStatus !== 401 || !data.flows) throw e;
            if (!supportsPasswordUia(data.flows)) {
                throw new Error(
                    "This server can't confirm encryption setup with a password — use its account page instead.",
                );
            }
            const auth: AuthDict = {
                type: "m.login.password",
                identifier: { type: "m.id.user", user: userId },
                password,
                session: data.session,
            };
            try {
                return await makeRequest(auth);
            } catch (retryError) {
                if ((retryError as MatrixError).httpStatus === 401) {
                    throw new Error("Incorrect password");
                }
                throw retryError;
            }
        }
    };
}

/** Result of a successful `setupRecovery` run. */
export interface RecoverySetupResult {
    /** The encoded recovery key (`EsT…`), to display to the user exactly once. */
    recoveryKey: string;
}

/**
 * Set up recovery for this account: establish cross-signing, mint a random
 * recovery key, create secret storage (4S) with that key as the default, and
 * create a new key backup — all in one pass. Requires the account password for
 * the UIA-guarded signing-key upload.
 *
 * Returns the encoded recovery key so the UI can show it once (we never persist
 * it). Throws with an actionable message on UIA failure or if crypto isn't ready.
 */
export async function setupRecovery(
    password: string,
): Promise<RecoverySetupResult> {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = client?.getUserId();
    if (!crypto || !userId) {
        throw new Error("Encryption is not ready on this session");
    }

    // 1. Establish (or confirm) the cross-signing identity. Uploading the new
    //    signing keys is UIA-guarded → drive the password dance.
    await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: makeUiaPasswordCallback(userId, password),
    });

    // 2. Mint a fresh random recovery key — no passphrase (v1 decision: a
    //    passphrase adds a weaker PBKDF2-derived path and more UI).
    const generated = await crypto.createRecoveryKeyFromPassphrase();
    const encoded = generated.encodedPrivateKey;
    if (!encoded) {
        throw new Error("Failed to generate a recovery key");
    }

    // 3. Create secret storage with that key as the default and mint a new key
    //    backup in the same pass. bootstrapSecretStorage calls back into our
    //    cacheSecretStorageKey (via cryptoCallbacks) so the follow-up secret
    //    writes resolve without prompting.
    await crypto.bootstrapSecretStorage({
        createSecretStorageKey: async () => generated,
        setupNewKeyBackup: true,
    });

    bumpSecurityTick();
    return { recoveryKey: encoded };
}

/** Plain view-model of the account's crypto/security posture, for the UI. */
export interface SecurityStatus {
    /** rust-crypto initialised on this session. */
    available: boolean;
    /** Cross-signing identity is set up and usable. */
    crossSigningReady: boolean;
    /** Cross-signing private keys are stored (encrypted) in secret storage. */
    privateKeysInSecretStorage: boolean;
    /** Secret storage (4S) is fully set up — i.e. "recovery is set up". */
    secretStorageReady: boolean;
    /** The default secret-storage key id, if any. */
    defaultKeyId: string | null;
    /** This device is verified via cross-signing. */
    thisDeviceVerified: boolean;
}

const EMPTY_SECURITY_STATUS: SecurityStatus = {
    available: false,
    crossSigningReady: false,
    privateKeysInSecretStorage: false,
    secretStorageReady: false,
    defaultKeyId: null,
    thisDeviceVerified: false,
};

/**
 * Read the account's cross-signing + secret-storage posture as a plain
 * view-model. Re-read whenever `securityState.securityTick` bumps. Never throws:
 * degrades to the empty status when crypto isn't ready or a read fails.
 */
export async function getSecurityStatus(): Promise<SecurityStatus> {
    const client = getClient();
    const crypto = client?.getCrypto();
    if (!crypto) return { ...EMPTY_SECURITY_STATUS };
    try {
        const [crossSigningReady, crossStatus, secretStorageReady, ssStatus] =
            await Promise.all([
                crypto.isCrossSigningReady(),
                crypto.getCrossSigningStatus(),
                crypto.isSecretStorageReady(),
                crypto.getSecretStorageStatus(),
            ]);
        let thisDeviceVerified = false;
        const userId = client?.getUserId();
        const deviceId = client?.getDeviceId();
        if (userId && deviceId) {
            const dev = await crypto.getDeviceVerificationStatus(
                userId,
                deviceId,
            );
            thisDeviceVerified = dev?.crossSigningVerified ?? false;
        }
        return {
            available: true,
            crossSigningReady,
            privateKeysInSecretStorage: crossStatus.privateKeysInSecretStorage,
            secretStorageReady,
            defaultKeyId: ssStatus.defaultKeyId,
            thisDeviceVerified,
        };
    } catch {
        return { ...EMPTY_SECURITY_STATUS, available: true };
    }
}

// ─── Layer 3: key-backup restore & recovery on another session ───────────────
//
// The "recover" side of E2EE. On a session that lacks the keys, the user pastes
// their recovery key to unlock secret storage, which cross-signs (trusts) this
// session AND loads the message-history backup key so encrypted history restores.

/** Plain view-model of the account's key-backup posture, for the UI. */
export interface BackupStatus {
    /** rust-crypto initialised on this session. */
    available: boolean;
    /** The server holds a key backup for this account. */
    exists: boolean;
    /** This session is actively backing up to it (its backup key is loaded). */
    active: boolean;
    /** The backup carries a valid signature from a trusted device. */
    trusted: boolean;
    /** The loaded backup decryption key matches the server backup. */
    matchesDecryptionKey: boolean;
    /** The active/known backup version, if any. */
    version: string | null;
}

const EMPTY_BACKUP_STATUS: BackupStatus = {
    available: false,
    exists: false,
    active: false,
    trusted: false,
    matchesDecryptionKey: false,
    version: null,
};

/**
 * Read the account's key-backup posture as a plain view-model. Re-read whenever
 * `securityState.securityTick` bumps (KeyBackup* CryptoEvents drive it). Never
 * throws: degrades to the empty status when crypto isn't ready or a read fails.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return { ...EMPTY_BACKUP_STATUS };
    try {
        const [info, activeVersion] = await Promise.all([
            crypto.getKeyBackupInfo(),
            crypto.getActiveSessionBackupVersion(),
        ]);
        let trusted = false;
        let matchesDecryptionKey = false;
        if (info) {
            const trust = await crypto.isKeyBackupTrusted(info);
            trusted = trust.trusted;
            matchesDecryptionKey = trust.matchesDecryptionKey;
        }
        return {
            available: true,
            exists: info != null,
            active: activeVersion != null,
            trusted,
            matchesDecryptionKey,
            version: info?.version ?? activeVersion ?? null,
        };
    } catch {
        return { ...EMPTY_BACKUP_STATUS, available: true };
    }
}

/** Result of a successful `unlockWithRecoveryKey` run. */
export interface UnlockResult {
    /** Keys found in the server backup (0 when there is no message backup). */
    total: number;
    /** Keys actually imported into this session. */
    imported: number;
    /** True once this session published its cross-signature (became trusted). */
    sessionVerified: boolean;
}

/**
 * Unlock secret storage with a pasted recovery key, then verify this session and
 * restore encrypted-message history from the server backup — all in one action.
 *
 * Flow: decode the key (malformed → clean retryable error) → validate it against
 * the account's default 4S key info via `secretStorage.checkKey` (wrong key →
 * clean retryable error) → cache it so the SDK's secret-storage reads resolve
 * without prompting → load the backup decryption key from 4S → restore the
 * backup (with progress) → `bootstrapCrossSigning({})` to publish this device's
 * cross-signature (keys already exist in 4S from L2, so no UIA upload).
 *
 * Never persists or logs the key. Wrong keys are surfaced as retryable errors,
 * never a crash, and never lock the user out.
 */
export async function unlockWithRecoveryKey(
    recoveryKey: string,
    onProgress?: (progress: RestoreProgress) => void,
): Promise<UnlockResult> {
    const client = getClient();
    const crypto = client?.getCrypto();
    if (!client || !crypto) {
        throw new Error("Encryption is not ready on this session");
    }

    // 1. Decode. The SDK checks the prefix + parity byte and throws on a
    //    malformed key; surface that as an actionable, retryable message.
    let decoded: Uint8Array<ArrayBuffer>;
    try {
        decoded = decodeRecoveryKey(normalizeRecoveryKey(recoveryKey));
    } catch {
        throw new Error(
            "That doesn't look like a valid recovery key. Check for typos and try again.",
        );
    }

    // 2. Validate against the account's default secret-storage key info. This is
    //    the authoritative "is this the right key" check (MAC over the key info).
    const secretStorage = client.secretStorage;
    const keyTuple = await secretStorage.getKey();
    if (!keyTuple) {
        throw new Error(
            "This account has no recovery set up yet. Set up recovery first on a session that has your keys.",
        );
    }
    const [keyId, keyInfo] = keyTuple;
    const matches = await secretStorage.checkKey(decoded, keyInfo);
    if (!matches) {
        throw new Error(
            "That recovery key doesn't match this account. Check for typos and try again.",
        );
    }

    // 3. Cache the validated key so the cryptoCallbacks resolve secret-storage
    //    reads (backup key, cross-signing keys) without re-prompting.
    secretStorageKeys.set(keyId, decoded);

    // 4. Restore message-history keys, but only if the server actually holds a
    //    backup — an account may have cross-signing/4S without a message backup.
    let total = 0;
    let imported = 0;
    const backupInfo = await crypto.getKeyBackupInfo();
    if (backupInfo) {
        try {
            // Reads the backup key from 4S, validates it against the server
            // backup, and caches it (throws DecryptionKeyDoesNotMatchError on
            // mismatch — the 4S key is right but points at a different backup).
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        } catch (e) {
            if (e instanceof DecryptionKeyDoesNotMatchError) {
                throw new Error(
                    "That key doesn't match this account's backup on the server.",
                );
            }
            throw e;
        }
        const result = await crypto.restoreKeyBackup(
            onProgress
                ? { progressCallback: (p) => onProgress(toRestoreProgress(p)) }
                : undefined,
        );
        total = result.total;
        imported = result.imported;
    }

    // 5. Publish this device's cross-signature so the session becomes trusted.
    //    The cross-signing private keys are now readable from 4S (step 3), so
    //    this doesn't create new keys and never hits the UIA-guarded upload.
    //    Best-effort: a restore that succeeded shouldn't be reported as failed
    //    just because the cross-signature couldn't publish.
    let sessionVerified = false;
    try {
        await crypto.bootstrapCrossSigning({});
        sessionVerified = true;
    } catch (e) {
        console.warn(
            "[matrix] cross-signing this session after unlock failed",
            e,
        );
    }

    bumpSecurityTick();
    return { total, imported, sessionVerified };
}

/** Map the SDK's room-key import progress onto the SDK-free `RestoreProgress`. */
function toRestoreProgress(p: ImportRoomKeyProgressData): RestoreProgress {
    if (p.stage === ImportRoomKeyStage.Fetch) return { stage: "fetch" };
    return {
        stage: "load_keys",
        successes: p.successes,
        failures: p.failures,
        total: p.total,
    };
}
