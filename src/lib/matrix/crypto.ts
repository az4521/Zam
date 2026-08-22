/**
 * E2EE (rust-crypto) boundary. Kept out of the 3.6k-line `client.ts` because
 * crypto is a whole subsystem with several stacked layers; it shares the single
 * `matrixClient` via the `getClient()` accessor exported from `client.ts`.
 *
 * Layer 0: initialise crypto so incoming `m.room.encrypted` events decrypt and
 * outgoing messages auto-encrypt in already-encrypted rooms.
 * Layer 1 (this file too): device & user verification by emoji (SAS) or QR code
 * — request wrappers, an incoming-request subscription, and trust-status reads.
 * The raw `VerificationRequest`/`Verifier` SDK objects never leave this module;
 * callers drive a plain `VerificationController`. Cross-signing, key backup,
 * and enable-encryption UI are Layers 2–4.
 */

import { EventTimeline, MatrixEventEvent } from "matrix-js-sdk";
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
    VerificationRequestEvent,
    VerifierEvent,
    ImportRoomKeyStage,
    decodeRecoveryKey,
    deriveRecoveryKeyFromPassphrase,
    DecryptionKeyDoesNotMatchError,
} from "matrix-js-sdk/lib/crypto-api";
import type {
    VerificationRequest,
    Verifier,
    ShowSasCallbacks,
    ShowQrCodeCallbacks,
    EmojiMapping,
    CryptoCallbacks,
    ImportRoomKeyProgressData,
} from "matrix-js-sdk/lib/crypto-api";
import { getClient, createDirectMessage } from "$lib/matrix/client";
import {
    ROOM_ENCRYPTION_EVENT_TYPE,
    shouldEncryptNewDm,
} from "$lib/utils/roomEncryption";
import { settingsState } from "$lib/stores/settings.svelte";
import { getCryptoDbName } from "$lib/utils/cryptoStore";
import {
    cryptoDbNames,
    readPendingWipes,
    rememberPendingWipe,
    writePendingWipes,
    wipesToRetry,
    type PendingWipe,
} from "$lib/utils/pendingCryptoWipe";
import { readScoped } from "$lib/utils/scopedStorage";
import { normalizeRecoveryKey } from "$lib/utils/recoveryKey";
import { passphraseParams } from "$lib/utils/recoveryPassphrase";
import {
    qrMethodOptions,
    NO_METHOD_OPTIONS,
    VerificationMethodValue,
    type QrMethodOptions,
} from "$lib/utils/qrVerification";
import type { RestoreProgress } from "$lib/utils/keyBackup";
import type {
    SecurityRead,
    SecurityPosture,
    SecuritySetupState,
} from "$lib/utils/securityStatusView";
import { securitySetupState } from "$lib/utils/securityStatusView";
import { supportsPasswordUia } from "$lib/utils/deviceSessions";
import { bumpTimelineTick } from "$lib/stores/messages.svelte";
import { bumpSecurityTick } from "$lib/stores/security.svelte";
import { setSessionCryptoStatus } from "$lib/stores/sessionHealth.svelte";

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
 * Apply the account's "only send to verified devices" preference.
 *
 * `globalBlacklistUnverifiedDevices` is a plain mutable property on the crypto
 * api and is IN-MEMORY ONLY — it is not persisted by the SDK, so it has to be
 * re-applied after every `initCrypto` (see the call there), not just when the
 * user flips the toggle. Deliberately NOT `setDeviceIsolationMode`: that also
 * refuses to DECRYPT from non-cross-signed devices, which is a much bigger
 * behaviour change than this setting promises.
 */
