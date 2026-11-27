// Tiny placeholders for avatars: a 16px WebP (a couple hundred bytes) kept in
// localStorage per avatar URL, so on launch every avatar paints a blurry copy
// of itself on the first frame while the real image is fetched, then fades to
// it. Read synchronously (one parse at first use) because the point is to have
// something to draw before any async work finishes.

const KEY = "moe.crafty.matrix.avatar_tiny";
const SIZE = 16;
// Oldest dropped first. ~300 bytes each, so this stays well under 200 KB.
export const AVATAR_TINY_MAX = 500;
// A data URL longer than this is not "tiny" (an engine that ignores the WebP
// request and writes a PNG): not worth the storage.
const MAX_LEN = 900;

let map: Map<string, string> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Map<string, string> {
    if (map) return map;
    map = new Map();
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as [string, string][];
            if (Array.isArray(parsed))
                for (const [k, v] of parsed)
                    if (typeof k === "string" && typeof v === "string")
                        map.set(k, v);
        }
    } catch {
        // A bad or missing record is just an empty cache.
    }
    return map;
}

function scheduleSave(): void {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            localStorage.setItem(KEY, JSON.stringify([...load()]));
        } catch {
            // Storage full or unavailable: the cache just doesn't persist.
        }
    }, 2000);
}

/** The saved tiny copy of the avatar at `src`, as a data URL, if there is one. */
export function tinyAvatarFor(src: string | null | undefined): string | null {
    if (!src) return null;
    return load().get(src) ?? null;
}

/** Keep `dataUrl` as the tiny copy of `src`. Replaces an older one. */
export function rememberTinyAvatar(src: string, dataUrl: string): void {
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_LEN) return;
    const m = load();
    if (m.get(src) === dataUrl) return;
    m.delete(src); // newest last
    m.set(src, dataUrl);
    while (m.size > AVATAR_TINY_MAX) {
        const oldest = m.keys().next().value;
        if (oldest === undefined) break;
        m.delete(oldest);
    }
    scheduleSave();
}

/** Forget every tiny copy (tests, and a sign-out that wants no residue). */
export function clearTinyAvatars(): void {
    map = new Map();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    try {
        localStorage.removeItem(KEY);
    } catch {
        /* nothing to clear */
    }
}

/**
 * Draw a loaded image down to a tiny WebP data URL, or null where the engine
 * can't (no canvas, a tainted or undecodable image).
 */
export function tinyFromImage(img: HTMLImageElement): string | null {
    try {
        if (!img.naturalWidth || !img.naturalHeight) return null;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        // Cover-crop to a square like the avatar box does.
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(
            img,
            (img.naturalWidth - side) / 2,
            (img.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            SIZE,
            SIZE,
        );
        return canvas.toDataURL("image/webp", 0.4);
    } catch {
        return null;
    }
}
