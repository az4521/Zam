// Which simulcast layer of a screen share a viewer asks the call server for.
// Left to itself, LiveKit's server moves a viewer between a share's layers on
// every swing of its bandwidth estimate. Each switch has to wait for a
// keyframe of the new layer, which costs most in an encrypted call: measured
// on a viewer capped at 2 Mbps, the server flipped between a 5 Mbps and a
// 1.25 Mbps layer and the share ran at 6-8 fps encrypted, 13-16 plain. This
// holds the viewer on the low layer once the high one has struggled, and
// only tries the high one again after a hold that grows each time it fails.

/** Loss on the share, per sample, that counts as a struggling second. */
export const LAYER_LOSS_BAD = 0.05;
/** Struggling seconds in a row before dropping to the low layer. */
export const LAYER_BAD_SAMPLES = 2;
/** First hold on the low layer, and the most it grows to. */
export const LAYER_HOLD_MIN_MS = 15_000;
export const LAYER_HOLD_MAX_MS = 240_000;
/** A probe of the high layer that struggles within this long has failed. */
export const LAYER_PROBE_MS = 15_000;
/** This long fine on the high layer and the hold starts over from the min. */
export const LAYER_SETTLED_MS = 30_000;

export type ShareLayer = "high" | "low";

/** One second of a watched share, from its inbound stream. */
export interface LayerSample {
    /** Share of its packets lost in the sample (0..1). */
    loss: number;
    /** Packets arrived but nothing was decoded: the picture is stuck. */
    stalled: boolean;
}

export class ShareLayerHold {
    private layer: ShareLayer = "high";
    private bad = 0;
    private hold = LAYER_HOLD_MIN_MS;
    private holdUntil = 0;
    private lowSince = 0;
    /** When the current stay on the high layer began (a probe, or the start). */
    private highSince: number;

    constructor(now: number) {
        this.highSince = now;
    }

    /** The layer the viewer should ask for now. */
    current(): ShareLayer {
        return this.layer;
    }

    /** Whether the viewer is holding itself on the low layer. */
    holdingLow(): boolean {
        return this.layer === "low";
    }

    /** How long the viewer has been on the low layer (0 when it isn't). A
     *  sample taken just after the drop still describes the top layer. */
    heldLowFor(now: number): number {
        return this.layer === "low" ? now - this.lowSince : 0;
    }

    /** Feed one sample; returns the layer to ask for if it changed. */
    sample(s: LayerSample, now: number): ShareLayer | null {
        const struggling = s.stalled || s.loss >= LAYER_LOSS_BAD;
        if (this.layer === "low") {
            // Only probe from a healthy low layer: if even it struggles, the
            // top one certainly won't fit (the sharer's cap is still working
            // the low layer down).
            if (now < this.holdUntil || struggling) return null;
            this.layer = "high";
            this.highSince = now;
            this.bad = 0;
            return "high";
        }
        // On the high layer.
        if (!struggling) {
            this.bad = 0;
            if (now - this.highSince >= LAYER_SETTLED_MS)
                this.hold = LAYER_HOLD_MIN_MS;
            return null;
        }
        if (++this.bad < LAYER_BAD_SAMPLES) return null;
        // A probe that struggled straight away failed: hold longer next time.
        const probeFailed = now - this.highSince < LAYER_PROBE_MS;
        if (probeFailed && this.holdUntil > 0)
            this.hold = Math.min(LAYER_HOLD_MAX_MS, this.hold * 2);
        this.layer = "low";
        this.lowSince = now;
        this.holdUntil = now + this.hold;
        this.bad = 0;
        return "low";
    }
}
