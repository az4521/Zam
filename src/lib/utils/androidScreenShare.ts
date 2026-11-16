/**
 * The pure parts of the Android screen share (lib/androidScreenShare.ts): the
 * frames the native ScreenShare plugin posts on its port, and the WebView
 * feature check. No Capacitor import, so the policy is unit-tested alone.
 *
 * Native to page, see ANDROID_SHARE_CONTRACT: an ArrayBuffer access unit is
 * flags (u8, bit 0 = keyframe), presentation time (i64 LE, microseconds),
 * width (u16 LE), height (u16 LE), then Annex B bytes. Text is JSON: info or
 * ended.
 */

/** Bytes before the Annex B data in a native access unit. */
export const ANDROID_AU_HEADER_BYTES = 13;

const FLAG_KEYFRAME = 1;

/** One access unit, in the shape nativeShare.worker.ts takes from a helper. */
export interface AndroidAu {
    type: "au";
    key: boolean;
    /** Capture time, microseconds. */
    ts: number;
    w: number;
    h: number;
    data: ArrayBuffer;
}

/** Parse a binary access unit. Null when it is too short to carry data. */
export function parseAndroidAu(buf: ArrayBuffer): AndroidAu | null {
    if (buf.byteLength <= ANDROID_AU_HEADER_BYTES) return null;
    const view = new DataView(buf);
    // The i64 is read as two halves: BigInt is missing from older WebViews.
    const lo = view.getUint32(1, true);
    const hi = view.getInt32(5, true);
    return {
        type: "au",
        key: (view.getUint8(0) & FLAG_KEYFRAME) !== 0,
        ts: hi * 0x100000000 + lo,
        w: view.getUint16(9, true),
        h: view.getUint16(11, true),
        data: buf.slice(ANDROID_AU_HEADER_BYTES),
    };
}

export type AndroidText =
    | { type: "info"; info: Record<string, unknown> }
    | { type: "ended"; reason: string };

/** Parse a JSON text message from the plugin. Null for anything else. */
export function parseAndroidText(text: string): AndroidText | null {
    let msg: unknown;
    try {
        msg = JSON.parse(text);
    } catch {
        return null;
    }
    if (!msg || typeof msg !== "object") return null;
    const m = msg as { type?: unknown; info?: unknown; reason?: unknown };
    if (m.type === "info") {
        const info =
            m.info && typeof m.info === "object"
                ? (m.info as Record<string, unknown>)
                : {};
        return { type: "info", info };
    }
    if (m.type === "ended") {
        return {
            type: "ended",
            reason: typeof m.reason === "string" ? m.reason : "error",
        };
    }
    return null;
}

/** The WebView features a share needs, read off the global scope. */
export interface AndroidShareEnv {
    MediaStreamTrackGenerator?: unknown;
    Worker?: unknown;
    OffscreenCanvas?: unknown;
    RTCRtpScriptTransform?: unknown;
    /** RTCRtpSender.prototype.createEncodedStreams (insertable streams). */
    createEncodedStreams?: unknown;
}

/** Whether the WebView can build the placeholder track and its worker. */
export function androidWebViewCanShare(env: AndroidShareEnv): boolean {
    return (
        typeof env.MediaStreamTrackGenerator === "function" &&
        typeof env.Worker === "function" &&
        typeof env.OffscreenCanvas === "function"
    );
}

/** Whether a room can take the substituted frames: an encrypted room through
 *  the E2EE worker (insertable streams), a plain one through the sender's
 *  RTCRtpScriptTransform. */
export function androidRoomCanShare(
    env: AndroidShareEnv,
    encrypted: boolean,
): boolean {
    if (!androidWebViewCanShare(env)) return false;
    return encrypted
        ? typeof env.createEncodedStreams === "function"
        : typeof env.RTCRtpScriptTransform === "function";
}

/** The live global scope's features (the impure edge of the checks above). */
export function androidShareEnv(): AndroidShareEnv {
    const g = globalThis as unknown as Record<string, unknown>;
    const sender =
        typeof RTCRtpSender !== "undefined"
            ? (RTCRtpSender.prototype as unknown as Record<string, unknown>)
            : undefined;
    return {
        MediaStreamTrackGenerator: g.MediaStreamTrackGenerator,
        Worker: g.Worker,
        OffscreenCanvas: g.OffscreenCanvas,
        RTCRtpScriptTransform: g.RTCRtpScriptTransform,
        createEncodedStreams: sender?.createEncodedStreams,
    };
}
