// Decrypting a pushed event with NO app running.
//
// pushDecrypt.ts covers the case where a page is open: the notification
// surface asks it, and the live client decrypts. When nothing is running (the
// Android app was swiped away, no browser tab is open) there is no client to
// ask, so this opens the account's rust-crypto store directly with the crypto
// WASM, decrypts the one event, and closes it again.
//
// It is bundled on its own (scripts/build-push-decrypt.mjs) and loaded by the
// service worker and by the hidden WebView MatrixMessagingService.java starts,
// so it must not import anything from the app beyond the store naming.
//
// Two OlmMachines on one store corrupt it, so this only runs while it holds the
// store's Web Lock exclusively; every page running crypto holds the same lock
// in shared mode (see holdCryptoStoreLock in crypto.ts). If a page has it, this
// gives up at once: that page is the one to ask.

import {
    DecryptionSettings,
    DeviceId,
    DeviceLists,
    OlmMachine,
    RoomId,
    StoreHandle,
    TrustRequirement,
    UserId,
    initAsync,
} from "@matrix-org/matrix-sdk-crypto-wasm";
import { getCryptoDbName, getCryptoLockName } from "./utils/cryptoStore";

export interface HeadlessDecryptParams {
    homeserverUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
    roomId: string;
    /** The m.room.encrypted event as the homeserver returned it. */
    event: Record<string, unknown>;
    /** Where the crypto WASM is served from. */
    wasmUrl: string;
}

export interface HeadlessDecryptResult {
    type: string;
    content: Record<string, unknown>;
}

/**
 * Bound on the to-device fetch made while holding the store lock. A page that
 * opens meanwhile waits for the lock (crypto.ts, 30s), so everything done
 * under it has to finish well inside that.
 */
const TO_DEVICE_FETCH_TIMEOUT_MS = 8000;

/** A sync that carries only to-device messages and key counts. */
const TO_DEVICE_ONLY_FILTER = JSON.stringify({
    room: { rooms: [] },
    presence: { types: [] },
    account_data: { types: [] },
});

/**
 * Decrypt one event without a running client. Null when the store is in use
 * by a page, the room key is not available, or anything fails. Never throws.
 */
export async function decryptHeadless(
    params: HeadlessDecryptParams,
): Promise<HeadlessDecryptResult | null> {
    try {
        const locks = (globalThis.navigator as Navigator | undefined)?.locks;
        // Without locks there is no way to stay out of a running page's way.
        if (!locks) return null;
        // Load the WASM BEFORE taking the lock: it is the slow part (download
        // and compile on a cold worker), and a page opening meanwhile has to
        // wait for us.
        await initAsync(params.wasmUrl);
        return await locks.request(
            getCryptoLockName(params.userId, params.deviceId),
            { mode: "exclusive", ifAvailable: true },
            (lock) => (lock ? decryptWithStore(params) : null),
        );
    } catch {
        return null;
    }
}

async function decryptWithStore(
    params: HeadlessDecryptParams,
): Promise<HeadlessDecryptResult | null> {
    const store = await StoreHandle.open(
        getCryptoDbName(params.userId, params.deviceId),
        undefined,
    );
    let machine: OlmMachine | null = null;
    try {
        machine = await OlmMachine.initFromStore(
            new UserId(params.userId),
            new DeviceId(params.deviceId),
            store,
        );
        const first = await tryDecrypt(machine, params);
        if (first) return first;
        // Usually the room key is already in the store. It is not when this
        // message started a new megolm session: its key came as a to-device
        // message in a sync no client has run yet. Fetch the pending ones and
        // try again. Nothing is acknowledged (no `since`), so the app's own
        // next sync still receives every one of them.
        if (!(await receivePendingToDevice(machine, params))) return null;
        return await tryDecrypt(machine, params);
    } finally {
        try {
            machine?.close();
        } catch {
            /* already closed */
        }
        try {
            store.free();
        } catch {
            /* already freed */
        }
    }
}

async function tryDecrypt(
    machine: OlmMachine,
    params: HeadlessDecryptParams,
): Promise<HeadlessDecryptResult | null> {
    try {
        const res = await machine.decryptRoomEvent(
            JSON.stringify(params.event),
            new RoomId(params.roomId),
            new DecryptionSettings(TrustRequirement.Untrusted),
        );
        const clear = JSON.parse(res.event) as {
            type?: unknown;
            content?: unknown;
        };
        if (
            typeof clear.type !== "string" ||
            clear.type === "m.room.encrypted" ||
            !clear.content ||
            typeof clear.content !== "object"
        )
            return null;
        return {
            type: clear.type,
            content: clear.content as Record<string, unknown>,
        };
    } catch {
        return null;
    }
}

/** Feed the server's pending to-device messages to the machine. */
async function receivePendingToDevice(
    machine: OlmMachine,
    params: HeadlessDecryptParams,
): Promise<boolean> {
    const base = params.homeserverUrl.replace(/\/+$/, "");
    const url =
        `${base}/_matrix/client/v3/sync?timeout=0&set_presence=offline` +
        `&filter=${encodeURIComponent(TO_DEVICE_ONLY_FILTER)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
        signal: AbortSignal.timeout(TO_DEVICE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const sync = (await res.json()) as {
        to_device?: { events?: unknown[] };
        device_one_time_keys_count?: Record<string, number>;
        device_unused_fallback_key_types?: string[];
    };
    const events = sync.to_device?.events ?? [];
    if (!events.length) return false;
    await machine.receiveSyncChanges(
        JSON.stringify(events),
        new DeviceLists(),
        new Map(Object.entries(sync.device_one_time_keys_count ?? {})),
        sync.device_unused_fallback_key_types
            ? new Set(sync.device_unused_fallback_key_types)
            : undefined,
    );
    return true;
}
