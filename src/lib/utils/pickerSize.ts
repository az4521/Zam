// Persisted size for the composer pickers (Emoji / Sticker / GIF).
//
// The three pickers used to persist their own width/height, so switching
// tabs on desktop snapped the popover between three sizes. They now share
// ONE key. Sizes stored under the old per-picker keys are migrated on first
// read (largest of each dimension) so nobody's stored size is silently lost.

export interface LegacyPickerSize {
    /** localStorage prefix the picker used before the keys were unified. */
    key: string;
    /** That picker's former default, used when the user never resized it. */
    defaultW: number;
    defaultH: number;
}

export interface PickerSizeOpts {
    /** localStorage prefix, e.g. "composerPicker" -> "composerPicker:w"/":h". */
    storageKey: string;
    /** Older per-picker prefixes to migrate from when the shared key is unset. */
    legacyKeys?: readonly LegacyPickerSize[];
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
    const legacy = (opts.legacyKeys ?? []).map((entry) => ({
        stored: read(`${entry.key}:${suffix}`),
        former: suffix === "w" ? entry.defaultW : entry.defaultH,
    }));
    // Nothing to migrate: no old picker was ever resized in this dimension, so
    // the shared default decides. Checking for a STORED value (not just for
    // configured legacy keys) is what keeps `opts.defaultW`/`defaultH` live —
    // every entry contributes a former default, so a max over them would always
    // produce a number and the shared default could never be reached.
    if (!legacy.some((entry) => entry.stored !== null)) return fallback;
    // Migration: compare every old picker at its EFFECTIVE size — the stored
    // value if the user resized it, otherwise that picker's own former default
    // — and take the largest. Ignoring the untouched pickers' defaults would
    // let one shrunken picker drag the others below the size they mount at
    // today; flooring at the shared default would instead override a user who
    // deliberately shrank all three.
    return Math.max(...legacy.map((entry) => entry.stored ?? entry.former));
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
    legacyKeys: [
        { key: "emojiPicker", defaultW: 340, defaultH: 440 },
        { key: "stickerPicker", defaultW: 340, defaultH: 440 },
        { key: "gifPicker", defaultW: 416, defaultH: 480 },
    ],
    defaultW: 416,
    defaultH: 480,
} as const satisfies PickerSizeOpts;
