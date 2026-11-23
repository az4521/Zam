// Account data the homeserver must not read. Favourites and similar lists are
// encrypted client-side (AES-256-GCM, utils/privateAccountDataCodec.ts) under one
// random key per account, the "private account data key". The server only ever
// sees the account data TYPE and ciphertext.
//
// Where the key lives on this account:
//   - secret storage (4S) under PRIVATE_KEY_SECRET_NAME, so a device that unlocks
//     with the recovery key gets it. The server holds it encrypted by that key.
//   - a per-account localStorage copy (scopedStorage), so a restart does not need
//     the recovery key again. It also records whether the copy is confirmed.
//   - gossip: a device without a usable key asks its other sessions over Olm
//     to-device messages, and a session that has the key answers. Only this
//     account's sessions that are verified and allowed by the "who gets keys"
//     settings are asked or answered, and the key only travels encrypted.
//   - backup-wrapped copy: account data at BACKUP_WRAPPED_KEY_TYPE holds the
//     key wrapped under the message-history backup decryption key
//     (utils/privateKeyBackupWrap.ts). Every verified session gets that backup
//     key by the SDK's own secret gossip, so it unwraps the key with no recovery
//     key and no other session online. The backup key already decrypts all
//     message history, so this is no downgrade. Written only from a confirmed
//     key, in encrypted mode, and tried before 4S when there is no local copy.
//
// Which key is used is decided in utils/privateKeyPolicy.ts from what the
// server's encrypted events say. A key this device generated itself is only
// "unconfirmed" until it decrypts those events (or comes from 4S or a session
// that had it). Read paths never write. A write is refused while the key is not
// usable here, so a device cannot clobber the set another device wrote.

import { ClientEvent } from "matrix-js-sdk";
import { t } from "$lib/i18n";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import {
    fetchPrivateAccountDataFromServer,
    getClient,
    isInitialSyncComplete,
    loadPrivateAccountData,
    onAccountData,
    onSyncPrepared,
    persistPrivateAccountData,
} from "./client";
import { captureClient, ownedClient } from "./runtime";
import {
    hasSecretStorage,
    isSecretStorageUnlocked,
    isThisDeviceCrossSigned,
    onBackupDecryptionKeyCached,
    onSecretStorageReady,
    readBackupDecryptionKey,
    readPrivateKeySecret,
    storePrivateKeySecret,
} from "./crypto";
import {
    deviceAllowed,
    createRateLimit,
    type ReceivedToDevice,
} from "./keyBackfill";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
import {
    decodeKey,
    decryptPrivate,
    encryptPrivate,
    generatePrivateKeyBytes,
    importPrivateKey,
    toBase64,
} from "$lib/utils/privateAccountDataCodec";
import {
    acceptShare,
    keyVerdict,
    secretStorageAction,
    shouldPromote,
    type LocalKeyState,
    type ServerState,
} from "$lib/utils/privateKeyPolicy";
import {
    unwrapPrivateKey,
    wrapNeedsUpdate,
    wrapPrivateKey,
} from "$lib/utils/privateKeyBackupWrap";
import {
    PRIVATE_CACHE_STORAGE,
    PRIVATE_DATA_TYPES,
    PRIVATE_KEY_STATE_STORAGE,
    PRIVATE_KEY_STORAGE,
} from "$lib/utils/privateAccountDataStorage";
import {
    enableKeyStep,
    modeFromServer,
    type FavouritesMode,
} from "$lib/utils/favouritesMode";

export const KEY_REQUEST_TYPE = "com.zam.private_account_data_key.request";
export const KEY_SHARE_TYPE = "com.zam.private_account_data_key.share";
/** The private key wrapped under the backup decryption key (see the header). */
export const BACKUP_WRAPPED_KEY_TYPE =
    "com.zam.private_account_data_key.backup_wrapped";

/** How long before another request for the key is sent. */
const REQUEST_RETRY_MS = 10 * 60_000;
/** A share is accepted only this long after we asked for one. */
const SHARE_WINDOW_MS = 30 * 60_000;
/** First request this long after the account's sync is ready. */
const FIRST_REQUEST_DELAY_MS = 8_000;
/** Answers per minute, so a noisy session cannot flood another. */
const canAnswer = createRateLimit(10);

