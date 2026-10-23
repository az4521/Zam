/**
 * Hands one stream of preview frames (an encrypted image painting in as it
 * decrypts, see progressiveImage.ts) to every canvas showing that image: the
 * chat tile and, when it is opened mid-download, the lightbox.
 *
 * A canvas that attaches late is filled from one that already has a frame, so
 * a viewer opened between frames (or while an animation holds on a frame that
 * is still downloading) does not sit empty until the next one.
 */
export interface FrameRelay {
    /** Draw `frame` on every attached canvas. Call while the frame is open. */
    draw(frame: VideoFrame): void;
    /** Paint frames onto `canvas` until the returned function is called.
     *  `onFrame` runs after each one lands on it. */
    attach(canvas: HTMLCanvasElement, onFrame?: () => void): () => void;
}

interface Sink {
    canvas: HTMLCanvasElement;
    onFrame?: () => void;
    painted: boolean;
}

export function createFrameRelay(): FrameRelay {
    const sinks = new Set<Sink>();

    function paint(
        sink: Sink,
        source: CanvasImageSource,
        w: number,
        h: number,
    ): void {
        const { canvas } = sink;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(source, 0, 0, w, h);
        sink.painted = true;
        sink.onFrame?.();
    }

    return {
        draw(frame) {
            for (const sink of sinks) {
                paint(sink, frame, frame.displayWidth, frame.displayHeight);
            }
        },
        attach(canvas, onFrame) {
            const sink: Sink = { canvas, onFrame, painted: false };
            for (const other of sinks) {
                if (!other.painted) continue;
                paint(
                    sink,
                    other.canvas,
                    other.canvas.width,
                    other.canvas.height,
                );
                break;
            }
            sinks.add(sink);
            return () => {
                sinks.delete(sink);
            };
        },
    };
}

/** `use:frameSink={{ relay, onFrame }}`: attach a canvas to a FrameRelay for
 *  as long as it is mounted. A null relay attaches nothing. */
export function frameSink(
    canvas: HTMLCanvasElement,
    params: { relay: FrameRelay | null | undefined; onFrame?: () => void },
) {
    // Through a wrapper so a new `onFrame` doesn't need a re-attach.
    const onFrame = () => params.onFrame?.();
    let detach = params.relay?.attach(canvas, onFrame);
    return {
        update(next: typeof params) {
            const relayChanged = next.relay !== params.relay;
            params = next;
            if (!relayChanged) return;
            detach?.();
            detach = next.relay?.attach(canvas, onFrame);
        },
        destroy() {
            detach?.();
        },
    };
}
