/// <reference lib="webworker" />
/**
 * Trims screen-share frames to sizes a GPU encoder takes (utils/shareCrop).
 * Off the main thread so a busy page never stalls the share. Receives the
 * capture's frames as a ReadableStream and writes the trimmed ones to the
 * generator's WritableStream; the trim is a smaller visible area on the same
 * frame, not a copy.
 */
import { alignedShareRect, SHARE_SIZE_ALIGN } from "$lib/utils/shareCrop";

// What frames are trimmed to; the call can raise it if the encoder still
// refuses them (some want whole 16-pixel blocks).
let align: number = SHARE_SIZE_ALIGN;

self.onmessage = (
    e: MessageEvent<
        | { align: number }
        | {
              readable: ReadableStream<VideoFrame>;
              writable: WritableStream<VideoFrame>;
          }
    >,
) => {
    if ("align" in e.data) {
        align = e.data.align;
        return;
    }
    const { readable, writable } = e.data;
    void readable
        .pipeThrough(
            new TransformStream<VideoFrame, VideoFrame>({
                transform(frame, controller) {
                    const rect = frame.visibleRect;
                    const trimmed = rect && alignedShareRect(rect, align);
                    if (!trimmed) {
                        controller.enqueue(frame);
                        return;
                    }
                    let out: VideoFrame;
                    try {
                        out = new VideoFrame(frame, {
                            visibleRect: trimmed,
                            displayWidth: trimmed.width,
                            displayHeight: trimmed.height,
                        });
                    } catch {
                        // A frame the browser won't trim: send it as it is.
                        controller.enqueue(frame);
                        return;
                    }
                    frame.close();
                    controller.enqueue(out);
                },
            }),
        )
        .pipeTo(writable)
        .catch(() => {
            // The share ended (either end closed): nothing to clean up.
        });
};