export type PrivateKeyStatus =
    /** Before the account's first sync: nothing is decided yet. */
    | "unknown"
    /** A usable key is on this device. Reads decrypt, writes are allowed. */
    | "ready"
    /** No usable key on this device yet (unlock or gossip will supply it). */
    | "missing";

class PrivateKeyState {
    status = $state<PrivateKeyStatus>("unknown");
}

/** Read by the UI (the locked hint) and by stores that refuse writes. */
export const privateKeyState = new PrivateKeyState();

class PrivateModeState {
    /** Whether the favourites list is encrypted on the server (account state). */
    mode = $state<FavouritesMode>("unknown");
    /** A switch between plain and encrypted is in progress. */
    switching = $state(false);
}

/** Read by the settings toggle and the favourites store. */
export const privateModeState = new PrivateModeState();

/** Thrown by writes while the key is not usable, or the target is unreadable. */
export class PrivateAccountDataLockedError extends Error {
    constructor() {
        super(t("privateData.locked"));
        this.name = "PrivateAccountDataLockedError";
    }
}

/** What readPrivate found. `locked` carries the last list this device decrypted. */
export type PrivateRead =
    | { kind: "value"; value: unknown; source: "encrypted" | "legacy" }
    | { kind: "absent" }
    | { kind: "locked"; cached: unknown | null };

export interface PrivateReadOptions {
    /** Plaintext types from before encryption, read if no encrypted event exists. */
    legacyTypes?: readonly string[];
    /** Read the homeserver's copy instead of the local sync copy. */
    fresh?: boolean;
}

export interface PrivateWriteOptions {
    /** Plaintext types to blank once the encrypted event is written. */
    clearLegacy?: readonly string[];
}

// The key in memory, the account it belongs to, and whether it is confirmed.
let keyOwner: string | null = null;
let keyBytes: Uint8Array<ArrayBuffer> | null = null;
let cryptoKey: CryptoKey | null = null;
let keyConfirmed = false;
/** When this device last asked its other sessions for the key. */
let requestedAt = 0;
/**
 * Fingerprint (key and backup version) of the wrapped copy this device last
 * sent. Kept until the server's copy of the type changes again, because the
 * echo of our own write can lag the write itself.
 */
let sentWrap: string | null = null;
/** The wrap sync in progress, and whether another pass was asked for meanwhile. */
let backupWrapRun: Promise<void> | null = null;
let backupWrapAgain = false;

const readyListeners = new Set<() => void>();

/**
 * Run `callback` whenever the key or its status changes, so readers
 * (favourites) can decrypt again. Returns an unsubscribe function.
 */
export function onPrivateKeyChange(callback: () => void): () => void {
    readyListeners.add(callback);
    return () => readyListeners.delete(callback);
}

function notifyKeyChange(): void {
    for (const listener of [...readyListeners]) {
        try {
            listener();
        } catch (err) {
            console.warn("[matrix] private key listener failed", err);
        }
    }
}

function setStatus(status: PrivateKeyStatus): void {
    if (privateKeyState.status === status) return;
    privateKeyState.status = status;
    notifyKeyChange();
}

function currentUserId(): string | null {
    return getClient()?.getUserId() ?? null;
}

/** The CryptoKey for `userId`, or null when this device does not have it. */
function keyFor(userId: string | null): CryptoKey | null {
    return userId && keyOwner === userId ? cryptoKey : null;
}

function localState(userId: string): LocalKeyState {
    if (!keyFor(userId)) return "none";
    return keyConfirmed ? "confirmed" : "unconfirmed";
}

function storedKeyBytes(userId: string): Uint8Array<ArrayBuffer> | null {
    return decodeKey(readScoped(PRIVATE_KEY_STORAGE, userId));
}

