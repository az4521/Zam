/** Screen-share bitrate. By default (AUTO_SCREEN_SHARE_BITRATE) a share has
 *  no ceiling of its own: it sends what the uplink carries right now, as
 *  WebRTC's congestion control finds it (and, for the helpers that encode
 *  outside WebRTC, as utils/uplinkTracker follows it). The user may instead
 *  pick a cap on a log-scale slider from roughly what YouTube asks for at
 *  240p up to MAX_SCREEN_SHARE_BITRATE; a pick is sent as picked.
 *
 *  There used to be an 8 Mbps "safe" ceiling and an automatic limit at 90%
 *  of the highest upload ever measured on the device. That measurement could
 *  only see what the share itself pushed (WebRTC's estimate stays within
 *  ~1.5x what is sent while the sender is the limit), so the limit fed on
 *  itself and pinned shares far under the line's speed. */

/** "Automatic": no cap, follow the uplink. */
export const AUTO_SCREEN_SHARE_BITRATE = 0;
/** YouTube's lowest recommended bitrate for 240p. */
export const MIN_SCREEN_SHARE_BITRATE = 300_000;
/** The top of the slider. */
export const MAX_SCREEN_SHARE_BITRATE = 50_000_000;
export const DEFAULT_SCREEN_SHARE_BITRATE = AUTO_SCREEN_SHARE_BITRATE;
/** What a share's encoder may use in automatic mode. Not a practical limit:
 *  it has to be set, because WebRTC's own default for an encoding without a
 *  maxBitrate is a low per-resolution table (5 Mbps for a 1080p simulcast
 *  layer), and congestion control holds the real rate under the uplink. */
export const SHARE_AUTO_MAX_BPS = 100_000_000;
/** The bitrate an automatic share is published at. LiveKit hints WebRTC's
 *  estimator to start at 90% of the publish maxBitrate, so publishing at
 *  SHARE_AUTO_MAX_BPS would open with a 90 Mbps burst. The top layer is
 *  raised to SHARE_AUTO_MAX_BPS right after publishing, and the estimator
 *  probes its way up from here. */
export const SHARE_AUTO_START_BPS = 8_000_000;
/** Slider positions; the value is mapped onto the bitrate range. */
export const BITRATE_SLIDER_STEPS = 1000;

/** Whether a stored pick means automatic. */
export function isAutoBitrate(pick: number): boolean {
    return !Number.isFinite(pick) || pick <= 0;
}

/** The cap a share's encoder gets: the user's pick as picked, or in
 *  automatic mode the upload speed the user typed in (`override`), else
 *  none in practice (SHARE_AUTO_MAX_BPS). */
export function shareBitrateCap(pick: number, override: number | null): number {
    if (!isAutoBitrate(pick))
        return Math.min(
            MAX_SCREEN_SHARE_BITRATE,
            Math.max(MIN_SCREEN_SHARE_BITRATE, pick),
        );
    if (override !== null && override > 0)
        return Math.max(MIN_SCREEN_SHARE_BITRATE, Math.round(override));
    return SHARE_AUTO_MAX_BPS;
}

/** The bitrate a share is published at: its cap, or SHARE_AUTO_START_BPS
 *  when the cap is higher (see there). */
export function shareStartBitrate(cap: number): number {
    return Math.min(cap, SHARE_AUTO_START_BPS);
}

/** A stored or picked bitrate, kept inside [minimum, ceiling]. */
export function clampBitrate(bps: number, ceiling: number): number {
    if (!Number.isFinite(bps) || bps <= 0) return ceiling;
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
