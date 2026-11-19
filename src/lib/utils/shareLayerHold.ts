// Which simulcast layer of a screen share a viewer asks the call server for.
// Left to itself, LiveKit's server moves a viewer between a share's layers on
// every swing of its bandwidth estimate. Each switch has to wait for a
// keyframe of the new layer: measured on a viewer capped at 2 Mbps, the
// server flipped between a 5 Mbps and a 1.25 Mbps layer and the share ran at
// 6-8 fps encrypted, 13-16 plain. This puts the viewer on the low layer once
// the top one has kept struggling, and keeps it there for the rest of the
// share.
//
// There is no probe back up: from the viewer, the only way to learn whether
// the top layer fits is to receive it, and when it doesn't the picture
// freezes for seconds (measured: 2-3 s per failed probe on a 1 Mbps link).
// A new share, or watching this one again, starts on the top layer.

/** Loss on the share, per sample, that counts as a struggling second. */
export const LAYER_LOSS_BAD = 0.05;
/** Samples looked at, and how many of them must struggle, before dropping:
 *  a blip of a second or two (wifi) rides out, a link the top layer doesn't
 *  fit (steady loss) drops within three seconds. */
export const LAYER_WINDOW = 5;
export const LAYER_BAD_SAMPLES = 3;

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
    private recent: boolean[] = [];
    private lowSince = 0;

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
        if (this.layer === "low") return null;
        this.recent.push(s.stalled || s.loss >= LAYER_LOSS_BAD);
        if (this.recent.length > LAYER_WINDOW) this.recent.shift();
        if (this.recent.filter(Boolean).length < LAYER_BAD_SAMPLES) return null;
        this.layer = "low";
        this.lowSince = now;
        this.recent = [];
        return "low";
    }
}