function storedKeyConfirmed(userId: string): boolean {
    // A key stored without a state (should not happen) is treated as unconfirmed.
    return readScoped(PRIVATE_KEY_STATE_STORAGE, userId) === "confirmed";
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/**
 * Make `bytes` the key for `userId`, in memory and in the local copy. Does not
 * decide the status: callers run reconcile() afterwards.
 */
async function install(
    userId: string,
    bytes: Uint8Array<ArrayBuffer>,
    confirmed: boolean,
): Promise<void> {
    const key = await importPrivateKey(bytes);
    keyOwner = userId;
    keyBytes = bytes;
    cryptoKey = key;
    keyConfirmed = confirmed;
    writeScoped(PRIVATE_KEY_STORAGE, userId, toBase64(bytes));
    writeScoped(
        PRIVATE_KEY_STATE_STORAGE,
        userId,
        confirmed ? "confirmed" : "unconfirmed",
    );
}

function isEmptyRecord(raw: unknown): boolean {
    return (
        !!raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.keys(raw).length === 0
    );
}

function readCache(type: string, userId: string): unknown | null {
    const text = readScoped(`${PRIVATE_CACHE_STORAGE}:${type}`, userId);
    if (text === null) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return null;
    }
}

function writeCache(type: string, userId: string, value: unknown): void {
    writeScoped(
        `${PRIVATE_CACHE_STORAGE}:${type}`,
        userId,
        JSON.stringify(value),
    );
}

async function loadRaw(type: string, fresh: boolean): Promise<unknown | null> {
    return fresh
        ? fetchPrivateAccountDataFromServer(type)
        : loadPrivateAccountData(type);
}

/**
 * The state of the server's encrypted events judged by `key` (null when this
 * device has no key). "none" when there are no events at all.
 */
async function serverState(key: CryptoKey | null): Promise<ServerState> {
    let found = false;
    for (const type of PRIVATE_DATA_TYPES) {
        const raw = loadPrivateAccountData(type);
        if (raw === null || isEmptyRecord(raw)) continue;
        found = true;
        if (!key) return "unreadable";
        const result = await decryptPrivate(key, type, raw);
        if (!result.ok) return "unreadable";
    }
    return found ? "readable" : "none";
}

/**
 * Settle the status from the key on this device and the server's events. A
 * device whose key does not fit the server becomes "missing" and asks its
 * other sessions for the key. An unconfirmed key that does fit is confirmed.
 */
async function reconcile(): Promise<void> {
    const userId = currentUserId();
    if (!userId) return;
    const server = await serverState(keyFor(userId));
    if (currentUserId() !== userId) return;
    if (shouldPromote(localState(userId), server)) {
        keyConfirmed = true;
        writeScoped(PRIVATE_KEY_STATE_STORAGE, userId, "confirmed");
    }
    const verdict = keyVerdict(localState(userId), server);
    setStatus(verdict === "ready" ? "ready" : "missing");
    if (verdict === "missing") scheduleRequest();
    if (verdict === "ready") void syncBackupWrap();
}

/**
 * The decrypted value at `type`. Never throws on bad data: an event this key
 * cannot decrypt comes back `locked`, with the last list this device read.
 */
export async function readPrivate(
    type: string,
    options: PrivateReadOptions = {},
): Promise<PrivateRead> {
    const userId = currentUserId();
    if (!userId) return { kind: "absent" };
    const fresh = options.fresh === true;

    const raw = await loadRaw(type, fresh);
    if (raw !== null && !isEmptyRecord(raw)) {
        const key = keyFor(userId);
        const cached = readCache(type, userId);
        if (!key) return { kind: "locked", cached };
        const result = await decryptPrivate(key, type, raw);
        if (!result.ok) return { kind: "locked", cached };
        writeCache(type, userId, result.value);
        return { kind: "value", value: result.value, source: "encrypted" };
    }

    for (const legacy of options.legacyTypes ?? []) {
        const plain = await loadRaw(legacy, fresh);
        if (plain !== null && !isEmptyRecord(plain)) {
            return { kind: "value", value: plain, source: "legacy" };
        }
    }
    return { kind: "absent" };
}

/**
 * Encrypt `value` and write it to `type`, then blank any legacy plaintext
 * types. Throws PrivateAccountDataLockedError unless this device's key is
 * usable, and when the event already there is one this key cannot read.
 */
