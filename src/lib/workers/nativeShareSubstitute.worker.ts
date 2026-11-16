/// <reference lib="webworker" />
/**
 * The substitution stage for an unencrypted native screen share. Chromium
 * runs this worker as the share sender's RTCRtpScriptTransform (there is no
 * insertable-stream hook in a plain call, unlike the E2EE worker, see
 * audio/redundancy/hook.ts). It takes the helper's access units from the
 * substitution port and swaps them into the placeholder frames
 * (utils/nativeShareSubstitute). Every other frame passes through.
 */
import {
    isNativePlaceholder,
    NativeSubstitute,
    type EncodedFrameLike,
} from "$lib/utils/nativeShareSubstitute";

let policy: NativeSubstitute | null = null;

/** Diagnostic: every 2 s, what the substitution did in that window. */
let logged = {
    placeholders: 0,
    substituted: 0,
    waitMsSum: 0,
    fifoEmpty: 0,
    keyMismatch: 0,
    waitKeyDropped: 0,
    overflowed: 0,
};
setInterval(() => {
    const sub = policy;
    if (!sub) return;
    const st = sub.stats;
    const d = {
        placeholders: st.placeholders - logged.placeholders,
        substituted: st.substituted - logged.substituted,
        waitMsSum: st.waitMsSum - logged.waitMsSum,
        fifoEmpty: st.fifoEmpty - logged.fifoEmpty,
        keyMismatch: st.keyMismatch - logged.keyMismatch,
        waitKeyDropped: st.waitKeyDropped - logged.waitKeyDropped,
        overflowed: st.overflowed - logged.overflowed,
    };
    logged = {
        placeholders: st.placeholders,
        substituted: st.substituted,
        waitMsSum: st.waitMsSum,
        fifoEmpty: st.fifoEmpty,
        keyMismatch: st.keyMismatch,
        waitKeyDropped: st.waitKeyDropped,
        overflowed: st.overflowed,
    };
    if (d.placeholders === 0) return;
    const avgWait = d.substituted
        ? (d.waitMsSum / d.substituted).toFixed(1)
        : "n/a";
    self.postMessage({
        stats: `[native share sub] 2s: placeholders ${d.placeholders} substituted ${d.substituted} avgWaitMs ${avgWait} maxWaitMs ${st.waitMsMax.toFixed(0)} depth ${sub.pending} maxDepth ${st.maxDepth} fifoEmpty ${d.fifoEmpty} keyMismatch ${d.keyMismatch} waitKeyDropped ${d.waitKeyDropped} overflowed ${d.overflowed} skippedTotal ${st.skipped}`,
    });
}, 2000);

self.onmessage = (e: MessageEvent<{ port?: MessagePort } | null>) => {
    const port = e.data?.port;
    if (!port) return;
    const sub = new NativeSubstitute({
        requestKey: () => port.postMessage({ req: "key" }),
    });
    policy = sub;
    port.onmessage = (
        ev: MessageEvent<{
            key?: boolean;
            data?: ArrayBuffer;
            ts?: number;
        } | null>,
    ) => {
        const au = ev.data;
        if (au?.data && typeof au.key === "boolean" && policy === sub)
            sub.push({ key: au.key, data: au.data, ts: au.ts });
    };
};

// Chromium's encoded-transform entry point (RTCRtpScriptTransform).
(
    self as unknown as {
        onrtctransform: ((ev: { transformer: RtcTransformer }) => void) | null;
    }
).onrtctransform = (ev) => {
    const t = ev.transformer;
    t.readable
        .pipeThrough(
            new TransformStream<EncodedFrameLike, EncodedFrameLike>({
                transform(frame, controller) {
                    const sub = policy;
                    if (!sub || !isNativePlaceholder(frame)) {
                        controller.enqueue(frame);
                        return;
                    }
                    if (sub.substitute(frame)) controller.enqueue(frame);
                },
            }) as unknown as TransformStream<unknown, unknown>,
        )
        .pipeTo(t.writable as WritableStream<unknown>)
        .catch(() => {
            // The sender ended: nothing to clean up.
        });
};

interface RtcTransformer {
    readable: ReadableStream;
    writable: WritableStream;
}
