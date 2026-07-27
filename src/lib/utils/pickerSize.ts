// Persisted size for the composer pickers (Emoji / Sticker / GIF).
//
// The three pickers used to persist their own width/height, so switching
// tabs on desktop snapped the popover between three sizes. They now share
// ONE key. Sizes stored under the old per-picker keys are migrated on first
// read (largest of each dimension) so nobody's stored size is silently lost.

export interface PickerSizeOpts {
    /** localStorage prefix, e.g. "composerPicker" -> "composerPicker:w"/":h". */
    storageKey: string;
    /** Older per-picker prefixes to migrate from when the shared key is unset. */
    legacyKeys?: readonly string[];
    defaultW: number;
    defaultH: number;
}

/** Reads one stored dimension; returns null when absent or not a positive number. */
export type SizeReader = (key: string) => number | null;

function resolveDimension(
    read: SizeReader,
    suffix: "w" | "h",
    opts: PickerSizeOpts,
    fallback: number,
): number {
    const shared = read(`${opts.storageKey}:${suffix}`);
    if (shared !== null) return shared;
    let best: number | null = null;
    for (const key of opts.legacyKeys ?? []) {
        const legacy = read(`${key}:${suffix}`);
        if (legacy !== null && (best === null || legacy > best)) best = legacy;
    }
    return best ?? fallback;
}

export function resolvePickerSize(
    read: SizeReader,
    opts: PickerSizeOpts,
): { w: number; h: number } {
    return {
        w: resolveDimension(read, "w", opts, opts.defaultW),
        h: resolveDimension(read, "h", opts, opts.defaultH),
    };
}

/**
 * The single config every composer picker passes to `resizeHandle`.
 * Default = the largest of the three former defaults (the GIF picker's), so
 * no picker is smaller than it was before the keys were unified.
 */
export const COMPOSER_PICKER_SIZE = {
    storageKey: "composerPicker",
    legacyKeys: ["emojiPicker", "stickerPicker", "gifPicker"],
    defaultW: 416,
    defaultH: 480,
} as const satisfies PickerSizeOpts;