export async function writePrivate(
    type: string,
    value: unknown,
    options: PrivateWriteOptions = {},
): Promise<void> {
    const userId = currentUserId();
    if (!userId) throw new Error(t("client.notLoggedIn"));
    const key = keyFor(userId);
    if (!key || privateKeyState.status !== "ready") {
        throw new PrivateAccountDataLockedError();
    }

    // Backstop against replacing data this key cannot read. Callers that
    // read-modify-write have already checked the homeserver's copy.
    const current = loadPrivateAccountData(type);
    if (current !== null && !isEmptyRecord(current)) {
        const readable = await decryptPrivate(key, type, current);
        if (!readable.ok) throw new PrivateAccountDataLockedError();
    }

    const envelope = await encryptPrivate(key, type, value);
    await persistPrivateAccountData(type, envelope);
    writeCache(type, userId, value);
    await clearLegacyPrivateData(options.clearLegacy ?? []);
}

/**
 * Blank plaintext account data left over from before encryption. Each type is
 * overwritten with `{}` (the spec has no delete for account data) only when it
 * still holds something. Best effort: the encrypted copy is already safe, and
 * a failure only leaves the old plaintext visible until the next attempt.
 */
export async function clearLegacyPrivateData(
    types: readonly string[],
): Promise<void> {
    for (const legacy of types) {
        const plain = loadPrivateAccountData(legacy);
        if (plain === null || isEmptyRecord(plain)) continue;
        await persistPrivateAccountData(legacy, {}).catch((err) =>
            console.warn("[matrix] could not clear legacy account data", err),
        );
    }
}

/** Whether this device can read and write the private lists right now. */
export function hasPrivateKey(): boolean {
    return (
        keyFor(currentUserId()) !== null && privateKeyState.status === "ready"
    );
}

function hasEncryptedEvent(): boolean {
    return PRIVATE_DATA_TYPES.some((type) => {
        const raw = loadPrivateAccountData(type);
        return raw !== null && !isEmptyRecord(raw);
    });
}

/**
 * Re-read the favourites mode from this device's copy of the account data.
 * Only after the first sync: before it the copy is empty and would read as
 * plain. Returns whether the mode changed.
 */
export function refreshMode(): boolean {
    if (!isInitialSyncComplete()) return false;
    const next = modeFromServer(hasEncryptedEvent());
    if (privateModeState.mode === next) return false;
    privateModeState.mode = next;
    return true;
}

/** Record a mode this device has just written, before the server echo arrives. */
export function setPrivateMode(mode: FavouritesMode): void {
    privateModeState.mode = mode;
}

// ─── Backup-wrapped copy ─────────────────────────────────────────────────────

/**
 * Install the key in the backup-wrapped copy, when this session holds the backup
 * key that unwraps it and the key fits the server by the rule for a gossiped
 * share (acceptShare). Returns whether a key was installed. The caller settles
 * the status. Never throws.
 */
async function installFromBackupWrap(
    userId: string,
    owner: ReturnType<typeof captureClient>,
): Promise<boolean> {
    const backup = await readBackupDecryptionKey();
    if (!ownedClient(owner) || !backup) return false;
    const raw = loadPrivateAccountData(BACKUP_WRAPPED_KEY_TYPE);
    if (raw === null || isEmptyRecord(raw)) return false;
    const bytes = await unwrapPrivateKey(raw, backup.key, backup.version);
    if (!ownedClient(owner) || !bytes) return false;
    const shareDecrypts =
        (await serverState(await importPrivateKey(bytes))) === "readable";
    const take = acceptShare({
        local: localState(userId),
        server: await serverState(keyFor(userId)),
        shareDecrypts,
    });
    if (!ownedClient(owner) || !take) return false;
    // Only a confirmed key is ever wrapped, so the unwrapped one is confirmed too.
    await install(userId, bytes, true);
    return true;
}

/**
 * Make this device's key usable from the backup-wrapped copy when it has no
 * usable key yet. Returns whether the device now holds a usable key. Callers
 * use it before asking for the recovery key, so a verified session with the
 * backup key does not need it.
 */
