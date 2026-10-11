/**
 * Zam's microphone leveller: a LiveKit audio processor that evens out the
 * user's own voice before it is sent, in place of the browser's WebRTC AGC.
 *
 * Unlike that AGC it is digital only (it never moves the OS microphone
 * volume), it holds its gain through pauses instead of pumping room noise up
 * between sentences, and it turns down fast but up slowly. Same loudness
 * maths as incoming-voice normalization ($lib/audio/voiceNormalization).
 *
 * Graph: mic track -> gain -> soft clipper -> MediaStreamDestination, whose
 * track LiveKit sends instead of the raw one. An analyser taps the raw signal.
 */
import type {
    AudioProcessorOptions,
    Track,
    TrackProcessor,
} from "livekit-client";
import {
    rmsDb,
    nextSpeechLevel,
    normalizationGain,
    gainTimeConstant,
} from "./voiceNormalization";
import { createSoftClipper } from "./softClip";

const TICK_MS = 50;
/** How long to wait for a suspended context before sending the raw mic. */
const RESUME_WAIT_MS = 300;

export type MicLeveller = TrackProcessor<
    Track.Kind.Audio,
    AudioProcessorOptions
>;

export function createMicLeveller(): MicLeveller {
    let teardown: (() => void) | null = null;

    const build = async ({
        track,
        audioContext: ctx,
    }: AudioProcessorOptions): Promise<void> => {
        teardown?.();
        teardown = null;
        leveller.processedTrack = undefined;
        if (ctx.state !== "running") {
            await Promise.race([
                ctx.resume().catch(() => {}),
                new Promise((r) => setTimeout(r, RESUME_WAIT_MS)),
            ]);
        }
        // A context that will not run would send silence. Leaving
        // processedTrack unset makes LiveKit send the raw mic instead.
        if (ctx.state !== "running") return;

        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        const gain = ctx.createGain();
        const clipper = createSoftClipper(ctx);
        const dest = ctx.createMediaStreamDestination();
        source.connect(analyser);
        source.connect(gain);
        gain.connect(clipper.input);
        clipper.output.connect(dest);

        const buf = new Float32Array(analyser.fftSize);
        let level: number | null = null;
        const timer = setInterval(() => {
            analyser.getFloatTimeDomainData(buf);
            level = nextSpeechLevel(level, rmsDb(buf));
            const target = normalizationGain(level);
            if (target === null) return;
            const current = gain.gain.value;
            gain.gain.setTargetAtTime(
                target,
                ctx.currentTime,
                gainTimeConstant(current, target),
            );
        }, TICK_MS);

        const processed = dest.stream.getAudioTracks()[0];
        leveller.processedTrack = processed;
        teardown = () => {
            clearInterval(timer);
            source.disconnect();
            gain.disconnect();
            clipper.output.disconnect();
            processed.stop();
        };
    };

    const leveller: MicLeveller = {
        name: "zam-mic-leveller",
        processedTrack: undefined,
        init: build,
        restart: build,
        async destroy() {
            teardown?.();
            teardown = null;
            leveller.processedTrack = undefined;
        },
    };
    return leveller;
}
