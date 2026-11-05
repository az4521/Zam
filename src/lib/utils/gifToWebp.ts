/**
 * Re-encode an animated GIF as an animated WebP before sending, and shrink
 * received animations to the size they are drawn at.
 *
 * Browsers have no animated-WebP encoder, so this does it in two steps: the
 * WebCodecs `ImageDecoder` yields each GIF frame already composited onto the
 * full canvas, a canvas encodes each as a still WebP, and the still frames'
 * image chunks are wrapped in an animated WebP container (RIFF VP8X + ANIM +
 * one ANMF per frame). Frames are full-canvas and replace what was there
 * (no blending, no disposal), so no GIF disposal logic is needed.
 *
 * Frames are encoded losslessly: a GIF is at most 256 colours per frame, which
 * lossy WebP turns into visible banding. The result is only used when it is
 * actually smaller than the GIF; anything unexpected gives back the original.
 *
 * An animation is decoded to full-size frames for as long as it is mounted, so
 * a 1080p GIF in a 400 px tile costs ~8 MB per cached frame. shrinkAnimatedImage
 * runs the same pipeline with each frame drawn smaller; any format ImageDecoder
 * reads (GIF, animated WebP, APNG, AVIF) goes in, an animated WebP comes out.
 */

/** Past this many frames or pixels of work the GIF is sent as it is. */
const MAX_FRAMES = 600;
const MAX_PIXELS = 64_000_000;

const u32 = (n: number) =>
    new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24]);
const u24 = (n: number) =>
    new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255]);
const tag = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

