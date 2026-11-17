/**
 * The substitution policy of the native screen share (matrix/call/nativeShare).
 *
 * The share's track is a tiny placeholder, so Chromium's encoder makes one
 * encoded frame per placeholder frame. The helper process makes access units
 * (AUs) of the real capture, one per frame, in the same order. This class
 * takes each placeholder encoded frame and swaps its data for the next AU, so
 * the encoder's output (its timing, its keyframe flags) is what gets sent,
 * with the helper's pictures inside.
 *
 * It runs where the encoded frames are: the E2EE worker (hook.ts) or the
 * RTCRtpScriptTransform worker (workers/nativeShareSubstitute.worker.ts).
 * Pure, so the policy is unit-tested without a browser.
 */

/** Side of the placeholder frame the encoder is given, in pixels. */
export const NATIVE_PLACEHOLDER_SIZE = 64;

/** The placeholder's fill: one colour for every frame. Chromium's H.264
 *  encoder forces a keyframe every 256 input frames while the picture changes
 *  (measured in loopback: every 2 s at 125 fps, every 8.4 s at 30 fps), but
 *  makes none while it is static. Keyframes on the placeholder meet helper
 *  deltas, which the substitution then has to hold back. */
export const NATIVE_PLACEHOLDER_FILL = "rgb(90,90,90)";

/** The size of the helper's picture, from one of its info messages: "started"
 *  (Windows, and again whenever the encoder reopens at a new size) or "size"
 *  (Android, on rotation). Null for any other message. The share's track is
 *  the 64x64 placeholder, so this is the size to tell the call server and
 *  other clients (LiveKit would report the placeholder's otherwise). */
export function nativeShareSize(info: {
    event?: string;
    width?: number;
    height?: number;
}): { width: number; height: number } | null {
    if (info.event !== "started" && info.event !== "size") return null;
    const { width, height } = info;
    if (
        typeof width !== "number" ||
        typeof height !== "number" ||
        !(width > 0) ||
        !(height > 0)
    )
        return null;
    return { width: Math.round(width), height: Math.round(height) };
}

/** One access unit from the helper, as the worker forwards it. */
export interface NativeAu {
    key: boolean;
    data: ArrayBuffer;
    /** Capture time, microseconds (the placeholder carries the same). */
    ts?: number;
    /** When the worker queued it, in the policy's clock (ms). */
    at?: number;
}

/** The parts of an RTCEncodedVideoFrame the policy uses. */
export interface EncodedFrameLike {
    /** "key" or "delta" on video frames; undefined on audio. */
    type?: string;
    data: ArrayBuffer;
    getMetadata?(): { width?: number; height?: number; mimeType?: string };
}

/** Whether a codec is H.264. No codec given is H.264 too: the native share
 *  publishes H.264 (livekitCall nativeSharePublishOptions). */
export function isH264(codec?: string): boolean {
    return codec === undefined || /h264/i.test(codec);
}

/** Whether a placeholder with no AU queued is dropped (true) or passed on as
 *  it is (false). Only H.264 drops: its encoder output is a sequence the
 *  receiver decodes in order, and a dropped frame stalls it (the picture-ID
 *  gap in VP8, measured on loopback, is the same failure). Other codecs keep
 *  every placeholder so the sequence stays whole. */
export function dropsEmptyPlaceholder(frame: EncodedFrameLike): boolean {
    return isH264(frame.getMetadata?.().mimeType);
}

/** Whether an encoded frame is one of the share's placeholders. Audio and
 *  frames of any other size pass through untouched. */
export function isNativePlaceholder(frame: EncodedFrameLike): boolean {
    if (frame.type === undefined) return false;
    const meta = frame.getMetadata?.();
    return (
        meta?.width === NATIVE_PLACEHOLDER_SIZE &&
        meta?.height === NATIVE_PLACEHOLDER_SIZE
    );
}

