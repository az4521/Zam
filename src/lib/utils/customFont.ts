/**
 * Custom message font — pure validation + device-local IndexedDB storage +
 * FontFace registration for the single custom-font slot.
 *
 * `validateCustomFontFile` is pure (unit-tested). IndexedDB I/O and
 * FontFace/`document.fonts` calls are live-verified only — `indexedDB`,
 * `document`, and `FontFace` are referenced ONLY inside function bodies so the
 * module import is safe in jsdom and SSR.
 *
 * We register from an ArrayBuffer via the FontFace binary constructor, which
 * performs NO URL fetch, so the prod CSP `font-src` never applies (a blob:/url
 * @font-face would — we deliberately avoid it).
 */
import { CUSTOM_FONT_FAMILY } from "./messageDisplay";

export const CUSTOM_FONT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = ["woff2", "ttf", "otf"] as const;
const MAX_NAME_LEN = 60;

export type FontValidationResult =
    | { ok: true; ext: string; displayName: string }
    | { ok: false; reason: string };

/** Pure: validate an uploaded font file's name + size for the custom slot. */
export function validateCustomFontFile(file: {
    name: string;
    size: number;
}): FontValidationResult {
    const ext = extensionOf(file.name);
    if (!ext || !(ALLOWED_EXTS as readonly string[]).includes(ext)) {
        return { ok: false, reason: "Use a .woff2, .ttf, or .otf font file." };
    }
    if (file.size <= 0) {
        return { ok: false, reason: "That font file is empty." };
    }
    if (file.size > CUSTOM_FONT_MAX_BYTES) {
        return { ok: false, reason: "Font file is too large (max 10 MB)." };
    }
    return { ok: true, ext, displayName: displayNameOf(file.name) };
}

function extensionOf(name: string): string | null {
    const base = name.split(/[\\/]/).pop() ?? name;
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) return null;
    return base.slice(dot + 1).toLowerCase();
}

function displayNameOf(name: string): string {
    const base = name.split(/[\\/]/).pop() ?? name;
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const trimmed = stem.trim();
    const safe = trimmed.length > 0 ? trimmed : "Custom font";
    return safe.length > MAX_NAME_LEN ? safe.slice(0, MAX_NAME_LEN) : safe;
}

// ---- IndexedDB (single record, id "custom"). Live-verified only. ----

export interface StoredCustomFont {
    id: "custom";
    name: string;
    ext: string;
    data: ArrayBuffer;
    storedAt: number;
}

const DB_NAME = "zam-fonts";
const STORE = "fonts";
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

export async function getStoredFont(): Promise<StoredCustomFont | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly");
            const r = tx.objectStore(STORE).get(RECORD_ID);
            r.onsuccess = () => resolve((r.result as StoredCustomFont) ?? null);
            r.onerror = () => reject(r.error);
        });
    } catch {
        return null;
    }
}

export async function putStoredFont(rec: StoredCustomFont): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(rec);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        /* best-effort */
    }
}

export async function deleteStoredFont(): Promise<void> {
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

// ---- FontFace registration. Live-verified only, DOM-guarded. ----

function fontSet(): FontFaceSet | null {
    if (typeof document === "undefined") return null;
    const set = (document as unknown as { fonts?: FontFaceSet }).fonts;
    return set ?? null;
}

/** Remove any previously-registered custom FontFace so re-upload replaces. */
export function unregisterCustomFontFace(): void {
    const set = fontSet();
    if (!set) return;
    const stale: FontFace[] = [];
    set.forEach((face) => {
        if (face.family === CUSTOM_FONT_FAMILY) stale.push(face);
    });
    for (const face of stale) set.delete(face);
}

/** Register the font binary as a FontFace. Returns false for a corrupt/invalid
 *  buffer or a non-DOM environment — the caller then falls back / deselects. */
export async function registerCustomFontFace(
    data: ArrayBuffer,
): Promise<boolean> {
    const set = fontSet();
    if (!set) return false;
    try {
        unregisterCustomFontFace();
        const face = new FontFace(CUSTOM_FONT_FAMILY, data);
        await face.load();
        set.add(face);
        return true;
    } catch {
        return false;
    }
}