export function applyVerifiedOnlySending(enabled: boolean): void {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return;
    crypto.globalBlacklistUnverifiedDevices = enabled;
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
    setSessionCryptoStatus(null);
    // Session expiry drops back to the login view in place (no reload), so a
    // re-login re-enters here in the same JS context — against a fresh crypto
    // store that knows nothing about sender devices. Verdicts memoised for the
    // old session would be served for the same event ids and under-warn.
    clearEventShieldCache();
    backupSessionsRemaining = null;
    try {
        await client.initRustCrypto({
            cryptoDatabasePrefix: getCryptoDbName(userId, deviceId),
        });
        cryptoAvailable = true;
        setSessionCryptoStatus(true);
        // `globalBlacklistUnverifiedDevices` is in-memory only on the crypto
        // api, so the persisted preference has to be re-applied every session.
        // Read straight from storage, scoped to the `userId` we were handed,
        // rather than from the settings store: initCrypto runs during login
        // (from `createAuthenticatedClient` in client.ts) but the store is
        // only repointed at the new account by `reloadAccountSettings()`,
        // which AppShell.svelte calls after mount — so on an account switch
        // the store still holds the PREVIOUS account's preference right here.
        const cryptoApi = client.getCrypto();
        if (cryptoApi) {
            cryptoApi.globalBlacklistUnverifiedDevices =
                readScoped("settings:sendToVerifiedOnly", userId) === "true";
        }
        attachDecryptionListener(client);
        attachSecurityListeners(client);
    } catch (err) {
        console.warn(
            "[matrix] rust-crypto init failed; encrypted rooms will show " +
                "placeholders and this session can't send to encrypted rooms",
            err,
        );
        setSessionCryptoStatus(false);
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
//
// The last two are about TRUST rather than settings: verifying a device or
// re-fetching a user's device list changes the shield on every message they
// sent, so they also drop the per-event shield memo. Without them a shield
// goes stale the moment a device is verified.
const SECURITY_EVENTS = [
    CryptoEvent.KeysChanged,
    CryptoEvent.KeyBackupStatus,
    CryptoEvent.KeyBackupDecryptionKeyCached,
    CryptoEvent.KeyBackupFailed,
    CryptoEvent.UserTrustStatusChanged,
    CryptoEvent.DevicesUpdated,
] as const;

// Last `CryptoEvent.KeyBackupSessionsRemaining` payload — how many room keys
// this session still has to upload to the backup. Null until the SDK reports
// (it only emits while a backup is active), and reset per session because it
// describes THIS client's upload queue, not account state.
let backupSessionsRemaining: number | null = null;
let sessionsRemainingClient: MatrixClient | null = null;
let sessionsRemainingHandler: ((remaining: number) => void) | null = null;

let securityListenerClient: MatrixClient | null = null;
let securityHandler: (() => void) | null = null;

function attachSecurityListeners(client: MatrixClient): void {
    if (securityListenerClient === client) return;
    detachSecurityListeners();
    const handler = (): void => {
        // Trust changed somewhere: every cached shield verdict is now suspect.
        clearEventShieldCache();
        bumpSecurityTick();
    };
    for (const event of SECURITY_EVENTS) {
        client.on(event as never, handler as never);
    }
    // `KeyBackupSessionsRemaining` carries a `(remaining: number)` payload, so
    // it can't ride the shared no-arg handler above — it gets its own pair.
    const remainingHandler = (remaining: number): void => {
        backupSessionsRemaining = remaining;
        bumpSecurityTick();
    };
    client.on(
        CryptoEvent.KeyBackupSessionsRemaining as never,
        remainingHandler as never,
    );
    sessionsRemainingClient = client;
    sessionsRemainingHandler = remainingHandler;
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
    if (sessionsRemainingClient && sessionsRemainingHandler) {
        sessionsRemainingClient.off(
            CryptoEvent.KeyBackupSessionsRemaining as never,
            sessionsRemainingHandler as never,
        );
    }
    sessionsRemainingClient = null;
    sessionsRemainingHandler = null;
    securityListenerClient = null;
    securityHandler = null;
}

/**
 * The internal SDK surface the sync loop uses to configure room encryption.
 * `onCryptoEvent` is declared on `CryptoBackend`, not the public `CryptoApi`,
 * and `roomEncryptors` is rust-crypto's in-memory map of configured rooms —
 * read here only to skip redundant work, never mutated.
 */
interface CryptoSyncHooks {
    onCryptoEvent?: (room: Room, event: MatrixEvent) => Promise<void>;
    roomEncryptors?: Record<string, unknown>;
}

/**
 * Teach the crypto layer about a room whose `m.room.encryption` state event
 * reached the Room model WITHOUT passing through the sync loop.
 *
 * The SDK builds a room's `RoomEncryptor` in exactly one place: `onCryptoEvent`,
 * called from the sync loop for encryption events in a /sync response. Our
 * federated-stub heal (`seedRoomStateIfMissing`) injects state straight into the
 * Room model for rooms the homeserver omits from sync, so a healed encrypted
 * room ends up known-encrypted to the UI while crypto was never configured —
 * and every send fails with "Cannot encrypt event in unconfigured room" even
 * though incoming messages still decrypt (Megolm keys arrive over to-device,
 * which doesn't need an encryptor). Replaying the event through the same hook is
 * precisely what the sync loop would have done.
 *
 * The gate is the in-memory `roomEncryptors` map, NOT
 * `isEncryptionEnabledInRoom()`: the room's algorithm is persisted in the crypto
 * store, so that call answers "yes, encrypted" while the encryptor map — rebuilt
 * from sync each session — is still empty. Never throws: a room we can't
 * configure fails at send time exactly as it does today.
 */
export async function ensureRoomCryptoConfigured(room: Room): Promise<void> {
    if (!cryptoAvailable) return;
    const crypto = getClient()?.getCrypto() as
        | (CryptoSyncHooks | undefined)
        | undefined;
    if (!crypto?.onCryptoEvent) return;
    if (crypto.roomEncryptors?.[room.roomId]) return;
    const event = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents(ROOM_ENCRYPTION_EVENT_TYPE, "");
    if (!event) return;
    try {
        await crypto.onCryptoEvent(room, event as MatrixEvent);
    } catch (err) {
        console.warn(
            `[matrix] could not configure crypto for ${room.roomId}`,
            err,
        );
    }
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

/** How long a single deleteDatabase gets before we call it blocked. Boot
 *  never waits on the sweep, but an unbounded wait would keep the request
 *  and its closure alive for the life of the page. */
const DELETE_DB_TIMEOUT_MS = 5000;

export type DeleteDbOutcome = "deleted" | "failed" | "blocked";

/**
 * `indexedDB.deleteDatabase`, bounded and honest about which of the three
 * things happened. The SDK's own version (`client.js:736`) leaves `onblocked`
 * as a log-only handler, so its promise never settles — that is the bug this
 * whole module exists for, and it must not be reproduced here.
 *
 * "blocked" means another connection still holds the database: nothing was
 * deleted and the caller must keep its record. Exported for unit tests.
 */
export function deleteDatabaseWithOutcome(
    factory: IDBFactory,
    name: string,
    timeoutMs: number,
): Promise<DeleteDbOutcome> {
    return new Promise<DeleteDbOutcome>((resolve) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (outcome: DeleteDbOutcome) => {
            if (settled) return;
            settled = true;
            if (timer !== undefined) clearTimeout(timer);
            resolve(outcome);
        };
        try {
            const req = factory.deleteDatabase(name);
            req.onsuccess = () => finish("deleted");
            // Private-mode Firefox rejects every delete, even of a database
            // that does not exist; there is nothing to do but report it.
            req.onerror = () => finish("failed");
            req.onblocked = () => finish("blocked");
            timer = setTimeout(() => finish("blocked"), timeoutMs);
        } catch {
            finish("failed");
        }
    });
}

function getIndexedDB(): IDBFactory | null {
    try {
        return globalThis.indexedDB ?? null;
    } catch {
        return null;
    }
}

/** Deletes both databases for a prefix; true only if BOTH are really gone. */
async function deleteCryptoDbs(
    factory: IDBFactory,
    prefix: string,
): Promise<boolean> {
    const outcomes = await Promise.all(
        cryptoDbNames(prefix).map((name) =>
            deleteDatabaseWithOutcome(factory, name, DELETE_DB_TIMEOUT_MS),
        ),
    );
    return outcomes.every((o) => o === "deleted");
}

/**
 * Best-effort wipe of a NON-active account's rust-crypto IndexedDB when it is
 * removed from this device (the account has no live client, so `clearStores`
 * isn't available). Deletes the same two databases the SDK's `clearStores`
 * targets, keyed by the per-account prefix — so it can only ever touch that
 * account's stores, never the active session's. Failures are ignored (private
 * browsing rejects deleteDatabase; a missing DB is a no-op) but recorded, so
 * the next boot can finish a wipe another tab blocked.
 *
 * The active account's own sign-out already wipes its crypto store via
 * `client.clearStores({ cryptoDatabasePrefix })` in `logout()`.
 */
export async function deleteCryptoStore(
    userId: string,
    deviceId: string,
): Promise<void> {
    const factory = getIndexedDB();
    if (!factory) return;
    const cryptoDbPrefix = getCryptoDbName(userId, deviceId);
    const deleted = await deleteCryptoDbs(factory, cryptoDbPrefix);
    if (!deleted) {
        // Blocked by another tab, or refused: leave a marker so the next boot
        // finishes it. Resolving here regardless keeps this function's
        // never-rejects contract for its two callers.
        rememberPendingWipe({ userId, deviceId, cryptoDbPrefix });
    }
}

/**
 * Whether a record's delete target is the one its own identity implies.
 *
 * The live-session guard (`wipesToRetry`) matches on user + device, but the
 * irreversible call takes `cryptoDbPrefix` — a string read verbatim off
 * localStorage, which the parser only checks is non-empty. A record whose
 * prefix does not derive from its own ids therefore aims the delete at a
 * database the guard never inspected, which could be the ACTIVE account's
 * crypto store. Corruption, a hand-edited entry, an extension, or a future
 * change to `getCryptoDbName` all produce exactly that.
 *
 * Mismatched records are SKIPPED AND KEPT, the same rule as a live session: we
 * never delete on a guess, and we never claim a wipe finished that didn't.
 */
function prefixMatchesIdentity(wipe: PendingWipe): boolean {
    return wipe.cryptoDbPrefix === getCryptoDbName(wipe.userId, wipe.deviceId);
}

let sweepInFlight = false;

/**
 * Finish any crypto-store wipe a previous sign-out could not complete.
 *
 * `clearStores()` never resolves when another tab holds the rust-crypto
 * IndexedDB open (matrix-js-sdk's `req.onblocked` only logs), and the logout
 * reload wins that race — so the plaintext key material of a signed-out
 * account can survive on disk. This re-issues those deletes at boot.
 *
 * Never touches a session still known to this device, never blocks boot, and
 * never rejects. Records whose deletes are STILL blocked are kept for the next
 * boot rather than reported as done. Call it fire-and-forget.
 *
 * Nothing awaits it, but it is not instant: records are swept serially, so the
 * worst case is `MAX_PENDING_WIPES` (16) × 2 databases × `DELETE_DB_TIMEOUT_MS`
 * ≈ 160s holding `sweepInFlight`, during which a second call is a no-op. Only a
 * store that never fires an event at all gets anywhere near that.
 *
 * An EMPTY `liveSessions` means "no session on this device is live", i.e. every
 * recorded wipe is eligible — and `loadRegistry()` fails open to `[]` on a
 * corrupt `matrix_accounts`, so that is a reachable state, not a hypothetical.
 * What bounds the damage there is `prefixMatchesIdentity`: a record can only
 * ever delete the two databases its own user id and device id name.
 */
export async function retryPendingCryptoWipes(
    liveSessions: Array<{ userId: string; deviceId?: string | null }>,
): Promise<void> {
    if (sweepInFlight) return;
    sweepInFlight = true;
    try {
        const stored = readPendingWipes();
        if (stored.length === 0) return;
        const factory = getIndexedDB();
        if (!factory) return;
        const targets = wipesToRetry(stored, liveSessions).filter(
            prefixMatchesIdentity,
        );
        if (targets.length === 0) return;
        const finished: typeof targets = [];
        for (const wipe of targets) {
            if (await deleteCryptoDbs(factory, wipe.cryptoDbPrefix)) {
                finished.push(wipe);
            }
        }
        if (finished.length === 0) return;
        // Re-read: another tab may have written since, and a wipe we just
        // finished must not resurrect its list.
        const remaining = readPendingWipes().filter(
            (w) =>
                !finished.some(
                    (f) => f.userId === w.userId && f.deviceId === w.deviceId,
                ),
        );
        writePendingWipes(remaining);
    } catch (e) {
        // Boot must never fail on a best-effort cleanup — but this is the one
        // place in the sweep that does something irreversible, so a silent
        // no-op would leave live-verify no signal at all that it gave up.
        console.warn("[matrix] pending crypto wipe sweep failed", e);
    } finally {
        sweepInFlight = false;
    }
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

// ─── Layer 1: device & user verification (SAS emoji / QR) ────────────────────
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
    /** Which method affordances to offer right now (all false once settled). */
    methodOptions: QrMethodOptions;
    /**
     * A `.start` we sent is in flight: sent, but no verifier hooked yet. Goes
     * false again the moment one is (success) or the send fails (retryable).
     * `methodOptions` can't cover this window because the phase is still
     * `Ready`, so disable the chooser while true — a second tap during it is
     * swallowed by the start latch.
     */
    startPending: boolean;
    /** Our QR payload once generated, for display. Null until `showQrCode()` succeeds. */
    qrBytes: Uint8ClampedArray | null;
    /** The other side scanned our code and we must confirm it really was them. */
    awaitingReciprocateConfirm: boolean;
    /**
     * Last failure from ANY method action — showing/scanning a QR *or* starting
     * the emoji check. Render it outside the QR pane so a `startVerification()`
     * failure can't go invisible. Null when fine.
     */
    qrError: string | null;
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
    /** Generate our QR payload and expose it via `view().qrBytes`. */
    showQrCode(): Promise<void>;
    /** Hand a payload our camera decoded to the SDK; starts the reciprocate flow. */
    submitScannedQr(bytes: Uint8ClampedArray): Promise<void>;
    /** Explicitly choose the emoji (SAS) method. */
    startSas(): Promise<void>;
    /** Confirm the other side really scanned our code. */
    confirmReciprocate(): void;
    /** Deny the reciprocate prompt (they did not scan our code). */
    denyReciprocate(): void;
    /** Tear down SDK listeners and clear subscriptions. Call when finished. */
    dispose(): void;
}

let verificationCounter = 0;

/** True when this host exposes a camera API at all, so scanning is possible. */
function hasCameraApi(): boolean {
    return (
        typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function"
    );
}

/**
 * User-facing text for a failed verification action. The SDK's throws on these
 * paths are developer strings ("generateQRCode(): other device is unknown",
 * "Still no verifier after scanQrCode() call"), so the plain-language message
 * is what we show and the raw error goes to the console for debugging.
 */
function verificationFailureText(error: unknown, fallback: string): string {
    console.warn(`[matrix] verification action failed: ${fallback}`, error);
    return fallback;
}

/**
 * Wrap a live `VerificationRequest` in a `VerificationController`. Once the
 * request is `Ready` the controller offers whichever methods both sides can
 * actually do (`view().methodOptions`, decided by the pure `qrMethodOptions`):
 * show our QR, scan theirs, or compare emoji. When neither side can do QR there
 * is nothing to choose, so it starts the SAS verifier unprompted — the exact
 * pre-QR behaviour, no extra taps. Whichever method wins, the verifier is
 * hooked, `verify()` runs, and the user decides match / no-match / cancel.
 */
function createVerificationController(
    request: VerificationRequest,
): VerificationController {
    const id = request.transactionId ?? `verification-${++verificationCounter}`;
    let sasCallbacks: ShowSasCallbacks | null = null;
    let reciprocateCallbacks: ShowQrCodeCallbacks | null = null;
    let qrBytes: Uint8ClampedArray | null = null;
    let qrError: string | null = null;
    let startRequested = false;
    let verifierHooked = false;
    let hookedVerifier: Verifier | null = null;
    let onShowSas: ((callbacks: ShowSasCallbacks) => void) | null = null;
    let onShowReciprocateQr: ((callbacks: ShowQrCodeCallbacks) => void) | null =
        null;
    let onVerifierCancel: (() => void) | null = null;
    // The user has answered the "they scanned my code" prompt. Needed because
    // the SDK NEVER clears its own `callbacks` once the QR has been scanned
    // (rust-crypto/verification.js assigns it and nothing ever nulls it), so
    // the live re-read below would otherwise resurrect a dismissed prompt on
    // the very next change event — confirming or cancelling itself fires one.
    let reciprocateSettled = false;
    const subscribers = new Set<() => void>();
    const emit = (): void => {
        for (const cb of subscribers) cb();
    };

    // `otherPartySupportsMethod` reads state that only exists once the other
    // side's `.ready` has landed; treat any throw as "not supported" so a probe
    // in an early phase can never break the flow.
    const otherSupports = (method: string): boolean => {
        try {
            return request.otherPartySupportsMethod(method);
        } catch {
            return false;
        }
    };

    const currentOptions = (): QrMethodOptions => {
        if (verifierHooked || request.verifier) return NO_METHOD_OPTIONS;
        return qrMethodOptions({
            phase: request.phase,
            otherCanScan: otherSupports(VerificationMethodValue.ScanQrCode),
            otherCanShow: otherSupports(VerificationMethodValue.ShowQrCode),
            hasVerifier: false,
            cameraAvailable: hasCameraApi(),
        });
    };

    // Pick up whatever the verifier already has pending. Both callback objects
    // live on the verifier and are populated by its OWN rust change callback,
    // which fires independently of the request's — so neither the `ShowSas` /
    // `ShowReciprocateQr` events nor a single read at hook time can be trusted
    // to have happened yet. These accessors are live state reads (they just
    // return the verifier's current `callbacks`), so re-reading on every change
    // makes us independent of which callback the SDK delivers first.
    // `sasCallbacks` needs no settled latch: we never null it, so there is
    // nothing for a re-read to resurrect.
    const syncVerifierCallbacks = (): void => {
        if (!hookedVerifier) return;
        sasCallbacks ??= hookedVerifier.getShowSasCallbacks();
        if (!reciprocateSettled) {
            reciprocateCallbacks ??=
                hookedVerifier.getReciprocateQrCodeCallbacks();
        }
    };

    const hookVerifier = (verifier: Verifier): void => {
        // Idempotent, and deliberately keeps the FIRST verifier — `advance()`,
        // `startSas()` and `submitScannedQr()` can all reach here. Dropping a
        // later, DIFFERENT verifier object is only safe because
        // `request.verifier` is phase-gated: the SDK returns undefined until
        // phase `Started` precisely so the app can't grab a QR verifier that a
        // switch to SAS would replace (a QR→SAS transition constructs a brand
        // new RustSASVerifier — only the SAS-vs-SAS start tie-break preserves
        // identity, via replaceInner). If `advance()` is ever changed to hook
        // earlier than `Started`, this guard silently drops the real verifier
        // and `verify()` is never called on it.
        if (verifierHooked) return;
        verifierHooked = true;
        hookedVerifier = verifier;
        // A method is now settled, so any earlier failure (e.g. a premature
        // "show my code") is stale — don't let it linger over the live flow.
        qrError = null;
        onShowSas = (callbacks: ShowSasCallbacks) => {
            sasCallbacks = callbacks;
            emit();
        };
        onShowReciprocateQr = (callbacks: ShowQrCodeCallbacks) => {
            reciprocateCallbacks = callbacks;
            emit();
        };
        onVerifierCancel = () => emit();
        verifier.on(VerifierEvent.ShowSas, onShowSas);
        verifier.on(VerifierEvent.ShowReciprocateQr, onShowReciprocateQr);
        verifier.on(VerifierEvent.Cancel, onVerifierCancel);
        // The prompt can fire before we attach — the SDK builds the verifier
        // straight from an inbound `.start` — so read anything already pending
        // before kicking off verify(). The Change handler covers the late half.
        syncVerifierCallbacks();
        // verify() resolves when both sides confirm and rejects on cancel /
        // mismatch / timeout; either way the terminal state shows via `phase`.
        verifier.verify().catch(() => emit());
    };

    const startSas = async (): Promise<void> => {
        // Re-render even when the latch swallows the call, so a chooser that is
        // still on screen during the round-trip doesn't look simply dead.
        if (startRequested || request.verifier) {
            emit();
            return;
        }
        startRequested = true;
        try {
            hookVerifier(
                await request.startVerification(VerificationMethodValue.Sas),
            );
            qrError = null;
        } catch (e) {
            startRequested = false;
            qrError = verificationFailureText(
                e,
                "Could not start the emoji check",
            );
        }
        emit();
    };

    const advance = (): void => {
        if (request.verifier) {
            hookVerifier(request.verifier);
            return;
        }
        // With no QR option on either side there is nothing to choose, so start
        // the emoji check unprompted — the exact pre-QR behaviour. `advance()`
        // re-runs on every change event and the `.start` send is async, so the
        // `startRequested` latch is what stops a duplicate `.start` going out.
        if (!startRequested && currentOptions().shouldAutoStartSas) {
            void startSas();
        }
    };

    const onRequestChange = () => {
        advance();
        // The verifier's own change callback re-emits Change onto the request,
        // so by the time we get here its callbacks are set even when the
        // request's callback was delivered first. Without this re-read, that
        // ordering leaves `awaitingReciprocateConfirm` false forever and the
        // "they scanned my code" confirm button never appears.
        syncVerifierCallbacks();
        emit();
    };
    request.on(VerificationRequestEvent.Change, onRequestChange);
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
            methodOptions: currentOptions(),
            // The internal latch stays true for the controller's life (it is
            // the swallow-guard); "pending" to a consumer means only the
            // window before the verifier lands.
            startPending: startRequested && !verifierHooked,
            qrBytes,
            awaitingReciprocateConfirm: reciprocateCallbacks !== null,
            qrError,
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
            void request.cancel().catch((e) => {
                verificationFailureText(e, "Could not cancel the verification");
            });
        },
        startSas,
        showQrCode: async () => {
            // Past Ready the method is settled and generateQRCode() returns
            // undefined for that reason, not because they can't scan — so bail
            // out rather than show a misleading message. Nothing changed here,
            // hence no emit.
            if (verifierHooked || request.verifier) return;
            // Never regenerate. The first call drives the rust request into
            // `Transitioned`, so a second one returns undefined — which would
            // null a code that is on screen and working, and blame it on the
            // other side being unable to scan. Two taps reach this: Show ->
            // "Choose a different method" -> Show.
            if (qrBytes) {
                emit();
                return;
            }
            // Clear BEFORE the attempt, not just on success: nothing else ever
            // clears it short of a hooked verifier, so a retry would otherwise
            // run under the previous attempt's red error text. Emit, or the
            // cleared value stays invisible until the post-await emit —
            // `view()` captures it by value and only a notification re-renders.
            qrError = null;
            emit();
            try {
                const bytes = await request.generateQRCode();
                qrBytes = bytes ?? null;
                qrError = bytes
                    ? null
                    : "No code available - the other side can't scan one.";
            } catch (e) {
                qrBytes = null;
                qrError = verificationFailureText(
                    e,
                    "Could not generate a QR code",
                );
            }
            emit();
        },
        submitScannedQr: async (bytes) => {
            // Same as startSas: emit even when swallowed, so a chooser still on
            // screen re-renders instead of the button appearing dead.
            if (startRequested || request.verifier) {
                emit();
                return;
            }
            startRequested = true;
            // Same as showQrCode: clear before the attempt so a re-scan after a
            // rejected one doesn't run under the old error, and emit so the
            // clear is actually visible. Strictly AFTER the latch — that stays
            // the first statement on this path, with no await ahead of it, so a
            // duplicate `m.key.verification.start` remains impossible. `emit()`
            // is synchronous and re-entry would hit the guard above anyway.
            qrError = null;
            emit();
            try {
                hookVerifier(await request.scanQRCode(bytes));
                qrError = null;
            } catch (e) {
                startRequested = false;
                qrError = verificationFailureText(
                    e,
                    "That code doesn't match this verification",
                );
            }
            emit();
        },
        // Both reciprocate handlers latch `reciprocateSettled`, clear our
        // reference, and notify BEFORE calling into the SDK — so a throw from
        // the callback can't leave the prompt stuck on screen with no
        // re-render, and the change event the SDK call itself triggers can't
        // re-populate the prompt from the callbacks it never clears.
        confirmReciprocate: () => {
            const callbacks = reciprocateCallbacks;
            reciprocateSettled = true;
            reciprocateCallbacks = null;
            emit();
            try {
                callbacks?.confirm();
            } catch (e) {
                verificationFailureText(e, "Could not confirm the QR match");
            }
        },
        denyReciprocate: () => {
            const callbacks = reciprocateCallbacks;
            reciprocateSettled = true;
            reciprocateCallbacks = null;
            emit();
            if (callbacks) {
                try {
                    callbacks.cancel();
                } catch (e) {
                    verificationFailureText(e, "Could not cancel the QR match");
                }
            } else {
                void request.cancel().catch((e) => {
                    verificationFailureText(
                        e,
                        "Could not cancel the verification",
                    );
                });
            }
        },
        dispose: () => {
            request.off(VerificationRequestEvent.Change, onRequestChange);
            if (hookedVerifier) {
                if (onShowSas)
                    hookedVerifier.off(VerifierEvent.ShowSas, onShowSas);
                if (onShowReciprocateQr)
                    hookedVerifier.off(
                        VerifierEvent.ShowReciprocateQr,
                        onShowReciprocateQr,
                    );
                if (onVerifierCancel)
                    hookedVerifier.off(VerifierEvent.Cancel, onVerifierCancel);
            }
            subscribers.clear();
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
    // A device that just signed in may not be in our crypto store yet;
    // requestDeviceVerification throws "not a known device" for unknown
    // devices. Force a keys download first so the fresh device is resolvable.
    await crypto.getUserDeviceInfo([userId], true);
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
    // Only the room id matters here — verification rides in the room itself.
    // A failed m.direct write leaves the room unfiled, not unusable; it stays
    // pending so the next DM open retries it (see retryRoomFollowUp).
    //
    // Create it honouring the account's "encrypt new DMs" setting. The spec does
    // NOT require the verification channel to be encrypted — SAS is secure over
    // cleartext (MSC2241: "key verification does not rely on secrecy"). But this
    // DM becomes the CANONICAL DM with the contact (createDirectMessage dedupes
    // on account+contact), so leaving it plaintext while the setting is on would
    // hand the user a permanent unencryptable chat room the next "Message" click
    // silently reuses. Crypto readiness is already proven above (we threw if
    // getCrypto() was falsy), so the setting is the only remaining question.
    const { roomId } = await createDirectMessage(
        userId,
        shouldEncryptNewDm({
            cryptoReady: isCryptoAvailable(),
            setting: settingsState.encryptNewDms,
        }),
    );
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
 * Shield inputs for a single timeline event, reduced from the SDK's
 * `EventEncryptionInfo` to plain numbers so the pure view-model in
 * `utils/eventShield.ts` can stay SDK-free. Null when the event is
 * unencrypted, has not decrypted yet, has no id, or crypto isn't ready.
 */
export interface EventShieldInfo {
    colour: number;
    reason: number | null;
}

// Memo of shield verdicts by event id. Computing one is a rust-crypto round
// trip, and the timeline re-renders on every tick, so an unmemoised read would
// be one call per rendered row per tick. Bounded so a long session can't leak;
// dropped wholesale by `clearEventShieldCache()` whenever trust changes.
const EVENT_SHIELD_CACHE_MAX = 1000;
const eventShieldCache = new Map<string, EventShieldInfo>();

// Bumped on every invalidation so a fetch that was already in flight can tell
// that the world changed under it and decline to write its stale verdict back.
let shieldCacheEpoch = 0;

/**
 * Drop every memoised shield verdict. Called from the security-event handler
 * (a verification or device-list update invalidates every shield at once), from
 * `initCrypto` (session expiry returns to login in place, with no reload, so a
 * memo would otherwise outlive the crypto store it was computed against), and
 * available to tests.
 */
export function clearEventShieldCache(): void {
    eventShieldCache.clear();
    shieldCacheEpoch++;
}

/**
 * Shield verdict for one event. Memoised per event id — but only for real
 * verdicts: a `null` means "unencrypted, or not decrypted yet", and the second
 * is transient (keys arrive later over to-device), so caching it would pin a
 * message to "no shield" forever.
 */
export async function getEventShield(
    event: MatrixEvent,
): Promise<EventShieldInfo | null> {
    const eventId = event.getId();
    if (!eventId) return null;

    const cached = eventShieldCache.get(eventId);
    if (cached) return cached;

    const crypto = getClient()?.getCrypto();
    if (!crypto) return null;
    // Snapshot the epoch BEFORE the round trip. If trust changes while we are
    // in flight the map is cleared under us, and writing this now-stale verdict
    // back would hide the very change the shield exists to surface (the rust
    // callback fires after the store commit, so an identity change can easily
    // land mid-fetch). The value is still right for the caller that asked, so
    // it is returned either way — just not persisted across the boundary.
    const epoch = shieldCacheEpoch;
    try {
        const info = await crypto.getEncryptionInfoForEvent(event);
        if (!info) return null;
        const reduced: EventShieldInfo = {
            colour: info.shieldColour,
            reason: info.shieldReason ?? null,
        };
        // Local echo (`status !== null`) is skipped: the SDK short-circuits
        // outgoing events to a NONE shield without consulting the crypto store,
        // and the id is a transaction id that the remote echo replaces — so the
        // entry is instantly orphaned and would evict a real verdict.
        if (epoch === shieldCacheEpoch && event.status === null) {
            if (eventShieldCache.size >= EVENT_SHIELD_CACHE_MAX) {
                const oldest = eventShieldCache.keys().next().value;
                if (oldest !== undefined) eventShieldCache.delete(oldest);
            }
            eventShieldCache.set(eventId, reduced);
        }
        return reduced;
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
                    "This server can't confirm encryption setup with a password - use its account page instead.",
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
    /** The key was ALSO derived from a passphrase the user can type instead. */
    hasPassphrase: boolean;
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
    passphrase?: string,
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

    // 2. Mint the recovery key. With a passphrase the SDK derives the key via
    //    PBKDF2 and returns the derivation parameters in `keyInfo.passphrase`,
    //    which bootstrapSecretStorage then publishes in account_data — that is
    //    what makes "unlock with passphrase" possible later. The random key is
    //    still generated and shown either way: the passphrase is an ADDITIONAL
    //    path, never a replacement (v1 shipped random-only deliberately).
    const generated = await crypto.createRecoveryKeyFromPassphrase(
        passphrase && passphrase.length > 0 ? passphrase : undefined,
    );
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
    return {
        recoveryKey: encoded,
        hasPassphrase: generated.keyInfo?.passphrase != null,
    };
}

/**
 * `resetEncryption()` succeeded but minting the replacement recovery did not:
 * the old recovery key and backup are already gone, so retrying the
 * DESTRUCTIVE half is never right — only `setupRecovery()` may be retried.
 */
export class RecoverySetupIncompleteError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "RecoverySetupIncompleteError";
    }
}

export function isRecoverySetupIncomplete(
    error: unknown,
): error is RecoverySetupIncompleteError {
    return error instanceof RecoverySetupIncompleteError;
}

/**
 * Reset recovery when the recovery key has been lost. Wipes the existing setup
 * ({@link CryptoApi.resetEncryption}: resets cross-signing, removes the old 4S
 * default key, deletes backups, creates a fresh backup) then sets up recovery
 * again from the clean slate — minting a NEW recovery key to show once.
 *
 * Requires the account password (UIA-guarded signing-key upload). Returns the
 * new encoded recovery key. Destructive: the previous recovery key and any
 * device verifications signed by the old cross-signing identity are invalidated.
 */
export async function resetRecovery(
    password: string,
    passphrase?: string,
): Promise<RecoverySetupResult> {
    const client = getClient();
    const crypto = client?.getCrypto();
    const userId = client?.getUserId();
    if (!crypto || !userId) {
        throw new Error("Encryption is not ready on this session");
    }

    // 1. Tear down the old (unusable) recovery. UIA-guarded → password dance.
    //    A failure HERE is reported as-is: from outside we cannot tell whether
    //    it destroyed anything, and re-running the reset is the only sane
    //    retry (it is idempotent on an already-reset account).
    await crypto.resetEncryption(makeUiaPasswordCallback(userId, password));

    // 2. Set up fresh from the clean slate. bootstrapCrossSigning inside is a
    //    no-op now (resetEncryption just re-established it, so no re-upload/UIA),
    //    and a new recovery key is minted + returned for the UI to show once.
    //    Past this line the OLD recovery is gone, so a failure is not a plain
    //    retryable error — the caller must repair, not reset again (CRYPTO-01).
    try {
        return await setupRecovery(password, passphrase);
    } catch (error) {
        throw new RecoverySetupIncompleteError(
            error instanceof Error && error.message.trim().length > 0
                ? error.message
                : "Your old recovery was reset, but setting up the new one failed.",
            { cause: error },
        );
    }
}

/** Plain view-model of the account's crypto/security posture, for the UI. */
export interface SecurityStatus {
    /** Outcome of this read: ok, crypto-not-ready, or the read itself failed. */
    read: SecurityRead;
    /** Cross-signing identity is set up and usable. */
    crossSigningReady: boolean;
    /** Cross-signing private keys are stored (encrypted) in secret storage. */
    privateKeysInSecretStorage: boolean;
    /** Secret storage (4S) is fully set up — i.e. "recovery is set up". */
    secretStorageReady: boolean;
    /** The default secret-storage key id, if any. */
    defaultKeyId: string | null;
    /** The account's default 4S key can also be unlocked with a passphrase. */
    passphraseRecovery: boolean;
    /** This device is verified via cross-signing. */
    thisDeviceVerified: boolean;
}

const EMPTY_SECURITY_STATUS: SecurityStatus = {
    read: "unavailable",
    crossSigningReady: false,
    privateKeysInSecretStorage: false,
    secretStorageReady: false,
    defaultKeyId: null,
    passphraseRecovery: false,
    thisDeviceVerified: false,
};

/**
 * Read the account's cross-signing + secret-storage posture as a plain
 * view-model. Re-read whenever `securityState.securityTick` bumps. Never throws:
 * the outcome of the read is reported in `read` instead.
 *
 * Callers MUST branch on `read` before believing the rest: on `"error"` (and on
 * `"unavailable"`) every other field is an all-false placeholder, NOT a fact
 * about the account. Treating `"error"` as "nothing is set up" is exactly the
 * bug this field exists to prevent — it invites the user to set up (or reset)
 * recovery on top of keys that are working fine (audit CRYPTO-02).
 */
export async function getSecurityStatus(): Promise<SecurityStatus> {
    const client = getClient();
    const crypto = client?.getCrypto();
    if (!crypto || !client) return { ...EMPTY_SECURITY_STATUS };
    try {
        const [
            crossSigningReady,
            crossStatus,
            secretStorageReady,
            ssStatus,
            keyTuple,
        ] = await Promise.all([
            crypto.isCrossSigningReady(),
            crypto.getCrossSigningStatus(),
            crypto.isSecretStorageReady(),
            crypto.getSecretStorageStatus(),
            // Reading the default 4S key description tells us whether the user
            // can unlock by passphrase; `null` on an account with no recovery.
            client.secretStorage.getKey().catch(() => null),
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
            read: "ok",
            crossSigningReady,
            privateKeysInSecretStorage: crossStatus.privateKeysInSecretStorage,
            secretStorageReady,
            defaultKeyId: ssStatus.defaultKeyId,
            passphraseRecovery: passphraseParams(keyTuple?.[1]) !== null,
            thisDeviceVerified,
        };
    } catch {
        // The read failed — say so. The all-false payload underneath is a
        // placeholder the caller must not read as the account's posture.
        return { ...EMPTY_SECURITY_STATUS, read: "error" };
    }
}

// ─── Layer 3: key-backup restore & recovery on another session ───────────────
//
// The "recover" side of E2EE. On a session that lacks the keys, the user pastes
// their recovery key to unlock secret storage, which cross-signs (trusts) this
// session AND loads the message-history backup key so encrypted history restores.

/** Plain view-model of the account's key-backup posture, for the UI. */
export interface BackupStatus {
    /** Outcome of this read: ok, crypto-not-ready, or the read itself failed. */
    read: SecurityRead;
    /** The server holds a key backup for this account. */
    exists: boolean;
    /** This session is actively backing up to it (its backup key is loaded). */
    active: boolean;
    /** The backup carries a valid signature from a trusted device. */
    trusted: boolean;
    /** The loaded backup decryption key matches the server backup. */
    matchesDecryptionKey: boolean;
    /** Sessions the server holds in the backup (`KeyBackupInfo.count`). */
    count: number | null;
    /** Sessions this client still has to upload, null until the SDK reports. */
    sessionsRemaining: number | null;
    /** The active/known backup version, if any. */
    version: string | null;
}

const EMPTY_BACKUP_STATUS: BackupStatus = {
    read: "unavailable",
    exists: false,
    active: false,
    trusted: false,
    matchesDecryptionKey: false,
    count: null,
    sessionsRemaining: null,
    version: null,
};

/**
 * Read the account's key-backup posture as a plain view-model. Re-read whenever
 * `securityState.securityTick` bumps (KeyBackup* CryptoEvents drive it). Never
 * throws: the outcome of the read is reported in `read` instead.
 *
 * Callers MUST branch on `read` before believing the rest: on `"error"` (and on
 * `"unavailable"`) `exists: false` means "we don't know", not "this account has
 * no backup" — rendering it as the latter is the CRYPTO-02 bug.
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
            read: "ok",
            exists: info != null,
            active: activeVersion != null,
            trusted,
            matchesDecryptionKey,
            count: info?.count ?? null,
            sessionsRemaining: backupSessionsRemaining,
            version: info?.version ?? activeVersion ?? null,
        };
    } catch {
        // The read failed — say so. `exists: false` below means "unknown".
        return { ...EMPTY_BACKUP_STATUS, read: "error" };
    }
}

/**
 * Load the two raw signals that feed device-verification status:
 * - deviceTrust.isVerified (local verification OR cross-signing)
 * - setupState (whole-account encryption posture)
 *
 * Reconciled by `reconcileVerification` (utils/verificationStatus.ts) into
 * a unified view that resolves the "az contradiction" where a locally-verified
 * session could show a misleading "verified" badge despite incomplete setup.
 *
 * Never throws; returns sanitized fallbacks on crypto-unavailable or read errors.
 */
export async function getOwnVerificationStatusInputs(): Promise<{
    deviceTrust: { isVerified: boolean; signedByOwner: boolean } | null;
    setupState: SecuritySetupState;
}> {
    try {
        const client = getClient();
        const crypto = client?.getCrypto();
        if (!crypto || !client) {
            return { deviceTrust: null, setupState: "unavailable" };
        }

        const [sec, bak] = await Promise.all([
            getSecurityStatus(),
            getBackupStatus(),
        ]);

        const posture: SecurityPosture = {
            read: sec.read,
            backupRead: bak.read,
            secretStorageReady: sec.secretStorageReady ?? false,
            defaultKeyId: sec.defaultKeyId ?? null,
            thisDeviceVerified: sec.thisDeviceVerified ?? false,
            backupExists: bak.exists ?? false,
            backupActive: bak.active ?? false,
            hasLastGood: true,
        };
        const setupState = securitySetupState(posture);

        const userId = client.getUserId();
        const deviceId = client.getDeviceId();
        const deviceTrust =
            userId && deviceId ? await getDeviceTrust(userId, deviceId) : null;

        return { deviceTrust, setupState };
    } catch {
        return { deviceTrust: null, setupState: "read-failed" };
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
 * Shared tail of both unlock paths (recovery key and passphrase): cache the
 * validated 4S key, restore the message-history backup if one exists, then
 * publish this device's cross-signature. The two public entry points differ
 * only in how they obtain and validate `decoded`.
 */
async function completeUnlock(
    crypto: NonNullable<ReturnType<MatrixClient["getCrypto"]>>,
    keyId: string,
    decoded: Uint8Array<ArrayBuffer>,
    onProgress?: (progress: RestoreProgress) => void,
): Promise<UnlockResult> {
    // Cache the validated key so the cryptoCallbacks resolve secret-storage
    // reads (backup key, cross-signing keys) without re-prompting.
    secretStorageKeys.set(keyId, decoded);

    // Restore message-history keys, but only if the server actually holds a
    // backup — an account may have cross-signing/4S without a message backup.
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

    // Publish this device's cross-signature so the session becomes trusted.
    // The cross-signing private keys are now readable from 4S, so this doesn't
    // create new keys and never hits the UIA-guarded upload. Best-effort: a
    // restore that succeeded shouldn't be reported as failed just because the
    // cross-signature couldn't publish.
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

    // 3-5. Cache, restore history, cross-sign this session.
    return completeUnlock(crypto, keyId, decoded, onProgress);
}

/**
 * Unlock secret storage with the user's recovery PASSPHRASE instead of the
 * recovery key, then verify this session and restore history — same outcome as
 * {@link unlockWithRecoveryKey}.
 *
 * Only possible when the account's default 4S key was created with a
 * passphrase (`SecurityStatus.passphraseRecovery`): the PBKDF2 salt and
 * iteration count live in the key description in account_data. We derive the
 * key locally and then run the SAME authoritative `checkKey` validation, so a
 * wrong passphrase is a clean retryable error and never a lockout.
 *
 * Never persists or logs the passphrase or the derived key.
 */
export async function unlockWithPassphrase(
    passphrase: string,
    onProgress?: (progress: RestoreProgress) => void,
): Promise<UnlockResult> {
    const client = getClient();
    const crypto = client?.getCrypto();
    if (!client || !crypto) {
        throw new Error("Encryption is not ready on this session");
    }

    const secretStorage = client.secretStorage;
    const keyTuple = await secretStorage.getKey();
    if (!keyTuple) {
        throw new Error(
            "This account has no recovery set up yet. Set up recovery first on a session that has your keys.",
        );
    }
    const [keyId, keyInfo] = keyTuple;

    // The SDK's types say `passphrase` is always present; account_data says
    // otherwise for a randomly-generated key, hence the validated read.
    const params = passphraseParams(keyInfo);
    if (!params) {
        throw new Error(
            "This account's recovery wasn't set up with a passphrase. Use your recovery key instead.",
        );
    }

    // Derivation is WebCrypto-backed, so it throws a raw platform message on an
    // insecure context (plain http) — nothing to do with the passphrase being
    // wrong, which `checkKey` below catches. Rewrite it as something the user
    // can act on rather than leaking "not available on this platform".
    let decoded: Uint8Array<ArrayBuffer>;
    try {
        decoded = await deriveRecoveryKeyFromPassphrase(
            passphrase,
            params.salt,
            params.iterations,
            params.bits,
        );
    } catch {
        throw new Error(
            "Couldn't use your passphrase on this device. Try your recovery key instead.",
        );
    }

    const matches = await secretStorage.checkKey(decoded, keyInfo);
    if (!matches) {
        throw new Error(
            "That passphrase doesn't match this account. Check for typos and try again.",
        );
    }

    return completeUnlock(crypto, keyId, decoded, onProgress);
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
