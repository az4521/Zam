// Device-local preferences for the Flash (Ruffle) embed: the volume the user
// last set and the viewport size they last dragged to, so the next embed opens
// the same way. The sandboxed player has an opaque origin and cannot reach
// localStorage, so FlashEmbed.svelte does every read and write and relays the
// volume over its port. Every value is validated on read: a corrupt or
// out-of-range entry is treated as unset.

const VOLUME_KEY = "settings:flashVolume";
const SIZE_KEY = "settings:flashSize";

export interface FlashSize {
    w: number;
    h: number;
}

function isVolume(v: unknown): v is number {
    return typeof v === "number" && v >= 0 && v <= 1;
}

function isDimension(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export function readSavedFlashVolume(): number | null {
    try {
        const parsed: unknown = JSON.parse(
            localStorage.getItem(VOLUME_KEY) ?? "null",
        );
        return isVolume(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeSavedFlashVolume(volume: unknown): void {
    if (!isVolume(volume)) return;
    try {
        localStorage.setItem(VOLUME_KEY, JSON.stringify(volume));
    } catch {
        // ignore (private mode / storage full)
    }
}

export function readSavedFlashSize(): FlashSize | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "null");
        const w: unknown = parsed?.w;
        const h: unknown = parsed?.h;
        if (!isDimension(w) || !isDimension(h)) return null;
        return { w, h };
    } catch {
        return null;
    }
}

export function writeSavedFlashSize(size: FlashSize): void {
    if (!isDimension(size.w) || !isDimension(size.h)) return;
    try {
        localStorage.setItem(
            SIZE_KEY,
            JSON.stringify({ w: size.w, h: size.h }),
        );
    } catch {
        // ignore (private mode / storage full)
    }
}

export function clearSavedFlashSize(): void {
    try {
        localStorage.removeItem(SIZE_KEY);
    } catch {
        // ignore (private mode / storage full)
    }
}
