/**
 * Mic level meter + loopback for the settings tab. Owns its own gUM stream
 * (independent of any live call) so the tab can test the mic without joining.
 */

import {
    buildDeviceConstraint,
    isOverconstrainedError,
} from "$lib/utils/audioDevices";

export interface MicMeterOptions {
    deviceId: string | null;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    onLevel: (rms: number) => void;
}

export interface MicMeterHandle {
    stop(): void;
    /** Route the mic to an output while on ("Test mic"). */
    setLoopback(on: boolean, sinkId: string | null): Promise<void>;
}

export async function startMicMeter(
    opts: MicMeterOptions,
): Promise<MicMeterHandle> {
    const audioBase: MediaTrackConstraints = {
        noiseSuppression: opts.noiseSuppression,
        echoCancellation: opts.echoCancellation,
        autoGainControl: opts.autoGainControl,
    };
    // `exact` (via buildDeviceConstraint), not `ideal`: `ideal` is a soft hint
    // the browser ignored, so the meter watched the DEFAULT mic no matter which
    // device was selected — reading as both "wrong device" and "laggy" (weak
    // reverberant bleed off the default mic).
    const wanted = buildDeviceConstraint(opts.deviceId);
    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: wanted ? { ...audioBase, deviceId: wanted } : audioBase,
        });
    } catch (e) {
        // `exact` rejects with OverconstrainedError when the chosen mic vanished
        // (unplugged mid-session). Retry once on the default mic so the meter
        // keeps working; any other error (permission denied) propagates so the
        // caller can surface it.
        if (wanted && isOverconstrainedError(e)) {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: audioBase,
            });
        } else {
            throw e;
        }
    }
    // `new AudioContext()` and the graph wiring can throw — browsers cap how
    // many contexts a document may hold, and this app builds several. Without
    // this the granted stream would stay live with its only handle never
    // constructed: a microphone nothing in the page can reach.
    let ctx: AudioContext;
    let analyser: AnalyserNode;
    try {
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        // Keep the analyser un-smoothed. NOTE: this meter reads the time-domain
        // waveform (getByteTimeDomainData), which smoothingTimeConstant does NOT
        // affect — it only smooths the frequency-domain reads — so this is a
        // no-op for the current meter, kept defensively for any future switch to
        // getByteFrequencyData. The real responsiveness fix is the exact-device
        // constraint above (the meter now watches the mic you actually chose).
        analyser.smoothingTimeConstant = 0;
        source.connect(analyser);
    } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
    }
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
        // Speech RMS is small; ×4 puts normal speech mid-meter.
        opts.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let loopEl: HTMLAudioElement | null = null;
    const stopLoopback = () => {
        if (!loopEl) return;
        loopEl.pause();
        loopEl.srcObject = null;
        loopEl = null;
    };
    return {
        stop() {
            stopped = true;
            cancelAnimationFrame(raf);
            stopLoopback();
            stream.getTracks().forEach((t) => t.stop());
            void ctx.close().catch(() => {});
        },
        async setLoopback(on, sinkId) {
            if (!on) {
                stopLoopback();
                return;
            }
            if (!loopEl) {
                loopEl = new Audio();
                loopEl.srcObject = stream;
            }
            const el = loopEl as HTMLAudioElement & {
                setSinkId?: (id: string) => Promise<void>;
            };
            if (sinkId && el.setSinkId)
                await el.setSinkId(sinkId).catch(() => {});
            await loopEl.play().catch(() => {});
        },
    };
}
