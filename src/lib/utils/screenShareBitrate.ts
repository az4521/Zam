/** Screen-share bitrate, picked by the user independently of resolution and
 *  frame rate. The slider runs from roughly what YouTube asks for at 240p up
 *  to MAX_SCREEN_SHARE_BITRATE, on a log scale so the low end isn't squeezed
 *  into the first pixel. Up to SAFE_SCREEN_SHARE_BITRATE the pick is held
 *  10% under the measured upload (WebRTC's own estimate, see
 *  stores/uploadEstimate.svelte): the measurement can only lower it, never
 *  raise it past SAFE. A pick above SAFE is the user's own call and is sent
 *  as picked (the UI warns about it). */

/** YouTube's lowest recommended bitrate for 240p. */
export const MIN_SCREEN_SHARE_BITRATE = 300_000;
/** The most a share sends unless the user picks more by hand. Element Call
 *  sends screen shares at 5 Mbps; past this, viewers on ordinary links and
 *  devices mostly get stutter. */
export const SAFE_SCREEN_SHARE_BITRATE = 8_000_000;
/** The top of the slider. */
export const MAX_SCREEN_SHARE_BITRATE = 50_000_000;
/** Before anything has been measured. */
export const UNMEASURED_CEILING = SAFE_SCREEN_SHARE_BITRATE;
export const DEFAULT_SCREEN_SHARE_BITRATE = SAFE_SCREEN_SHARE_BITRATE;
/** Slider positions; the value is mapped onto the bitrate range. */
export const BITRATE_SLIDER_STEPS = 1000;

/** The automatic limit on a pick of SAFE or less: 10% under the measured
 *  upload, or UNMEASURED_CEILING with no measurement, never above SAFE. A
 *  number the user typed in (`overridden`) is taken as it is: they know
 *  their line better than the estimate does. Never below the minimum. */
export function bitrateCeiling(
    measuredBps: number | null,
    overridden = false,
): number {
    if (measuredBps === null || !(measuredBps > 0)) return UNMEASURED_CEILING;
    return Math.min(
        SAFE_SCREEN_SHARE_BITRATE,
        Math.max(
            MIN_SCREEN_SHARE_BITRATE,
            Math.floor(measuredBps * (overridden ? 1 : 0.9)),
        ),
    );
}

/** A pick above SAFE: a manual choice, sent as picked. */
export function isHighBitrate(bps: number): boolean {
    return Number.isFinite(bps) && bps > SAFE_SCREEN_SHARE_BITRATE;
}

/** What a pick sends at: above SAFE as picked (up to the slider's top),
 *  else held under the automatic limit (`ceiling`, from bitrateCeiling). */
export function effectiveBitrate(pick: number, ceiling: number): number {
    if (isHighBitrate(pick)) return Math.min(pick, MAX_SCREEN_SHARE_BITRATE);
    return clampBitrate(pick, Math.min(ceiling, SAFE_SCREEN_SHARE_BITRATE));
}

/** A stored or picked bitrate, kept inside [minimum, ceiling]. */
export function clampBitrate(bps: number, ceiling: number): number {
    if (!Number.isFinite(bps))
        return Math.min(DEFAULT_SCREEN_SHARE_BITRATE, ceiling);
    return Math.min(ceiling, Math.max(MIN_SCREEN_SHARE_BITRATE, bps));
}

/** Rounds to steps that read well: 10 kbps under 1 Mbps, 100 kbps under
 *  10 Mbps, 500 kbps above. */
export function roundBitrate(bps: number): number {
    const step =
        bps < 1_000_000 ? 10_000 : bps < 10_000_000 ? 100_000 : 500_000;
    return Math.round(bps / step) * step;
}

export function bitrateFromSlider(position: number, ceiling: number): number {
    if (ceiling <= MIN_SCREEN_SHARE_BITRATE) return MIN_SCREEN_SHARE_BITRATE;
    const p = Math.min(1, Math.max(0, position / BITRATE_SLIDER_STEPS));
    const bps =
        MIN_SCREEN_SHARE_BITRATE * (ceiling / MIN_SCREEN_SHARE_BITRATE) ** p;
    // The ends are exact, so the top of the slider is the ceiling itself.
    if (p === 1) return ceiling;
    if (p === 0) return MIN_SCREEN_SHARE_BITRATE;
    return clampBitrate(roundBitrate(bps), ceiling);
}

export function sliderFromBitrate(bps: number, ceiling: number): number {
    if (ceiling <= MIN_SCREEN_SHARE_BITRATE) return BITRATE_SLIDER_STEPS;
    const clamped = clampBitrate(bps, ceiling);
    const p =
        Math.log(clamped / MIN_SCREEN_SHARE_BITRATE) /
        Math.log(ceiling / MIN_SCREEN_SHARE_BITRATE);
    return Math.round(p * BITRATE_SLIDER_STEPS);
}

/** "750 kbps" or "4.5 Mbps" parts, for t(). */
export function bitrateParts(bps: number): {
    unit: "kbps" | "mbps";
    n: string;
} {
    if (bps < 1_000_000) {
        return { unit: "kbps", n: String(Math.round(bps / 1000)) };
    }
    const mbps = bps / 1_000_000;
    return {
        unit: "mbps",
        n: new Intl.NumberFormat(undefined, {
            maximumFractionDigits: mbps < 10 ? 1 : 0,
        }).format(mbps),
    };
}
