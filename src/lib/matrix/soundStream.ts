/**
 * Play a soundboard clip while it downloads. The file goes through the same
 * authenticated, remuxing MediaSource pipeline as chat video and audio
 * (videoStream.ts: MP3, MP4/AAC, WebM and Matroska as they are, FLAC re-boxed
 * on the fly), into a hidden <audio> element that is routed through the call
 * audio graph, so the listener's per-user soundboard level, the limiter and
 * the output device all apply. A format that pipeline cannot stream (Ogg,
 * WAV) is downloaded whole first and then played, as it always was.
 *
 * The bytes are handed back when the download completes, for the caller to
 * cache and play from then on.
 */
import type { CallAudioGraph } from "$lib/audio/callAudioGraph";
import { attachAuthedVideo, type AuthedVideoStream } from "./videoStream";

export interface SoundStreamOptions {
    graph: CallAudioGraph;
    httpUrl: string;
    /** Linear gain for the clip. */
    gain: number;
    /** Give up (and discard) above this many bytes. */
    maxBytes: number;
    /** Stop at this many seconds, however long the file claims to be. */
    maxSeconds: number;
    /** The complete file, once downloaded. Not called for an oversize one. */
    onDownloaded: (bytes: ArrayBuffer) => void;
    /** The clip stopped: finished, failed or cut off. Called once. */
    onEnd: () => void;
}

/** Start streaming. Returns a function that stops the clip early, or null
 *  when the graph could not take the element (nothing started, and `onEnd`
 *  is not called). */
export function streamSound(opts: SoundStreamOptions): (() => void) | null {
    const el = document.createElement("audio");
    el.autoplay = true;
    el.preload = "auto";
    const release = opts.graph.playElement(el, opts.gain);
    if (!release) return null;

    let chunks: Uint8Array[] = [];
    let total = 0;
    let tooBig = false;
    let finished = false;
    let stream: AuthedVideoStream | null = null;

    const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        stream?.dispose();
        release();
        opts.onEnd();
    };
    // The file's own idea of its length can lie, or never arrive.
    const timer = setTimeout(finish, opts.maxSeconds * 1000 + 2000);

    el.addEventListener("ended", finish);
    el.addEventListener("error", finish);
    // A streamed clip reports an infinite duration until it has all arrived.
    const checkLength = () => {
        if (Number.isFinite(el.duration) && el.duration > opts.maxSeconds + 1)
            finish();
    };
    el.addEventListener("loadedmetadata", checkLength);
    el.addEventListener("durationchange", checkLength);
    // Autoplay is not guaranteed for an element that starts without a gesture.
    el.addEventListener("canplay", () => void el.play().catch(() => {}), {
        once: true,
    });

    stream = attachAuthedVideo(el, opts.httpUrl, {
        onData(chunk) {
            if (tooBig) return;
            total += chunk.length;
            if (total > opts.maxBytes) {
                tooBig = true;
                chunks = [];
                finish();
                return;
            }
            chunks.push(chunk.slice());
        },
        onDownloaded() {
            if (tooBig) return;
            const out = new Uint8Array(total);
            let at = 0;
            for (const c of chunks) {
                out.set(c, at);
                at += c.length;
            }
            chunks = [];
            opts.onDownloaded(out.buffer);
        },
        onError: finish,
    });
    return finish;
}
