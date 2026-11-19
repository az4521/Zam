// Frame planning for converting a short video (a Telegram .webm sticker) into
// an animated image. Pure: no DOM, no SDK. The browser side seeks to each
// planned time and draws the frame; this module only decides the schedule.

/** Sampling rate used when a video is longer than the frame cap allows. */
export const VIDEO_SAMPLE_FPS = 30;
/** Frame delays are never shorter than this, so players do not run away. */
export const MIN_FRAME_DELAY_MS = 10;

export interface VideoFramePlanInput {
    /** Intrinsic video size in pixels, as the decoder reports it. */
    srcWidth: number;
    srcHeight: number;
    /** Length of the video in seconds. */
    duration: number;
    /** Largest allowed side of the output, in pixels. */
    maxSide: number;
    /** Most frames the output may hold. */
    maxFrames: number;
}

export interface VideoFramePlan {
    width: number;
    height: number;
    /** Presentation time of each frame, in seconds, ascending. */
    times: number[];
    /** Milliseconds each frame stays on screen. Same for every frame. */
    delayMs: number;
}

/**
 * Plans the frames of a video. The output never upscales. A zero-length video
 * yields a single frame at time 0. A negative, NaN or infinite duration is
 * rejected, because such a video cannot be sampled at fixed times.
 */
export function planVideoFrames(input: VideoFramePlanInput): VideoFramePlan {
    const { srcWidth, srcHeight, duration, maxSide, maxFrames } = input;
    if (!(srcWidth > 0) || !(srcHeight > 0)) {
        throw new Error("video has no picture dimensions");
    }
    if (!Number.isFinite(duration) || duration < 0) {
        throw new Error("video has no finite duration");
    }
    if (!(maxSide >= 1) || !(maxFrames >= 1)) {
        throw new Error("video frame limits must be at least 1");
    }

    const scale = Math.min(1, maxSide / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const wanted = Math.max(1, Math.round(duration * VIDEO_SAMPLE_FPS));
    const count = Math.min(Math.floor(maxFrames), wanted);
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
        times.push((i * duration) / count);
    }
    const delayMs = Math.max(
        MIN_FRAME_DELAY_MS,
        Math.round((duration * 1000) / count),
    );
    return { width, height, times, delayMs };
}
