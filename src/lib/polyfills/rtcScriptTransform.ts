// RTCRtpScriptTransform for WebViews that only have insertable streams
// (RTCRtpSender.createEncodedStreams). Android System WebView on Android 8-9
// stops around Chromium 138 and lacks the script transform, so a native
// screen share could not hand its frames to a worker there.
//
// The shim keeps the same page API: `sender.transform = new
// RTCRtpScriptTransform(worker, options)`. The setter calls
// createEncodedStreams() and transfers the streams to the worker under
// SCRIPT_TRANSFORM_TAG; the worker turns that into an `rtctransform` event
// (workers/nativeShareSubstitute.worker.ts). Every other sender of a patched
// connection is passed through unchanged, because Chromium stalls media on a
// sender that has no streams while the flag is set. The same flag makes a
// receiver stall (its frames arrive and never decode) unless its streams are
// taken, so every receiver of a connection the caller did not ask for
// insertable streams is passed through too. A connection that asked for them
// (LiveKit's E2EE) keeps its own receiver pipeline.
//
// Installed on Android only, at startup (hooks.client.ts), and only when the
// real class is missing. Desktop and newer WebViews never see it.

/** Message tag the worker shim listens for. */
export const SCRIPT_TRANSFORM_TAG = "zam:rtc-script-transform";

export interface ScriptTransformGlobal {
    RTCRtpScriptTransform?: unknown;
    RTCRtpSender?: { prototype: object };
    RTCPeerConnection?: new (
        config?: RTCConfiguration,
        ...rest: unknown[]
    ) => RTCPeerConnection;
}

interface TransformWorker {
    postMessage(message: unknown, transfer: Transferable[]): void;
}

/** The polyfill applies only when the real class is missing and the
 *  insertable-streams API is there to build it on. */
export function needsScriptTransformPolyfill(
    g: ScriptTransformGlobal,
): boolean {
    const proto = g.RTCRtpSender?.prototype as
        { createEncodedStreams?: unknown } | undefined;
    return (
        typeof g.RTCRtpScriptTransform === "undefined" &&
        typeof proto?.createEncodedStreams === "function"
    );
}

/** Installs the shim on `g` (the global scope in the app). Returns whether it
 *  was installed. Idempotent in effect: a second call sees the class and does
 *  nothing. */
export function installScriptTransformPolyfill(
    g: ScriptTransformGlobal,
): boolean {
    if (!needsScriptTransformPolyfill(g)) return false;
    const senderProto = g.RTCRtpSender!.prototype as {
        createEncodedStreams: (this: RTCRtpSender) => {
            readable: ReadableStream;
            writable: WritableStream;
        };
    };
    const rawCreate = senderProto.createEncodedStreams;
    // Senders whose streams are already taken (by this shim or by LiveKit's
    // own E2EE path). Chromium allows one createEncodedStreams call per sender.
    const claimed = new WeakSet<object>();
    const claimStreams = (sender: RTCRtpSender) => {
        claimed.add(sender);
        return rawCreate.call(sender);
    };
    senderProto.createEncodedStreams = function (this: RTCRtpSender) {
        claimed.add(this);
        return rawCreate.call(this);
    } as typeof senderProto.createEncodedStreams;

    class RTCRtpScriptTransform {
        readonly worker: TransformWorker;
        readonly options: unknown;
        constructor(worker: TransformWorker, options: unknown = {}) {
            this.worker = worker;
            this.options = options;
        }
    }
    const transforms = new WeakMap<object, RTCRtpScriptTransform>();
    Object.defineProperty(senderProto, "transform", {
        configurable: true,
        get(this: RTCRtpSender) {
            return transforms.get(this) ?? null;
        },
        set(this: RTCRtpSender, value: unknown) {
            if (!(value instanceof RTCRtpScriptTransform)) return;
            if (claimed.has(this)) {
                console.warn(
                    "[script transform] sender already has streams; transform not applied",
                );
                return;
            }
            const { readable, writable } = claimStreams(this);
            transforms.set(this, value);
            value.worker.postMessage(
                {
                    tag: SCRIPT_TRANSFORM_TAG,
                    readable,
                    writable,
                    options: value.options,
                },
                [readable, writable] as Transferable[],
            );
        },
    });
    g.RTCRtpScriptTransform = RTCRtpScriptTransform;

    // Patch the connection: the flag makes Chromium require streams on every
    // sender, and the pass-through gives the senders nobody else claimed
    // theirs. Pass-through runs after the negotiationneeded listeners (a
    // timeout), so a share's transform set there claims its sender first.
    const RawPC = g.RTCPeerConnection;
    if (RawPC) {
        class PatchedRTCPeerConnection extends RawPC {
            constructor(config?: RTCConfiguration, ...rest: unknown[]) {
                // Receivers need the pass-through below only when this shim,
                // not the caller, set the flag. A connection LiveKit asked for
                // (E2EE) takes its own receiver streams.
                const requested =
                    (
                        config as
                            { encodedInsertableStreams?: boolean } | undefined
                    )?.encodedInsertableStreams === true;
                super(
                    {
                        ...(config ?? {}),
                        encodedInsertableStreams: true,
                    } as RTCConfiguration,
                    ...rest,
                );
                this.addEventListener("negotiationneeded", () =>
                    setTimeout(() => passThrough(this), 0),
                );
                if (!requested)
                    this.addEventListener("track", (ev) =>
                        passThroughReceiver((ev as RTCTrackEvent).receiver),
                    );
            }
        }
        g.RTCPeerConnection = PatchedRTCPeerConnection;
    }
    // Receivers whose streams are already taken (one createEncodedStreams call
    // per receiver).
    const claimedReceivers = new WeakSet<object>();
    function passThroughReceiver(receiver: RTCRtpReceiver | undefined): void {
        if (!receiver || claimedReceivers.has(receiver)) return;
        claimedReceivers.add(receiver);
        try {
            const { readable, writable } = (
                receiver as unknown as {
                    createEncodedStreams(): {
                        readable: ReadableStream;
                        writable: WritableStream;
                    };
                }
            ).createEncodedStreams();
            readable.pipeTo(writable).catch(() => {
                // The receiver ended: nothing to clean up.
            });
        } catch (err) {
            console.warn(
                "[script transform] receiver pass-through failed",
                err,
            );
        }
    }
    function passThrough(pc: RTCPeerConnection): void {
        let senders: RTCRtpSender[];
        try {
            senders = pc.getSenders();
        } catch {
            return; // connection closed
        }
        for (const sender of senders) {
            if (claimed.has(sender)) continue;
            try {
                const { readable, writable } = claimStreams(sender);
                readable.pipeTo(writable).catch(() => {
                    // The sender ended: nothing to clean up.
                });
            } catch (err) {
                console.warn("[script transform] pass-through failed", err);
            }
        }
    }
    return true;
}
