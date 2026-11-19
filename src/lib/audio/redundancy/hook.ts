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
import { ZAM_NATIVE_SHARE, ZAM_REDUNDANCY } from "./protocol";
import {
    isNativePlaceholder,
    LayeredSubstitute,
    type EncodedFrameLike,
} from "$lib/utils/nativeShareSubstitute";
import { clearIdrPpsId } from "$lib/utils/h264ClearPps";

/** The native screen share's substitution, once a port is attached
 *  (matrix/call/nativeShare.ts). Null otherwise: frames pass untouched. */
let nativeShare: LayeredSubstitute | null = null;

/** Replaces each native-share placeholder frame's data with the helper's next
 *  access unit (utils/nativeShareSubstitute). Frames that are not
 *  placeholders, audio included, go through unchanged. */
function nativeShareStage(): TransformStream<
    EncodedFrameLike & AudioFrameLike,
    EncodedFrameLike & AudioFrameLike
> {
    return new TransformStream({
        transform(frame, controller) {
            const sub = nativeShare;
            if (!sub || !isNativePlaceholder(frame)) {
                controller.enqueue(frame);
                return;
            }
            if (sub.substitute(frame)) controller.enqueue(frame);
            // Otherwise dropped: no AU was ready for this placeholder.
        },
    });
}

/** Rewrites outgoing H.264 keyframes so their pps_id stays in the bytes
 *  LiveKit leaves unencrypted (utils/h264ClearPps): otherwise a viewer's
 *  WebRTC reads it from ciphertext and drops about half of all keyframes,
 *  freezing the picture after every layer switch or loss. */
function h264KeyStage(): TransformStream<
    EncodedFrameLike & AudioFrameLike,
    EncodedFrameLike & AudioFrameLike
> {
    return new TransformStream({
        transform(frame, controller) {
            if (
                frame.type !== undefined &&
                /h264/i.test(frame.getMetadata?.().mimeType ?? "")
            ) {
                try {
                    const fixed = clearIdrPpsId(new Uint8Array(frame.data));
                    if (fixed) frame.data = fixed.buffer as ArrayBuffer;
                } catch {
                    // Sent as it was.
                }
            }
            controller.enqueue(frame);
        },
    });
}

function attachNativeShare(port: MessagePort): void {
    const sub = new LayeredSubstitute({
        requestKey: (layer) => port.postMessage({ req: "key", layer }),
        requestCatchUp: () => port.postMessage({ req: "catchup" }),
    });
    nativeShare = sub;
    // The helper's AUs arrive flat, as `{ key, ts, data }` (the same shape the
    // plain-call substitution worker takes, see nativeShare.worker.ts). A
    // wrapped `{ au }` matched nothing, so every placeholder was dropped.
    port.onmessage = (
        ev: MessageEvent<{
            key?: boolean;
            data?: ArrayBuffer;
            ts?: number;
            layer?: number;
        } | null>,
    ) => {
        const au = ev.data;
        if (au?.data && typeof au.key === "boolean" && nativeShare === sub)
            sub.push({
                key: au.key,
                data: au.data,
                ts: au.ts,
                layer: au.layer === 1 ? 1 : 0,
            });
    };
}

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
        /** Set by LiveKit on video receivers only. */
        codec?: string;
        readableStream?: ReadableStream<AudioFrameLike>;
        writableStream?: WritableStream<AudioFrameLike>;
        /** Set with ZAM_NATIVE_SHARE. */
        port?: MessagePort;
    };
}

self.addEventListener("message", (ev) => {
    const msg = (ev as MessageEvent<StreamMessage | null>).data;
    const data = msg?.data;
    if (!msg || !data) return;
    if (msg.kind === ZAM_REDUNDANCY) {
        const depth = Number(data.depth);
        config.depth = Number.isFinite(depth) ? Math.max(0, depth | 0) : 0;
    } else if (msg.kind === ZAM_NATIVE_SHARE) {
        if (data.port) attachNativeShare(data.port);
    } else if (msg.kind === "encode" && data.readableStream) {
        // Every outgoing stream goes through the native-share stage first
        // (a pass-through unless a share's port is attached), then the
        // H.264 keyframe fix, then the redundancy stage (video frames pass
        // through that one untouched).
        data.readableStream = data.readableStream
            .pipeThrough(
                nativeShareStage() as TransformStream<
                    AudioFrameLike,
                    AudioFrameLike
                >,
            )
            .pipeThrough(
                h264KeyStage() as TransformStream<
                    AudioFrameLike,
                    AudioFrameLike
                >,
            )
            .pipeThrough(senderStage(config));
    } else if (
        msg.kind === "decode" &&
        data.writableStream &&
        // LiveKit names a codec only for video receivers. Video must reach
        // the decoder straight from the decryptor: through one more stream,
        // Chrome dropped every encrypted H.264 delta frame (viewers saw a
        // share stuck on its first frame, then nothing). VP8 and HEVC were
        // unaffected; measured in a two-page loopback.
        !data.codec
    ) {
        const pass = new TransformStream<AudioFrameLike, AudioFrameLike>();
        pass.readable
            .pipeThrough(receiverStage(makeFrame))
            .pipeTo(data.writableStream)
            .catch(() => {});
        data.writableStream = pass.writable;
    }
});