export async function restorePrivateKeyFromBackup(): Promise<boolean> {
    const userId = currentUserId();
    if (!userId) return false;
    if (hasPrivateKey()) return true;
    const owner = captureClient();
    if (!(await installFromBackupWrap(userId, owner))) return hasPrivateKey();
    if (!ownedClient(owner)) return false;
    await reconcile();
    return hasPrivateKey();
}

/**
 * Keep the backup-wrapped copy in step with this device's confirmed key. Writes
 * it when the copy is missing, is under another backup version, or does not
 * unwrap to the key. Only in encrypted mode, and never for an unconfirmed key.
 * Idempotent and loop-free: the write echoes back as account data, and the
 * echo finds the copy already right. Overlapping calls are merged into one more
 * pass after the current one.
 */
function syncBackupWrap(): Promise<void> {
    if (backupWrapRun) {
        backupWrapAgain = true;
        return backupWrapRun;
    }
    backupWrapRun = (async () => {
        do {
            backupWrapAgain = false;
            await writeBackupWrapOnce();
        } while (backupWrapAgain);
    })().finally(() => {
        backupWrapRun = null;
    });
    return backupWrapRun;
}

async function writeBackupWrapOnce(): Promise<void> {
    const userId = currentUserId();
    if (!userId || privateModeState.mode !== "encrypted") return;
    if (
        !keyFor(userId) ||
        !keyConfirmed ||
        privateKeyState.status !== "ready"
    ) {
        return;
    }
    const owner = captureClient();
    const bytes = keyBytes;
    try {
        const backup = await readBackupDecryptionKey();
        if (!ownedClient(owner) || !backup || !bytes) return;
        // Still the same confirmed key after the await (it can be replaced).
        if (keyBytes !== bytes || !keyConfirmed) return;
        const fingerprint = `${backup.version}:${toBase64(bytes)}`;
        if (sentWrap === fingerprint) return;
        const current = loadPrivateAccountData(BACKUP_WRAPPED_KEY_TYPE);
        const stale = await wrapNeedsUpdate(
            current,
            backup.key,
            backup.version,
            bytes,
        );
        if (!ownedClient(owner)) return;
        if (!stale) {
            // Already right on this device's copy: nothing to send.
            sentWrap = fingerprint;
            return;
        }
        const content = await wrapPrivateKey(bytes, backup.key, backup.version);
        if (!ownedClient(owner)) return;
        await persistPrivateAccountData(BACKUP_WRAPPED_KEY_TYPE, content);
        sentWrap = fingerprint;
    } catch (err) {
        console.warn("[matrix] could not write the backup-wrapped key", err);
    }
}

/**
 * The backup key changed, or the wrapped copy did. Without a usable key, try the
 * copy now (the status was "missing" while the backup key was not here). With
 * one, make sure the copy is current.
 */
function backupChanged(): void {
    if (privateModeState.mode !== "encrypted") return;
    if (privateKeyState.status === "missing") {
        restorePrivateKeyFromBackup().catch((err) =>
            console.warn("[matrix] restoring the private key failed", err),
        );
    } else if (privateKeyState.status === "ready") {
        void syncBackupWrap();
    }
}

/**
 * Get a usable key ready for turning encryption on. Reads 4S when it is
 * unlocked here. Otherwise makes a device key when the account has no secret
 * storage, or when this session is verified: the list is plain, so there is
 * nothing an older key would need to read, and the new key reaches the other
 * sessions by the backup-wrapped copy and gossip (4S takes it on the next
 * unlock, see secretStorageAction). "unlock" when this session is unverified
 * and cannot read secret storage: its key would reach no other session.
 */
export async function preparePrivateKey(): Promise<
    "ready" | "unlock" | "failed"
