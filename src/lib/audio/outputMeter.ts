/**
 * Incoming-audio level meter over the live call's remote streams. Taps via
 * createMediaStreamSource — analysing never affects element playback.
 */

/**
 * Identity of a set of remote streams, order-independent. The meter keys on
 * this instead of the voice tick, which bumps on every mute and membership
 * change and would rebuild the AudioContext each time (audit IMP-2).
 */
export function streamSetKey(streams: readonly { id: string }[]): string {
    if (streams.length === 0) return "";
    return JSON.stringify(streams.map((s) => s.id).sort());
}

export function startOutputMeter(
    streams: MediaStream[],
    onLevel: (rms: number) => void,
): () => void {
    if (typeof AudioContext === "undefined" || streams.length === 0)
        return () => {};
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    for (const s of streams) ctx.createMediaStreamSource(s).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let stopped = false;
    const tick = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
            const c = (v - 128) / 128;
            sum += c * c;
        }
        onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
        stopped = true;
        cancelAnimationFrame(raf);
        void ctx.close().catch(() => {});
    };
}
