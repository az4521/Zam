// @ts-nocheck: an AudioWorklet module (registerProcessor and
// AudioWorkletProcessor only exist in AudioWorkletGlobalScope); the core is
// plain JS so tests and the worklet run the same code.
//
// Plays interleaved float32 stereo PCM that arrives over a MessagePort: the
// per-application screen-share audio the desktop app captures on Windows
// (native/app-audio, electron/appAudio.cjs). The capture runs on the sound
// card's clock and arrives in bursts, so this keeps a small jitter buffer:
// output starts once PCM_START_FRAMES are queued, an underrun plays silence
// and waits for that much again, and when the queue grows past
// PCM_MAX_FRAMES (the two clocks drifting, or a stall that then caught up)
// the oldest audio is dropped back down to PCM_START_FRAMES, so latency
// can't creep up over a long share.

export const PCM_CHANNELS = 2;
export const PCM_START_FRAMES = 1920; // 40 ms at 48 kHz
export const PCM_MAX_FRAMES = 9600; // 200 ms
const CAPACITY = 48000; // frames: 1 s

export class PcmJitterBuffer {
    constructor() {
        this.buf = new Float32Array(CAPACITY * PCM_CHANNELS);
        this.read = 0; // frame index
        this.size = 0; // frames queued
        this.playing = false;
        this.dropped = 0;
        this.underruns = 0;
    }

    /** Queue interleaved stereo samples (a trailing half frame is ignored). */
    push(samples) {
        let frames = Math.floor(samples.length / PCM_CHANNELS);
        let from = 0;
        if (frames > CAPACITY) {
            from = (frames - CAPACITY) * PCM_CHANNELS;
            frames = CAPACITY;
        }
        const overflow = this.size + frames - CAPACITY;
        if (overflow > 0) this.drop(overflow);
        let write = (this.read + this.size) % CAPACITY;
        for (let f = 0; f < frames; f++) {
            const i = from + f * PCM_CHANNELS;
            this.buf[write * 2] = samples[i];
            this.buf[write * 2 + 1] = samples[i + 1];
            write = write + 1 === CAPACITY ? 0 : write + 1;
        }
        this.size += frames;
        if (this.size > PCM_MAX_FRAMES) this.drop(this.size - PCM_START_FRAMES);
    }

    drop(frames) {
        const n = Math.min(frames, this.size);
        this.read = (this.read + n) % CAPACITY;
        this.size -= n;
        this.dropped += n;
    }

    /** Fill one render quantum; `right` may be undefined (mono output). */
    pull(left, right) {
        const n = left.length;
        if (!this.playing && this.size >= PCM_START_FRAMES) this.playing = true;
        if (this.playing && this.size < n) {
            this.playing = false;
            this.underruns++;
        }
        if (!this.playing) {
            left.fill(0);
            right?.fill(0);
            return;
        }
        let r = this.read;
        for (let i = 0; i < n; i++) {
            const l = this.buf[r * 2];
            const rr = this.buf[r * 2 + 1];
            if (right) {
                left[i] = l;
                right[i] = rr;
            } else {
                left[i] = (l + rr) / 2;
            }
            r = r + 1 === CAPACITY ? 0 : r + 1;
        }
        this.read = r;
        this.size -= n;
    }
}

if (typeof registerProcessor === "function") {
    registerProcessor(
        "zam-pcm-stream",
        class extends AudioWorkletProcessor {
            constructor() {
                super();
                this.core = new PcmJitterBuffer();
                // The page hands over the capture's MessagePort once; PCM
                // then flows straight from the main process to this thread.
                this.port.onmessage = (e) => {
                    const source = e.data?.port;
                    if (!source) return;
                    source.onmessage = (m) => {
                        const data = m.data;
                        if (data instanceof ArrayBuffer) {
                            this.core.push(new Float32Array(data));
                        } else if (ArrayBuffer.isView(data)) {
                            // Copied: a view's offset needn't be 4-aligned.
                            const bytes =
                                data.byteLength - (data.byteLength % 4);
                            this.core.push(
                                new Float32Array(
                                    data.buffer.slice(
                                        data.byteOffset,
                                        data.byteOffset + bytes,
                                    ),
                                ),
                            );
                        }
                    };
                    source.start?.();
                };
            }
            process(_inputs, outputs) {
                const out = outputs[0];
                if (out?.[0]) this.core.pull(out[0], out[1]);
                return true;
            }
        },
    );
}