/**
 * Timestamps for the placeholder frames, one per helper AU.
 *
 * The receiver schedules each frame for display by its RTP timestamp, and
 * Chromium derives that from the VideoFrame timestamp the placeholder is
 * written with (its TimestampAligner keeps the spacing of those timestamps,
 * whatever moment the frame was written). So a placeholder carries its AU's
 * own capture time: the viewer then shows frames at the pace they were
 * captured. Placeholders on a timer, stamped with the time they were written,
 * gave AUs gaps of 8, 25 and 33 ms instead of 16.7 at 60 fps (about one frame
 * in five, measured in loopback), which the viewer showed as judder.
 *
 * The helper's capture times are QPC microseconds, a different origin from
 * the page's clock; only their spacing matters. An AU without a newer capture
 * time (the helper's keep-alive or key re-encode of an old frame) and the
 * catch-up placeholder get "now" in the helper's clock, estimated from the
 * last AU, and every stamp is at least 1 ms after the one before.
 */
export class PlaceholderClock {
    private last = Number.NEGATIVE_INFINITY;
    /** Helper capture clock minus the local clock, from the last fresh AU. */
    private offset: number | null = null;

    /** The timestamp (µs) for the next placeholder. `captureUs` is the AU's
     *  capture time, if it has one; `nowUs` is the local clock. */
    stamp(captureUs: number | undefined, nowUs: number): number {
        let ts: number;
        if (
            captureUs !== undefined &&
            Number.isFinite(captureUs) &&
            captureUs > this.last
        ) {
            this.offset = captureUs - nowUs;
            ts = captureUs;
        } else {
            ts = Math.max(nowUs + (this.offset ?? 0), this.last + 1000);
        }
        ts = Math.round(ts);
        this.last = ts;
        return ts;
    }
}

/** Seconds (in ms) before a repeated key request is sent again. */
const KEY_REQUEST_GAP_MS = 1000;
/** AUs still queued after a substitution that mean the placeholders fell
 *  behind (one is a placeholder still in the encoder; normal is none). */
const CATCH_UP_DEPTH = 2;
/** Gap (ms) between catch-up requests. */
const CATCH_UP_GAP_MS = 250;
/** AUs held before the oldest are dropped (the encoder has stalled). */
const MAX_QUEUED_AUS = 60;
/** A queue deeper than this is latency, not buffering: a keyframe AU then
 *  restarts the stream at its own position (every AU before it is dropped,
 *  since the decoder resets there), and until one arrives a key is asked for. */
const MAX_BACKLOG_AUS = 8;

export interface NativeSubstituteOptions {
    /** Ask the helper for a keyframe. */
    requestKey: () => void;
    /** Ask for one extra placeholder: AUs are queuing up behind the
     *  placeholders (one went missing), so the share lags by a frame each. */
    requestCatchUp?: () => void;
    /** Clock in ms, for the key request gap (tests inject one). */
    now?: () => number;
}

export interface NativeSubstituteStats {
    substituted: number;
    /** Placeholder frames with no AU queued: dropped (H.264), or passed on
     *  unchanged (other codecs, see dropsEmptyPlaceholder). */
    fifoEmpty: number;
    /** A keyframe placeholder met a delta AU: waited for a key. */
    keyMismatch: number;
    /** Delta AUs dropped while waiting for a key. */
    waitKeyDropped: number;
    /** AUs dropped because the queue overflowed. */
    overflowed: number;
    /** AUs dropped by skipping the backlog to a keyframe. */
    skipped: number;
    /** Placeholder frames seen (substituted, dropped or passed on). */
    placeholders: number;
    /** Sum and max of how long each substituted AU waited in the queue, ms. */
    waitMsSum: number;
    waitMsMax: number;
    /** Deepest the queue got. */
    maxDepth: number;
}

/**
 * FIFO substitution with keyframe alignment.
 *
 * - AUs are queued in the order the helper made them (`push`).
 * - Each placeholder frame takes the next AU (`substitute` sets its data).
 * - If the encoder makes a keyframe but the next AU is a delta, the stream
 *   would be out of step at a point where the receiver needs a keyframe:
 *   the policy waits for a keyframe AU, drops delta AUs and placeholders
 *   until one comes, and asks the helper for a key (once per gap).
 * - No AU queued: H.264 placeholders are dropped (never sent with their
 *   64x64 data); other codecs pass the frame on unchanged (dropsEmptyPlaceholder).
 */
