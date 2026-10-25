/**
 * The desktop app's per-application screen-share audio (electron/appAudio.cjs)
 * as a MediaStreamTrack, ready to publish as the share's audio:
 *  - "pcm" (Windows): float32 stereo 48 kHz PCM on a MessagePort, played by
 *    pcmStream.worklet.js into a MediaStreamAudioDestinationNode.
 *  - "device" (Linux): a PipeWire virtual microphone, opened with
 *    getUserMedia and none of the voice processing a mic gets.
 */
// no-inline: a data: URL worklet module could be refused by a CSP.
import pcmStreamUrl from "./pcmStream.worklet.js?url&no-inline";
import type { ShareAudioResult } from "$lib/desktopScreenShare";

export const SHARE_AUDIO_SAMPLE_RATE = 48000;

export interface ShareAudioTrack {
    track: MediaStreamTrack;
    /** Stop the track and release what feeds it. Safe to call twice. */
    close(): void;
}

async function fromPcmPort(port: MessagePort): Promise<ShareAudioTrack> {
    const ctx = new AudioContext({
        sampleRate: SHARE_AUDIO_SAMPLE_RATE,
        latencyHint: "interactive",
    });
    try {
        await ctx.audioWorklet.addModule(pcmStreamUrl);
        const node = new AudioWorkletNode(ctx, "zam-pcm-stream", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
        });
        const dest = ctx.createMediaStreamDestination();
        dest.channelCount = 2;
        node.connect(dest);
        // The PCM goes straight to the audio thread from here.
        node.port.postMessage({ port }, [port]);
        // Started from a picker click a moment ago, but not necessarily
        // within the user activation window.
        await ctx.resume().catch(() => {});
        const track = dest.stream.getAudioTracks()[0];
        let closed = false;
        return {
            track,
            close() {
                if (closed) return;
                closed = true;
                track.stop();
                node.disconnect();
                void ctx.close().catch(() => {});
            },
        };
    } catch (err) {
        port.close();
        void ctx.close().catch(() => {});
        throw err;
    }
}

async function fromDevice(label: string): Promise<ShareAudioTrack | null> {
    // The virtual microphone appears a moment after venmic creates it.
    let deviceId: string | undefined;
    for (let attempt = 0; attempt < 10 && !deviceId; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 200));
        const devices = await navigator.mediaDevices.enumerateDevices();
        deviceId = devices.find(
            (d) => d.kind === "audioinput" && d.label === label,
        )?.deviceId;
    }
    if (!deviceId) return null;
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
            sampleRate: SHARE_AUDIO_SAMPLE_RATE,
        },
    });
    const track = stream.getAudioTracks()[0];
    return {
        track,
        close() {
            track.stop();
        },
    };
}

/** The track for a share's audio, or null when there is none to publish. */
export async function openShareAudioTrack(
    audio: ShareAudioResult,
): Promise<ShareAudioTrack | null> {
    if (audio.kind === "pcm" && audio.port) return fromPcmPort(audio.port);
    if (audio.kind === "device" && audio.label) return fromDevice(audio.label);
    return null;
}
