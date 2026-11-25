// Copies of this account's Megolm room keys, and of the key backup's
// decryption key, for the iOS notification service extension (iosPushKeys.ts).
//
// Android decrypts a push by opening the crypto store itself (a hidden WebView
// holding the store's Web Lock). The iOS extension can do neither: WebKit's
// IndexedDB is private to the app and the extension can't run the crypto WASM.
// So the app hands it copies: every room key the engine learns about is
// exported (exportRoomKeys, read-only) and written to the App Group, and the
// extension decrypts with those. The crypto store is never written from here,
// and never opened outside the app.
//
// New keys are caught by wrapping the RustCrypto instance's onRoomKeysUpdated,
// which the OlmMachine's room-key callback calls; the SDK's own handling runs
// unchanged. Keys this engine already held are copied once per account (a full
// export), when the native mirror is empty or has never been filled.
import type { MatrixClient } from "matrix-js-sdk";
import { CryptoEvent } from "matrix-js-sdk/lib/crypto-api";
import {
    mirrorBackupKey,
    mirrorRoomKeys,
    mirroredKeyCount,
    pushKeyMirrorSupported,
    toMirroredKeys,
} from "$lib/iosPushKeys";
import { getClient } from "$lib/matrix/runtime";
import { readScoped, writeScoped } from "$lib/utils/scopedStorage";

/** Wait this long after a key arrives, so a burst becomes one export. */
const FLUSH_DELAY_MS = 1500;
/** Bumped when the mirror format changes, to force a fresh full copy. */
const FULL_SYNC_FLAG = "iosPushKeys:fullSync:v1";

interface RoomKeyInfoLike {
    roomId: { toString(): string };
    sessionId: string;
}

interface InboundSessionLike {
    roomId: { toString(): string };
    sessionId: string;
}

interface RustRoomKeyHooks {
    olmMachine?: {
        exportRoomKeys(
            predicate: (session: InboundSessionLike) => boolean,
        ): Promise<string>;
    };
    onRoomKeysUpdated?: (keys: RoomKeyInfoLike[]) => Promise<void>;
}

const sessionRef = (roomId: string, sessionId: string) =>
    `${roomId}\n${sessionId}`;

/**
 * Start mirroring `client`'s room keys for `userId`. Returns the detach.
 * No-op off iOS.
 */
export function attachPushKeyMirror(
    client: MatrixClient,
    userId: string,
): () => void {
    if (!pushKeyMirrorSupported()) return () => {};
    const crypto = client.getCrypto();
    const rust = crypto as unknown as RustRoomKeyHooks | undefined;
    if (!crypto || !rust?.olmMachine || !rust.onRoomKeysUpdated) {
        console.warn("[pushKeys] can't reach the crypto engine's room keys");
        return () => {};
    }

    let detached = false;
    const live = () => !detached && getClient() === client;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let chain: Promise<void> = Promise.resolve();

    // Serialise every export and bridge call, so a full copy and a batch never
    // race each other into the same files.
    const run = (job: () => Promise<void>) => {
        chain = chain.then(async () => {
            if (!live()) return;
            try {
                await job();
            } catch (err) {
                console.warn("[pushKeys] mirror step failed", err);
            }
        });
        return chain;
    };

    const exportWhere = async (
        predicate: (session: InboundSessionLike) => boolean,
    ) => toMirroredKeys(await rust.olmMachine!.exportRoomKeys(predicate));

    const flush = () => {
        timer = null;
        if (pending.size === 0) return;
        const wanted = new Set(pending);
        pending.clear();
        void run(async () => {
            const keys = await exportWhere((s) =>
                wanted.has(sessionRef(s.roomId.toString(), s.sessionId)),
            );
            const written = await mirrorRoomKeys(userId, keys);
            console.debug(
                `[pushKeys] mirrored ${written} of ${wanted.size} updated room keys`,
            );
        });
    };

    const original = rust.onRoomKeysUpdated;
    const wrapped = async function (
        this: unknown,
        keys: RoomKeyInfoLike[],
    ): Promise<void> {
        if (live()) {
            for (const k of keys)
                pending.add(sessionRef(k.roomId.toString(), k.sessionId));
            timer ??= setTimeout(flush, FLUSH_DELAY_MS);
        }
        return original.call(this, keys);
    };
    rust.onRoomKeysUpdated = wrapped;

    // Keys the engine held before this run: copy them all once.
    void run(async () => {
        const count = await mirroredKeyCount(userId);
        if (count !== null && count > 0 && readScoped(FULL_SYNC_FLAG, userId))
            return;
        const keys = await exportWhere(() => true);
        const written = await mirrorRoomKeys(userId, keys);
        if (live()) writeScoped(FULL_SYNC_FLAG, "1", userId);
        console.info(
            `[pushKeys] full copy: ${written} of ${keys.length} room keys written`,
        );
    });

    const syncBackupKey = () =>
        void run(async () => {
            const [key, version] = await Promise.all([
                crypto.getSessionBackupPrivateKey(),
                crypto.getActiveSessionBackupVersion(),
            ]);
            await mirrorBackupKey(
                userId,
                key && version ? { key, version } : null,
            );
        });
    syncBackupKey();
    client.on(CryptoEvent.KeyBackupDecryptionKeyCached, syncBackupKey);
    client.on(CryptoEvent.KeyBackupStatus, syncBackupKey);

    // Going to the background: write what's waiting before the engine is
    // released (backgroundRelease.ts waits for engine calls already running).
    const onHidden = () => {
        if (document.visibilityState === "hidden" && timer) {
            clearTimeout(timer);
            flush();
        }
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
        detached = true;
        if (timer) clearTimeout(timer);
        timer = null;
        if (rust.onRoomKeysUpdated === wrapped)
            rust.onRoomKeysUpdated = original;
        client.off(CryptoEvent.KeyBackupDecryptionKeyCached, syncBackupKey);
        client.off(CryptoEvent.KeyBackupStatus, syncBackupKey);
        document.removeEventListener("visibilitychange", onHidden);
    };
}
