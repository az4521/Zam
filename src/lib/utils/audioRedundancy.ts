// When the mic is sent with RED (a copy of the previous Opus frame in every
// packet, about double the audio bitrate). It is a waste on a clean link, so
// it comes on only while the far end reports loss, and goes off again once
// the link has been quiet for a while. Turning it on or off republishes the
// track, so the thresholds have a wide gap and a minimum on-time.

/** Mean loss over the last ON_SAMPLES samples that turns RED on, provided
 *  at least two of them show some loss: one bad report is not a lossy link. */
export const RED_ON_LOSS = 0.02;
export const RED_ON_SOME_LOSS = 0.01;
export const RED_ON_SAMPLES = 3;
/** Every one of the last OFF_SAMPLES samples must be under this to turn off. */
export const RED_OFF_LOSS = 0.005;
export const RED_OFF_SAMPLES = 10;
/** Mean loss over the last ON_SAMPLES samples above which two earlier frames
 *  are sent instead of one (encrypted calls). */
export const RED_HIGH_LOSS = 0.08;
/** RED stays on at least this long after it came on. */
export const RED_MIN_ON_MS = 60_000;

export class RedundancyController {
    private samples: number[] = [];
    private onSince = 0;
    on = false;

    /** Take back a change `push` returned that could not be carried out, so
     *  the next sample reaches the same decision again. */
    undo(change: boolean): void {
        this.on = !change;
    }

    /** How many earlier frames to carry per packet: 0 while off, 1 on a
     *  lossy link, 2 on a very lossy one. */
    depth(): 0 | 1 | 2 {
        if (!this.on) return 0;
        const recent = this.samples.slice(-RED_ON_SAMPLES);
        const mean = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
        return mean >= RED_HIGH_LOSS ? 2 : 1;
    }

    /**
     * Feed one outgoing-loss sample (a 0..1 fraction, null when the stats
     * had none yet). Returns the new state when it changed, else null.
     */
    push(loss: number | null, now: number): boolean | null {
        if (loss === null || !Number.isFinite(loss)) return null;
        this.samples.push(loss);
        if (this.samples.length > RED_OFF_SAMPLES) this.samples.shift();
        if (!this.on) {
            const recent = this.samples.slice(-RED_ON_SAMPLES);
            if (recent.length < RED_ON_SAMPLES) return null;
            const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
            if (mean < RED_ON_LOSS) return null;
            if (recent.filter((s) => s >= RED_ON_SOME_LOSS).length < 2)
                return null;
            this.on = true;
            this.onSince = now;
            return true;
        }
        if (now - this.onSince < RED_MIN_ON_MS) return null;
        if (this.samples.length < RED_OFF_SAMPLES) return null;
        if (this.samples.some((s) => s >= RED_OFF_LOSS)) return null;
        this.on = false;
        return false;
    }
}