export class NativeSubstitute {
    private queue: NativeAu[] = [];
    private waitingForKey = false;
    private lastKeyRequest = Number.NEGATIVE_INFINITY;
    private lastCatchUp = Number.NEGATIVE_INFINITY;
    private readonly requestKey: () => void;
    private readonly requestCatchUp?: () => void;
    private readonly now: () => number;
    readonly stats: NativeSubstituteStats = {
        substituted: 0,
        fifoEmpty: 0,
        keyMismatch: 0,
        waitKeyDropped: 0,
        overflowed: 0,
        skipped: 0,
        placeholders: 0,
        waitMsSum: 0,
        waitMsMax: 0,
        maxDepth: 0,
    };

    constructor(opts: NativeSubstituteOptions) {
        this.requestKey = opts.requestKey;
        this.requestCatchUp = opts.requestCatchUp;
        this.now = opts.now ?? (() => Date.now());
    }

    /** Queue an AU from the helper. */
    push(au: NativeAu): void {
        this.queue.push({ ...au, at: au.at ?? this.now() });
        if (this.queue.length > MAX_BACKLOG_AUS) {
            if (au.key) {
                // Skip the backlog: the keyframe starts a new stream.
                const dropped = this.queue.length - 1;
                this.queue.splice(0, dropped);
                this.stats.skipped += dropped;
                this.waitingForKey = false;
            } else {
                const t = this.now();
                if (t - this.lastKeyRequest >= KEY_REQUEST_GAP_MS) {
                    this.lastKeyRequest = t;
                    this.requestKey();
                }
            }
        }
        if (this.queue.length > MAX_QUEUED_AUS) {
            this.queue.shift();
            this.stats.overflowed++;
        }
        if (this.queue.length > this.stats.maxDepth)
            this.stats.maxDepth = this.queue.length;
    }

    /** AUs waiting for a placeholder. */
    get pending(): number {
        return this.queue.length;
    }

    /** Give a placeholder frame the next AU's data. Returns true when the
     *  frame should go on to the encoder's output, false when it is dropped. */
    substitute(frame: EncodedFrameLike): boolean {
        this.stats.placeholders++;
        const au = this.queue.shift();
        if (!au) {
            this.stats.fifoEmpty++;
            return !dropsEmptyPlaceholder(frame);
        }
        if (frame.type === "key" && !au.key) {
            this.stats.keyMismatch++;
            this.waitingForKey = true;
            const t = this.now();
            if (t - this.lastKeyRequest >= KEY_REQUEST_GAP_MS) {
                this.lastKeyRequest = t;
                this.requestKey();
            }
        }
        if (this.waitingForKey) {
            if (!au.key) {
                this.stats.waitKeyDropped++;
                // Keep asking while the wait lasts: a key request can be lost
                // (or answered by an AU already queued), and the wait would
                // otherwise drop every delta until the next keyframe.
                const t = this.now();
                if (t - this.lastKeyRequest >= KEY_REQUEST_GAP_MS) {
                    this.lastKeyRequest = t;
                    this.requestKey();
                }
                return false;
            }
            this.waitingForKey = false;
        }
        frame.data = au.data;
        this.stats.substituted++;
        if (au.at !== undefined) {
            const wait = this.now() - au.at;
            this.stats.waitMsSum += wait;
            if (wait > this.stats.waitMsMax) this.stats.waitMsMax = wait;
        }
        if (this.requestCatchUp && this.queue.length >= CATCH_UP_DEPTH) {
            const t = this.now();
            if (t - this.lastCatchUp >= CATCH_UP_GAP_MS) {
                this.lastCatchUp = t;
                this.requestCatchUp();
            }
        }
        return true;
    }
}