> {
    const userId = currentUserId();
    if (!userId) return "failed";
    const owner = captureClient();
    if (keyFor(userId) && !hasPrivateKey()) await reconcile();
    if (!ownedClient(owner)) return "failed";
    // The backup-wrapped copy first: with it, no recovery key is needed.
    if (!hasPrivateKey()) await restorePrivateKeyFromBackup();
    if (!ownedClient(owner)) return "failed";
    const step = enableKeyStep({
        keyReady: hasPrivateKey(),
        hasSecretStorage: await hasSecretStorage(),
        secretStorageUnlocked: await isSecretStorageUnlocked(),
        deviceVerified: await isThisDeviceCrossSigned(),
    });
    if (!ownedClient(owner)) return "failed";
    if (step === "create-key") {
        await install(userId, generatePrivateKeyBytes(), false);
        await reconcile();
    } else if (step === "load-key") {
        await ensureFromSecretStorage();
    }
    if (!ownedClient(owner)) return "failed";
    if (hasPrivateKey()) return "ready";
    return (await hasSecretStorage()) ? "unlock" : "failed";
}

/**
 * Bring the key onto this device once the account is encrypted. The local copy
 * is used when there is one, else 4S when this session can read it. With
 * neither, and no secret storage on the account, this device makes its own
 * key, unconfirmed: it is kept while nothing is on the server, and replaced by
 * gossip if the server's events turn out not to fit it. Only runs in encrypted
 * mode: a plain account never gets a key.
 */
async function bootKey(): Promise<void> {
    const userId = currentUserId();
    if (!userId) return;
    const owner = captureClient();
    if (!keyFor(userId)) {
        const stored = storedKeyBytes(userId);
        if (stored) {
            await install(userId, stored, storedKeyConfirmed(userId));
        } else {
            // No local copy: the backup-wrapped copy comes before 4S, so a
            // verified session with the backup key needs no recovery key.
            await installFromBackupWrap(userId, owner);
            if (!ownedClient(owner)) return;
            if (!keyFor(userId) && !(await hasSecretStorage())) {
                if (!ownedClient(owner)) return;
                await install(userId, generatePrivateKeyBytes(), false);
            }
        }
    }
    if (!ownedClient(owner)) return;
    if (!keyFor(userId)) await ensureFromSecretStorage();
    if (!ownedClient(owner)) return;
    await reconcile();
}

/**
 * Called once secret storage is readable in this session. Works out, from the
 * key this device holds and the server's events, whether 4S should be adopted
 * or written, and does only that (see secretStorageAction).
 */
async function ensureFromSecretStorage(): Promise<void> {
    const userId = currentUserId();
    if (!userId) return;
    const owner = captureClient();
    const remote = await readPrivateKeySecret();
    if (!ownedClient(owner)) return;
    const key = keyFor(userId);
    const server = await serverState(key);
    if (!ownedClient(owner)) return;

    const remoteBytes =
        remote.state === "value" ? decodeKey(remote.value) : null;
    // A 4S key the server's events do not fit is stale (see secretStorageAction).
    const remoteFits =
        remoteBytes !== null &&
        (await serverState(await importPrivateKey(remoteBytes))) !==
            "unreadable";
    if (!ownedClient(owner)) return;
    const action = secretStorageAction({
        remote: remote.state,
        remoteFits,
        local: localState(userId),
        server,
    });
    if (action === "adopt" && remote.state === "value") {
        const bytes = remoteBytes;
        if (!bytes) {
            console.warn(
                "[matrix] the stored private account data key is malformed",
            );
        } else if (!(
            keyBytes &&
            sameBytes(keyBytes, bytes) &&
            keyOwner === userId &&
            keyConfirmed
        )) {
            await install(userId, bytes, true);
        }
    } else if (
        (action === "generate-and-store" || action === "store-local") &&
        !(await isSecretStorageUnlocked())
    ) {
        // Locked here (the session can be verified with 4S still locked):
        // writing would only fail. The caller asks for the recovery key, and
        // onSecretStorageReady runs this again once it is entered.
        if (!ownedClient(owner)) return;
    } else if (action === "generate-and-store" || action === "store-local") {
        const bytes =
            action === "store-local" && key && keyBytes
                ? keyBytes
                : generatePrivateKeyBytes();
        try {
            await storePrivateKeySecret(toBase64(bytes));
            // Stored in 4S, so this is the account's key now.
            await install(userId, bytes, true);
        } catch (err) {
            console.warn(
                "[matrix] could not store the private account data key",
                err,
            );
            showErrorToast(t("privateData.keySaveFailed"));
        }
    }
    if (!ownedClient(owner)) return;
    await reconcile();
}

