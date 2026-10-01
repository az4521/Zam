/**
 * The user's own sound bank for MIDI attachments (Settings > Messages & media
 * > MIDI sound bank): validation plus device-local IndexedDB storage for the
 * single custom slot. Read by ./midiSoundBank.ts.
 *
 * `validateCustomSoundBankFile` is pure; `indexedDB` is referenced only inside
 * function bodies so the module import is safe in jsdom and SSR.
 */
import { t } from "$lib/i18n";

/** Same cap as the desktop app's system bank read (electron/main.cjs). */
export const CUSTOM_SOUND_BANK_MAX_BYTES = 256 * 1024 * 1024;
const ALLOWED_EXTS = ["sf2", "sf3", "dls"] as const;
export const CUSTOM_SOUND_BANK_ACCEPT = ALLOWED_EXTS.map((e) => `.${e}`).join(
    ",",
);

export type SoundBankValidationResult =
    { ok: true } | { ok: false; reason: string };

/** Pure: check an uploaded bank's name and size. */
export function validateCustomSoundBankFile(file: {
    name: string;
    size: number;
}): SoundBankValidationResult {
    const dot = file.name.lastIndexOf(".");
    const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
    if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) {
        return { ok: false, reason: t("midiSoundBank.useAnSf2Sf3OrDls") };
    }
    if (file.size <= 0) {
        return { ok: false, reason: t("midiSoundBank.thatFileIsEmpty") };
    }
    if (file.size > CUSTOM_SOUND_BANK_MAX_BYTES) {
        return { ok: false, reason: t("midiSoundBank.fileIsTooLarge") };
    }
    return { ok: true };
}

/** RIFF container check (SF2, SF3 and DLS are all RIFF files). */
export function isRiff(data: ArrayBuffer): boolean {
    const b = new Uint8Array(data, 0, Math.min(4, data.byteLength));
    return String.fromCharCode(...b) === "RIFF";
}

// ---- IndexedDB (single record, id "custom"). ----

export interface StoredSoundBank {
    id: "custom";
    name: string;
    size: number;
    data: ArrayBuffer;
    storedAt: number;
}

const DB_NAME = "zam-soundbanks";
const STORE = "banks";
const RECORD_ID = "custom";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function getStoredSoundBank(): Promise<StoredSoundBank | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly");
            const r = tx.objectStore(STORE).get(RECORD_ID);
            r.onsuccess = () => resolve((r.result as StoredSoundBank) ?? null);
            r.onerror = () => reject(r.error);
        });
    } catch {
        return null;
    }
}

/** Name and size of the stored bank, without handing back its bytes. */
export async function getStoredSoundBankInfo(): Promise<{
    name: string;
    size: number;
} | null> {
    const rec = await getStoredSoundBank();
    return rec ? { name: rec.name, size: rec.size } : null;
}

/** Persist the bank. Returns false when the write fails (quota exceeded,
 *  private mode, no IndexedDB); a quota failure surfaces only as a
 *  transaction abort, so `onabort` counts as failure too. */
export async function putStoredSoundBank(
    rec: Omit<StoredSoundBank, "id">,
): Promise<boolean> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put({ ...rec, id: RECORD_ID });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        return true;
    } catch {
        return false;
    }
}

export async function deleteStoredSoundBank(): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(RECORD_ID);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* ignore */
    }
}
