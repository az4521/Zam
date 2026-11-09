// The two halves of encrypted-call audio redundancy as TransformStreams over
// encoded audio frames. The E2EE worker puts the sender stage before its
// encryptor and the receiver stage after its decryptor (see e2eeWorker.ts),
// so both see plain Opus packets. Packet format: opusPad.ts.

import {
    MAX_DEPTH,
    extractRedundancy,
    packetSamples,
    withRedundancy,
} from "./opusPad";

/** The parts of an RTCEncodedAudioFrame the stages use. */
export interface AudioFrameLike {
    /** Only video frames have one. */
    type?: string;
    data: ArrayBuffer;
    timestamp?: number;
    getMetadata?(): { rtpTimestamp?: number };
}

export interface RedundancyConfig {
    /** Earlier frames to carry in every packet; 0 sends none. */
    depth: number;
}

export function frameTimestamp(f: AudioFrameLike): number | null {
    const ts = f.getMetadata?.().rtpTimestamp ?? f.timestamp;
    return typeof ts === "number" ? ts >>> 0 : null;
}

/** Copies the earlier packets into each outgoing packet while `cfg.depth`
 *  asks for it. Only packets that directly precede this one in time are
 *  carried: after a DTX pause there is nothing to repeat. */
export function senderStage(
    cfg: RedundancyConfig,
): TransformStream<AudioFrameLike, AudioFrameLike> {
    const history: { ts: number; packet: Uint8Array }[] = [];
    return new TransformStream({
        transform(frame, controller) {
            const ts = frameTimestamp(frame);
            const packet = new Uint8Array(frame.data);
            if (
                frame.type !== undefined ||
                ts === null ||
                packet.length === 0
            ) {
                controller.enqueue(frame);
                return;
            }
            const depth = Math.min(cfg.depth, MAX_DEPTH);
            if (depth > 0) {
                const copies: Uint8Array[] = [];
                let want = ts;
                for (let i = history.length - 1; i >= 0; i--) {
                    const h = history[i];
                    if (copies.length >= depth) break;
                    if ((h.ts + packetSamples(h.packet)) >>> 0 !== want) break;
                    copies.push(h.packet);
                    want = h.ts;
                }
                const packed = withRedundancy(packet, copies);
                if (packed !== packet) {
                    frame.data = packed.buffer.slice(
                        packed.byteOffset,
                        packed.byteOffset + packed.byteLength,
                    ) as ArrayBuffer;
                }
            }
            history.push({ ts, packet });
            if (history.length > MAX_DEPTH) history.shift();
            controller.enqueue(frame);
        },
    });
}

/** Builds a frame carrying `packet` at RTP timestamp `ts`, from a received
 *  one to take the rest (SSRC, payload type, ...) from. */
export type MakeFrame = (
    template: AudioFrameLike,
    packet: Uint8Array,
    ts: number,
) => AudioFrameLike | null;

export interface ReceiverStats {
    recovered: number;
}

/** Strips the copies off incoming packets and, when frames before this one
 *  never arrived, sends the copies of them ahead of it. */
export function receiverStage(
    makeFrame: MakeFrame,
    stats: ReceiverStats = { recovered: 0 },
): TransformStream<AudioFrameLike, AudioFrameLike> {
    // RTP timestamp the next frame should start at.
    let next: number | null = null;
    return new TransformStream({
        transform(frame, controller) {
            const ts = frameTimestamp(frame);
            const bytes = new Uint8Array(frame.data);
            const got =
                frame.type === undefined ? extractRedundancy(bytes) : null;
            if (ts === null || frame.type !== undefined) {
                controller.enqueue(frame);
                return;
            }
            if (got) {
                if (next !== null) {
                    // Copies are newest first, each ending where the last began.
                    const missing: { ts: number; packet: Uint8Array }[] = [];
                    let end = ts;
                    for (const c of got.copies) {
                        const start = (end - packetSamples(c)) >>> 0;
                        // Whole frames after `next` only: unsigned distance.
                        if (((start - next) | 0) < 0) break;
                        missing.push({ ts: start, packet: c });
                        end = start;
                    }
                    for (let i = missing.length - 1; i >= 0; i--) {
                        const made = makeFrame(
                            frame,
                            missing[i].packet,
                            missing[i].ts,
                        );
                        if (!made) continue;
                        controller.enqueue(made);
                        stats.recovered++;
                    }
                }
                frame.data = got.primary.buffer.slice(
                    got.primary.byteOffset,
                    got.primary.byteOffset + got.primary.byteLength,
                ) as ArrayBuffer;
            }
            const end = (ts + packetSamples(got ? got.primary : bytes)) >>> 0;
            if (next === null || ((end - next) | 0) > 0) next = end;
            controller.enqueue(frame);
        },
    });
}