// ─── Gossip between this account's own sessions ──────────────────────────────

/** Own sessions that are verified and allowed to receive secrets. */
async function trustedOwnDevices(): Promise<
    { userId: string; deviceId: string }[]
> {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = client?.getUserId();
    const ownDeviceId = client?.getDeviceId();
    if (!crypto || !userId) return [];
    const known = (await crypto.getUserDeviceInfo([userId])).get(userId);
    const out: { userId: string; deviceId: string }[] = [];
    for (const deviceId of known?.keys() ?? []) {
        if (deviceId === ownDeviceId) continue;
        const status = await crypto.getDeviceVerificationStatus(
            userId,
            deviceId,
        );
        if (status?.isVerified() && deviceAllowed(crypto, userId, status)) {
            out.push({ userId, deviceId });
        }
    }
    return out;
}

/** Ask this account's other trusted sessions for the key. Returns how many. */
async function requestFromOwnDevices(): Promise<number> {
    const client = getClient();
    const crypto = client?.getCrypto();
    if (!client || !crypto || privateKeyState.status === "ready") return 0;
    const owner = captureClient();
    requestedAt = Date.now();
    const devices = await trustedOwnDevices();
    if (!ownedClient(owner) || devices.length === 0) return 0;
    const batch = await crypto.encryptToDeviceMessages(
        KEY_REQUEST_TYPE,
        devices,
        {},
    );
    if (batch.batch.length > 0) await client.queueToDevice(batch);
    return devices.length;
}

/** How long the unlock prompt waits for another session to send the key. */
const FETCH_WAIT_MS = 60_000;

/**
 * The unlock prompt's "another device" path: get the key without the recovery
 * key. Tries the backup-wrapped copy, then asks this account's other verified
 * sessions now (not on the retry timer) and waits for one to answer, until
 * `signal` aborts or FETCH_WAIT_MS passes. "no-devices" when there is no
 * verified session to ask.
 */
