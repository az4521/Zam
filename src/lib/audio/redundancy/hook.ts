// Runs inside Zam's E2EE worker, before LiveKit's own worker code. It
// registers a second message listener, which fires first, and swaps the
// frame streams LiveKit is about to be given for ones that pass through the
// redundancy stages (stages.ts):
//   encode: encoder -> [add copies] -> LiveKit encrypts -> network
//   decode: network -> LiveKit decrypts -> [refill lost frames] -> decoder
// Chromium only: other browsers hand LiveKit an RTCRtpScriptTransform and
// get no redundancy.

import {
    receiverStage,
    senderStage,
    type AudioFrameLike,
    type RedundancyConfig,
} from "./stages";
import { ZAM_REDUNDANCY } from "./protocol";

interface FrameCtor {
    new (
        original: AudioFrameLike,
        options?: { metadata?: Record<string, unknown> },
    ): AudioFrameLike;
}

function makeFrame(
    template: AudioFrameLike,
    packet: Uint8Array,
    ts: number,
): AudioFrameLike | null {
    const Ctor = (self as unknown as { RTCEncodedAudioFrame?: FrameCtor })
        .RTCEncodedAudioFrame;
    if (!Ctor) return null;
    try {
        const frame = new Ctor(template, {
            metadata: { ...template.getMetadata?.(), rtpTimestamp: ts },
        });
        frame.data = packet.buffer.slice(
            packet.byteOffset,
            packet.byteOffset + packet.byteLength,
        ) as ArrayBuffer;
        return frame;
    } catch {
        return null;
    }
}

const config: RedundancyConfig = { depth: 0 };

interface StreamMessage {
    kind?: string;
    data?: {
        depth?: number;
        readableStream?: ReadableStream<AudioFrameLike>;
        writableStream?: WritableStream<AudioFrameLike>;
    };
}

self.addEventListener("message", (ev) => {
    const msg = (ev as MessageEvent<StreamMessage | null>).data;
    const data = msg?.data;
    if (!msg || !data) return;
    if (msg.kind === ZAM_REDUNDANCY) {
        const depth = Number(data.depth);
        config.depth = Number.isFinite(depth) ? Math.max(0, depth | 0) : 0;
    } else if (msg.kind === "encode" && data.readableStream) {
        data.readableStream = data.readableStream.pipeThrough(
            senderStage(config),
        );
    } else if (msg.kind === "decode" && data.writableStream) {
        const pass = new TransformStream<AudioFrameLike, AudioFrameLike>();
        pass.readable
            .pipeThrough(receiverStage(makeFrame))
            .pipeTo(data.writableStream)
            .catch(() => {});
        data.writableStream = pass.writable;
    }
});
