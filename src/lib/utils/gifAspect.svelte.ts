/**
 * Aspect ratios learned from favourite-GIF previews as they load.
 *
 * KLIPY results carry width/height, so the normal picker can reserve each
 * tile's box before the image arrives. Favourites saved without dimensions
 * (older entries, or ones starred from a message or link preview) have no such
 * hint, so their tiles collapsed to nothing until the bytes landed. The first
 * load of such a preview records its natural size here, keyed by preview URL,
 * and every later render reserves the right box up front.
 */
import { safeAspectRatio } from "$lib/utils/mediaDimensions";

const STORAGE_KEY = "moe.crafty.matrix.gif_aspect";
// Newest wins; plenty for a favourites list without growing unbounded.
const MAX_ENTRIES = 500;

function load(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object") {
            const out: Record<string, string> = {};
            for (const [url, ratio] of Object.entries(parsed)) {
                // Re-validate: storage is not trusted to hold only ratios.
                const m = /^(\d+) \/ (\d+)$/.exec(String(ratio));
                if (m) out[url] = safeAspectRatio(m[1], m[2], "");
            }
            return out;
        }
    } catch {
        /* storage unavailable or corrupt: start empty */
    }
    return {};
}

const learned = $state<Record<string, string>>(load());

function save() {
    try {
        const entries = Object.entries(learned);
        const kept = entries.slice(-MAX_ENTRIES);
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(Object.fromEntries(kept)),
        );
    } catch {
        /* best effort */
    }
}

/** Remember the natural size of a loaded preview. */
export function learnGifAspect(
    previewUrl: string,
    width: number,
    height: number,
): void {
    const ratio = safeAspectRatio(width, height, "");
    if (!ratio || learned[previewUrl] === ratio) return;
    learned[previewUrl] = ratio;
    save();
}

/**
 * `aspect-ratio` style for a favourite's tile: its stored dimensions, else
 * what an earlier load taught us, else a square so the tile still holds space
 * (and shows its placeholder colour) while the first load is in flight.
 */
export function favouriteAspectStyle(gif: {
    previewUrl: string;
    width?: unknown;
    height?: unknown;
}): string {
    const stored = safeAspectRatio(gif.width, gif.height, "");
    return `aspect-ratio: ${stored || learned[gif.previewUrl] || "1 / 1"}`;
}