export async function fetchPrivateKeyFromOwnDevices(
    signal?: AbortSignal,
): Promise<"ready" | "no-devices" | "timeout"> {
    if (hasPrivateKey()) return "ready";
    const owner = captureClient();
    if (await restorePrivateKeyFromBackup()) return "ready";
    if (!ownedClient(owner) || signal?.aborted) return "timeout";
    const asked = await requestFromOwnDevices();
    if (hasPrivateKey()) return "ready";
    if (asked === 0) return "no-devices";
    const deadline = Date.now() + FETCH_WAIT_MS;
    while (Date.now() < deadline) {
        if (!ownedClient(owner) || signal?.aborted) return "timeout";
        if (hasPrivateKey()) return "ready";
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return hasPrivateKey() ? "ready" : "timeout";
}

let requestTimer: ReturnType<typeof setTimeout> | null = null;

/** Ask for the key once, a short while from now, unless asked recently. */
function scheduleRequest(): void {
    if (requestTimer) return;
    if (Date.now() - requestedAt < REQUEST_RETRY_MS) return;
    requestTimer = setTimeout(() => {
        requestTimer = null;
        if (privateKeyState.status !== "missing") return;
        requestFromOwnDevices().catch((err) =>
            console.warn(
                "[matrix] asking own sessions for the private key failed",
                err,
            ),
        );
    }, FIRST_REQUEST_DELAY_MS);
}

/**
 * Answer or accept a to-device message about the key. Only messages from one
 * of this account's trusted sessions count. A device answers only with a key
 * known to fit the server (confirmed, or decrypting what is there), and accepts
 * a share only when it asked recently and the share fits (see acceptShare).
 */
async function onToDevice(payload: ReceivedToDevice): Promise<void> {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = currentUserId();
    const { message, encryptionInfo } = payload;
    if (!client || !crypto || !userId) return;
    if (!encryptionInfo || encryptionInfo.sender !== userId) return;
    const senderDevice = encryptionInfo.senderDevice;
    if (!senderDevice || senderDevice === client.getDeviceId()) return;
    if (message.type !== KEY_REQUEST_TYPE && message.type !== KEY_SHARE_TYPE) {
        return;
    }
    const status = await crypto.getDeviceVerificationStatus(
        userId,
        senderDevice,
    );
    if (!status?.isVerified() || !deviceAllowed(crypto, userId, status)) return;

    if (message.type === KEY_REQUEST_TYPE) {
        const bytes = keyFor(userId) ? keyBytes : null;
        if (!bytes || !canAnswer()) return;
        const fits =
            localState(userId) === "confirmed" ||
            (await serverState(keyFor(userId))) === "readable";
        if (!fits) return;
        const batch = await crypto.encryptToDeviceMessages(
            KEY_SHARE_TYPE,
            [{ userId, deviceId: senderDevice }],
            { key: toBase64(bytes) },
        );
        if (batch.batch.length > 0) await client.queueToDevice(batch);
        return;
    }

    if (requestedAt === 0 || Date.now() - requestedAt > SHARE_WINDOW_MS) return;
    const bytes = decodeKey(message.content.key);
    if (!bytes) return;
    const shareDecrypts =
        (await serverState(await importPrivateKey(bytes))) === "readable";
    const take = acceptShare({
        local: localState(userId),
        server: await serverState(keyFor(userId)),
        shareDecrypts,
    });
    if (!take) return;
    requestedAt = 0;
    await install(userId, bytes, true);
    await reconcile();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Start private account data: boot the key once the account has synced, adopt
 * or write 4S whenever it becomes readable, re-check the key when the encrypted
 * events change, and answer or request the key over to-device messages.
 * Returns a cleanup function that also forgets the key held in memory.
 */
export function initPrivateAccountData(): () => void {
    const client = getClient();
    const userId = client?.getUserId();
    if (!client || !userId) return () => {};

    // Each start works from this device's stored copy, not from memory.
    keyOwner = null;
    keyBytes = null;
    cryptoKey = null;
    keyConfirmed = false;
    setStatus("unknown");
    privateModeState.mode = "unknown";

    // Every path below is gated on the account being encrypted. A plain
    // account gets no key, reads no 4S and sends no gossip requests.
    const bootEncrypted = (): void => {
        if (privateModeState.mode !== "encrypted") return;
        bootKey().catch((err) =>
            console.warn("[matrix] private account data key boot failed", err),
        );
    };
    const handler = (event: unknown): void => {
        // Answering a request needs no mode check: a key held here is shared
        // only with this account's verified sessions.
        onToDevice(event as ReceivedToDevice).catch((err) =>
            console.warn("[matrix] private key to-device message failed", err),
        );
    };

    const unsubSync = onSyncPrepared(() => {
        refreshMode();
        bootEncrypted();
    });
    const unsubSecret = onSecretStorageReady(() => {
        if (privateModeState.mode !== "encrypted") return;
        ensureFromSecretStorage().catch((err) =>
            console.warn(
                "[matrix] private key from secret storage failed",
                err,
            ),
        );
    });
    const unsubAccount = onAccountData((type) => {
        if (type === BACKUP_WRAPPED_KEY_TYPE) {
            // The server's copy changed (or our own write echoed): forget what
            // this device last sent, and act on the copy as it now stands.
            sentWrap = null;
            backupChanged();
            return;
        }
        if (!(PRIVATE_DATA_TYPES as readonly string[]).includes(type)) return;
        // Another device may have turned encryption on or off: follow it.
        refreshMode();
        bootEncrypted();
    });
    const unsubBackupKey = onBackupDecryptionKeyCached(() => backupChanged());
    client.on(ClientEvent.ReceivedToDeviceMessage as never, handler as never);
    if (isInitialSyncComplete()) {
        refreshMode();
        bootEncrypted();
    }

    return () => {
        unsubSync();
        unsubSecret();
        unsubAccount();
        unsubBackupKey();
        client.off(
            ClientEvent.ReceivedToDeviceMessage as never,
            handler as never,
        );
        if (requestTimer) clearTimeout(requestTimer);
        requestTimer = null;
        keyOwner = null;
        keyBytes = null;
        cryptoKey = null;
        keyConfirmed = false;
        sentWrap = null;
        setStatus("unknown");
        privateModeState.mode = "unknown";
    };
}
