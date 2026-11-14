/**
 * Screen-share frame sizes a GPU encoder takes. GPU encoders want even frame
 * sizes, and HEVC has no software encoder to fall back on in the browser, so
 * an odd size anywhere in the simulcast (a tab's half-size layer of 960x463)
 * leaves the encoder making nothing. Trimming each frame to a multiple of
 * SHARE_SIZE_ALIGN keeps every layer, down to the half-size one, even.
 */

/** Full size, half-size layer: a multiple of 4 keeps both even. */
export const SHARE_SIZE_ALIGN = 4;

/** The visible area to send: the frame's own, trimmed at the right and
 *  bottom to the alignment (at most 3 pixels each way). Null when it
 *  already fits or is too small to trim. */
export function alignedShareRect(
    rect: { x: number; y: number; width: number; height: number },
    align: number = SHARE_SIZE_ALIGN,
): { x: number; y: number; width: number; height: number } | null {
    const width = rect.width - (rect.width % align);
    const height = rect.height - (rect.height % align);
    if (width === rect.width && height === rect.height) return null;
    if (width === 0 || height === 0) return null;
    return { x: rect.x, y: rect.y, width, height };
}

/** Trims to try per codec before giving up on it: most GPU encoders want
 *  even sizes, some want whole 16-pixel blocks. */
export const SHARE_ALIGN_STEPS = [SHARE_SIZE_ALIGN, 16] as const;

export interface ShareEncoderStep {
    codec: string;
    /** Frame trim to send with; null when frames can't be trimmed here. */
    align: number | null;
}

/** What a screen share tries, in order, until its encoder makes frames:
 *  the codec it started on, then every other codec the GPU encodes (best
 *  first), then the software ones. Each GPU codec is tried at each trim.
 *  `ranked` is every codec everyone in the call can watch, best first;
 *  `software` the ones with a software encoder to fall back on.
 *  `allowWithoutTrim` says which codecs are safe to send untrimmed (only
 *  asked when frames can't be trimmed). */
export function shareEncoderSteps(opts: {
    first: string;
    ranked: readonly string[];
    hardware: readonly string[];
    software: readonly string[];
    canTrim: boolean;
    allowWithoutTrim: (codec: string) => boolean;
}): ShareEncoderStep[] {
    const gpu = opts.ranked.filter((c) => opts.hardware.includes(c));
    const soft = opts.ranked.filter((c) => opts.software.includes(c));
    const order = [...new Set([opts.first, ...gpu, ...soft])];
    const steps: ShareEncoderStep[] = [];
    for (const codec of order) {
        const onGpu = opts.hardware.includes(codec);
        if (opts.canTrim) {
            // Software encoders take any size: one try is enough.
            const aligns = onGpu ? SHARE_ALIGN_STEPS : [SHARE_SIZE_ALIGN];
            for (const align of aligns) steps.push({ codec, align });
        } else if (!onGpu || opts.allowWithoutTrim(codec)) {
            steps.push({ codec, align: null });
        }
    }
    return steps;
}