function chunk(fourcc: string, payload: Uint8Array): Uint8Array {
    const pad = payload.length & 1;
    const out = new Uint8Array(8 + payload.length + pad);
    out.set(tag(fourcc), 0);
    out.set(u32(payload.length), 4);
    out.set(payload, 8);
    return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

/**
 * The image chunks (ALPH + VP8, VP8L, ...) of a still WebP file, or null if it
 * is not one. Metadata chunks are dropped.
 */
function imageChunks(webp: Uint8Array): Uint8Array | null {
    const dv = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
    const is = (at: number, s: string) =>
        [...s].every((c, i) => webp[at + i] === c.charCodeAt(0));
    if (webp.length < 20 || !is(0, "RIFF") || !is(8, "WEBP")) return null;
    const keep: Uint8Array[] = [];
    let at = 12;
    while (at + 8 <= webp.length) {
        const size = dv.getUint32(at + 4, true);
        const end = at + 8 + size + (size & 1);
        if (end > webp.length) return null;
        if (is(at, "VP8 ") || is(at, "VP8L") || is(at, "ALPH")) {
            keep.push(webp.subarray(at, end));
        }
        at = end;
    }
    return keep.length ? concat(keep) : null;
}

function buildAnimatedWebp(
    w: number,
    h: number,
    frames: { data: Uint8Array; ms: number }[],
): Uint8Array {
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0b00010010; // animation + alpha
    vp8x.set(u24(w - 1), 4);
    vp8x.set(u24(h - 1), 7);
    const anim = new Uint8Array(6); // black-transparent background, loop forever
    const body = [
        tag("WEBP"),
        chunk("VP8X", vp8x),
        chunk("ANIM", anim),
        ...frames.map((f) => {
            // ANMF: x/2 (3) y/2 (3) w-1 (3) h-1 (3) duration (3) flags (1).
            const head = new Uint8Array(16);
            head.set(u24(w - 1), 6);
            head.set(u24(h - 1), 9);
            head.set(u24(f.ms), 12);
            head[15] = 0b10; // do not blend with the previous frame, no dispose
            return chunk("ANMF", concat([head, f.data]));
        }),
    ];
    const total = body.reduce((n, p) => n + p.length, 0);
    return concat([tag("RIFF"), u32(total), ...body]);
}

async function encodeFrame(
    frame: VideoFrame,
    canvas: OffscreenCanvas,
    quality: number,
): Promise<Uint8Array | null> {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    // quality 1 selects lossless WebP in Chromium and Firefox.
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    // An engine with no WebP encoder silently hands back a PNG.
    if (blob.type !== "image/webp") return null;
    return imageChunks(new Uint8Array(await blob.arrayBuffer()));
}

type Fit = (w: number, h: number) => { w: number; h: number } | null;

/** Result of transcodeAnimated when the source turned out not to animate. */
const STILL = Symbol("still");

/**
 * `source` as an animated WebP, each frame drawn at `fit(w, h)` (the source
 * size when it returns null). null when it can't be done here (unsupported
 * decoder, too heavy, an encode failed), STILL when it has fewer than two
 * frames.
 */
async function transcodeAnimated(
    source: Blob,
    type: string,
    fit: Fit,
    quality: number,
): Promise<Uint8Array | null | typeof STILL> {
    if (
        typeof ImageDecoder === "undefined" ||
        typeof OffscreenCanvas === "undefined" ||
        !(await ImageDecoder.isTypeSupported(type))
    ) {
        return null;
    }
    const decoder = new ImageDecoder({ type, data: source.stream() });
    try {
        await decoder.tracks.ready;
        await decoder.completed;
        const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
        if (count < 2) return STILL;
        if (count > MAX_FRAMES) return null;

        const first = await decoder.decode({ frameIndex: 0 });
        const srcW = first.image.displayWidth;
        const srcH = first.image.displayHeight;
        first.image.close();
        if (!srcW || !srcH || srcW > 16383 || srcH > 16383) return null;
        if (srcW * srcH * count > MAX_PIXELS * 4) return null;
        const { w, h } = fit(srcW, srcH) ?? { w: srcW, h: srcH };

        const canvas = new OffscreenCanvas(w, h);
        const frames: { data: Uint8Array; ms: number }[] = [];
        for (let i = 0; i < count; i++) {
            const { image } = await decoder.decode({ frameIndex: i });
            try {
                const data = await encodeFrame(image, canvas, quality);
                if (!data) return null;
                // Same rule browsers apply to GIFs: <= 10 ms shows for 100.
                const ms = (image.duration ?? 0) / 1000;
                frames.push({ data, ms: Math.round(ms > 10 ? ms : 100) });
            } finally {
                image.close();
            }
        }
        return buildAnimatedWebp(w, h, frames);
    } finally {
        decoder.close();
    }
}

/**
 * An animated WebP copy of `file` if it is an animated GIF and the copy is
 * smaller; otherwise `file` itself. Never throws.
 */
export async function gifToAnimatedWebp(file: File): Promise<File> {
    try {
        if (file.type !== "image/gif") return file;
        const out = await transcodeAnimated(file, "image/gif", () => null, 1);
        if (!out || out === STILL || out.length >= file.size) return file;
        return new File(
            [out as BlobPart],
            file.name.replace(/\.gif$/i, "") + ".webp",
            { type: "image/webp", lastModified: file.lastModified },
        );
    } catch (err) {
        console.warn("GIF to WebP conversion failed", err);
        return file;
    }
}

const ANIMATED_TYPES = ["image/gif", "image/webp", "image/png", "image/avif"];

/**
 * A copy of the animation `blob` (of MIME `type`) with every frame drawn at `fit(w, h)`, as an
 * animated WebP. null means show the original (nothing to shrink, no decoder,
 * too heavy, failed); "still" means it has a single frame, for the caller's
 * still-image path. Never throws.
 */
export async function shrinkAnimatedImage(
    blob: Blob,
    type: string,
    fit: Fit,
): Promise<Blob | null | "still"> {
    try {
        // A GIF is lossless (see the header); other sources are photographic
        // more often than not, where lossless WebP is several times larger.
        if (!ANIMATED_TYPES.includes(type)) return null;
        const out = await transcodeAnimated(
            blob,
            type,
            fit,
            type === "image/gif" ? 1 : 0.9,
        );
        if (out === STILL) return "still";
        return out ? new Blob([out as BlobPart], { type: "image/webp" }) : null;
    } catch (err) {
        console.warn("Animated image shrink failed", err);
        return null;
    }
}
