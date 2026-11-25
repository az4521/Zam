/**
 * The iOS PushKeys plugin (ios/App/App/Plugins/PushKeysPlugin.swift): copies of
 * Megolm room keys and the key backup's decryption key, written to the App
 * Group so the notification service extension can decrypt pushed events
 * (ios/App/NotificationService/Megolm.swift). The extension can neither open
 * the crypto store nor run the crypto WASM, and it only ever reads these
 * copies, so the store itself is never touched outside the app.
 *
 * matrix/pushKeyMirror.ts decides what to send; this module is the bridge and
 * the pure shaping of an exported key. No-op off iOS.
 */
import { registerPlugin } from "@capacitor/core";
import { isIos } from "./utils/mobileNative";

/** The fields of an ExportedRoomKey the extension needs. */
export interface MirroredRoomKey {
    room_id: string;
    session_id: string;
    session_key: string;
    sender_key?: string;
}

interface PushKeysPlugin {
    store(opts: {
        userId: string;
        keys: MirroredRoomKey[];
    }): Promise<{ written: number }>;
    setBackupKey(opts: {
        userId: string;
        version?: string;
        key?: string;
    }): Promise<void>;
    status(opts: {
        userId: string;
    }): Promise<{ keys: number; backup: boolean }>;
}

let plugin: PushKeysPlugin | null = null;
function bridge(): PushKeysPlugin | null {
    if (!isIos()) return null;
    plugin ??= registerPlugin<PushKeysPlugin>("PushKeys");
    return plugin;
}

/** How many keys go over the bridge in one call. */
export const MIRROR_BATCH = 200;

/**
 * Megolm room keys from an exportRoomKeys JSON array, reduced to what the
 * extension stores. Anything malformed or of another algorithm is dropped.
 */
export function toMirroredKeys(exportJson: string): MirroredRoomKey[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(exportJson);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: MirroredRoomKey[] = [];
    for (const raw of parsed) {
        if (!raw || typeof raw !== "object") continue;
        const k = raw as Record<string, unknown>;
        if (k.algorithm !== "m.megolm.v1.aes-sha2") continue;
        if (
            typeof k.room_id !== "string" ||
            typeof k.session_id !== "string" ||
            typeof k.session_key !== "string"
        )
            continue;
        const key: MirroredRoomKey = {
            room_id: k.room_id,
            session_id: k.session_id,
            session_key: k.session_key,
        };
        if (typeof k.sender_key === "string") key.sender_key = k.sender_key;
        out.push(key);
    }
    return out;
}

/** Store `keys` for `userId` in batches. Returns how many were written. */
export async function mirrorRoomKeys(
    userId: string,
    keys: MirroredRoomKey[],
): Promise<number> {
    const p = bridge();
    if (!p || keys.length === 0) return 0;
    let written = 0;
    for (let i = 0; i < keys.length; i += MIRROR_BATCH) {
        const res = await p.store({
            userId,
            keys: keys.slice(i, i + MIRROR_BATCH),
        });
        written += res?.written ?? 0;
    }
    return written;
}

/** The backup decryption key (raw bytes) and its version; null removes it. */
export async function mirrorBackupKey(
    userId: string,
    backup: { version: string; key: Uint8Array } | null,
): Promise<void> {
    const p = bridge();
    if (!p) return;
    if (!backup) {
        await p.setBackupKey({ userId });
        return;
    }
    let binary = "";
    for (const b of backup.key) binary += String.fromCharCode(b);
    await p.setBackupKey({
        userId,
        version: backup.version,
        key: btoa(binary),
    });
}

/** How many keys are mirrored for `userId`, or null off iOS / on failure. */
export async function mirroredKeyCount(userId: string): Promise<number | null> {
    const p = bridge();
    if (!p) return null;
    try {
        return (await p.status({ userId })).keys;
    } catch {
        return null;
    }
}

export function pushKeyMirrorSupported(): boolean {
    return isIos();
}
