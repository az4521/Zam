/** Screen-share bitrate, picked by the user independently of resolution and
 *  frame rate. The slider runs from roughly what YouTube asks for at 240p up
 *  to 10% under the measured upload bandwidth (WebRTC's own estimate, see
 *  stores/uploadEstimate.svelte). On a log scale, so the low end isn't
 *  squeezed into the first pixel. */

/** YouTube's lowest recommended bitrate for 240p. */
export const MIN_SCREEN_SHARE_BITRATE = 300_000;
/** Before anything has been measured. */
export const UNMEASURED_CEILING = 10_000_000;
export const DEFAULT_SCREEN_SHARE_BITRATE = 4_000_000;
/** Slider positions; the value is mapped onto the bitrate range. */
export const BITRATE_SLIDER_STEPS = 1000;

/** The most the slider offers: 10% under the measured upload, or
 *  UNMEASURED_CEILING with no measurement. Never below the minimum. */
export function bitrateCeiling(measuredBps: number | null): number {
    if (measuredBps === null || !(measuredBps > 0)) return UNMEASURED_CEILING;
    return Math.max(MIN_SCREEN_SHARE_BITRATE, Math.floor(measuredBps * 0.9));
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
