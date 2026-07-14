/**
 * Speaker test: a short two-note tone routed to an explicit output device.
 * Oscillator → MediaStreamDestination → <audio> with setSinkId — the
 * portable path (AudioContext.setSinkId is Chromium-only).
 */

export async function playSpeakerTestTone(
    sinkId: string | null,
): Promise<void> {
    if (typeof AudioContext === "undefined") return;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    gain.connect(dest);
    for (const [i, freq] of [523.25, 659.25].entries()) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.2);
    }
    const el = new Audio();
    el.srcObject = dest.stream;
    const sinkEl = el as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
    };
    if (sinkId && sinkEl.setSinkId)
        await sinkEl.setSinkId(sinkId).catch(() => {});
    await el.play().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 700));
    el.pause();
    el.srcObject = null;
    await ctx.close().catch(() => {});
}
