// Animated WebP muxer. Pure: no DOM, no SDK. Input is a list of still WebP
// files (as canvas.toBlob("image/webp") produces them). Output is one RIFF
// WEBP file with a VP8X header, an ANIM chunk and one ANMF chunk per frame.
//
// Every frame covers the whole canvas and uses dispose-to-background with no
// blending, so transparent pixels in one frame never show the frame before.

export interface AwebpFrame {
    /** A complete still WebP file (simple or VP8X container). */
    webp: Uint8Array;
    /** How long this frame stays on screen, in milliseconds. */
    delayMs: number;
}

const MAX_CANVAS_SIDE = 0x1000000;
const MAX_DURATION_MS = 0xffffff;
const MAX_LOOP_COUNT = 0xffff;

/** VP8X flags byte: alpha (0x10) and animation (0x02). */
const VP8X_FLAGS = 0x10 | 0x02;
/** ANMF flags byte: do not blend (0x02), dispose to background (0x01). */
const ANMF_FLAGS = 0x02 | 0x01;

/** Still-image chunks that are not part of an animation frame's payload. */
const FRAME_SKIP = new Set(["VP8X", "EXIF", "XMP ", "ICCP"]);

interface RiffChunk {
    fourcc: string;
    data: Uint8Array;
}

function fourccAt(bytes: Uint8Array, offset: number): string {
    return String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    );
}

/** Splits a RIFF/WEBP file into its top-level chunks. Throws when malformed. */
function readChunks(bytes: Uint8Array): RiffChunk[] {
    if (bytes.byteLength < 12) {
        throw new Error("awebp: input is too short to be a WebP file");
    }
    if (fourccAt(bytes, 0) !== "RIFF" || fourccAt(bytes, 8) !== "WEBP") {
        throw new Error("awebp: input is not a WebP file");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const riffSize = view.getUint32(4, true);
    if (riffSize < 4 || riffSize + 8 > bytes.byteLength) {
        throw new Error("awebp: WebP RIFF size is invalid or truncated");
    }
    const end = riffSize + 8;
    const chunks: RiffChunk[] = [];
    let pos = 12;
    while (pos < end) {
        if (pos + 8 > end) {
            throw new Error("awebp: truncated WebP chunk header");
        }
        const size = view.getUint32(pos + 4, true);
        const dataStart = pos + 8;
        const dataEnd = dataStart + size;
        if (dataEnd > end) {
            throw new Error("awebp: truncated WebP chunk data");
        }
        chunks.push({
            fourcc: fourccAt(bytes, pos),
            data: bytes.subarray(dataStart, dataEnd),
        });
        pos = dataEnd + (size & 1);
    }
    return chunks;
}

/** The image-data chunks of one still: ALPH + VP8, or VP8L. */
function imageChunks(webp: Uint8Array): RiffChunk[] {
    const frame = readChunks(webp).filter(
        (chunk) => !FRAME_SKIP.has(chunk.fourcc),
    );
    const hasBitstream = frame.some(
        (chunk) => chunk.fourcc === "VP8 " || chunk.fourcc === "VP8L",
    );
    if (!hasBitstream) {
        throw new Error("awebp: still WebP has no VP8 or VP8L image data");
    }
    return frame;
}

/** Bytes one RIFF chunk with `size` payload bytes takes, pad byte included. */
function chunkBytes(size: number): number {
    return 8 + size + (size & 1);
}

/** Writes a chunk header at `pos` and returns the offset of its payload. The
 *  output is zero-filled, so a pad byte (odd sizes) needs no write. */
function putChunkHeader(
    out: Uint8Array,
    view: DataView,
    pos: number,
    fourcc: string,
    size: number,
): number {
    for (let i = 0; i < 4; i++) out[pos + i] = fourcc.charCodeAt(i);
    view.setUint32(pos + 4, size, true);
    return pos + 8;
}

function writeU24(view: DataView, offset: number, value: number): void {
    view.setUint8(offset, value & 0xff);
    view.setUint8(offset + 1, (value >>> 8) & 0xff);
    view.setUint8(offset + 2, (value >>> 16) & 0xff);
}

function checkDimension(name: string, value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > MAX_CANVAS_SIDE) {
        throw new Error(`awebp: ${name} must be an integer from 1 to 16777216`);
    }
}

interface PlannedFrame {
    chunks: RiffChunk[];
    delayMs: number;
    /** ANMF payload size: the 16 header bytes plus the image chunks. */
    payload: number;
}

/** Writes one ANMF chunk at `pos`; returns the offset after it. Each image
 *  chunk's bytes are copied into `out` once, straight from the input view. */
function writeFrame(
    out: Uint8Array,
    view: DataView,
    pos: number,
    frame: PlannedFrame,
    width: number,
    height: number,
): number {
    const at = putChunkHeader(out, view, pos, "ANMF", frame.payload);
    // X and Y are 0 (already zero in `out`), so their /2 encoding is 0 too.
    writeU24(view, at + 6, width - 1);
    writeU24(view, at + 9, height - 1);
    const duration = Number.isFinite(frame.delayMs)
        ? Math.round(frame.delayMs)
        : MAX_DURATION_MS;
    writeU24(view, at + 12, Math.min(MAX_DURATION_MS, Math.max(1, duration)));
    out[at + 15] = ANMF_FLAGS;
    let next = at + 16;
    for (const chunk of frame.chunks) {
        next = putChunkHeader(
            out,
            view,
            next,
            chunk.fourcc,
            chunk.data.byteLength,
        );
        out.set(chunk.data, next);
        next += chunk.data.byteLength + (chunk.data.byteLength & 1);
    }
    return pos + chunkBytes(frame.payload);
}

/**
 * Muxes still WebP frames into one animated WebP. `loopCount` 0 loops
 * forever. Throws on an empty frame list, bad dimensions, or input that is
 * not a WebP file with image data.
 *
 * The output is sized up front and written once: no per-chunk or per-frame
 * intermediate buffers, so each frame's bytes are copied a single time.
 */
export function muxAnimatedWebp(
    frames: AwebpFrame[],
    width: number,
    height: number,
    loopCount = 0,
): Uint8Array {
    if (frames.length === 0) throw new Error("awebp: no frames");
    checkDimension("width", width);
    checkDimension("height", height);
    if (
        !Number.isInteger(loopCount) ||
        loopCount < 0 ||
        loopCount > MAX_LOOP_COUNT
    ) {
        throw new Error("awebp: loop count must be an integer from 0 to 65535");
    }

    const planned: PlannedFrame[] = frames.map((frame) => {
        const chunks = imageChunks(frame.webp);
        let payload = 16;
        for (const chunk of chunks) {
            payload += chunkBytes(chunk.data.byteLength);
        }
        return { chunks, delayMs: frame.delayMs, payload };
    });

    let size = 12 + chunkBytes(10) + chunkBytes(6);
    for (const frame of planned) size += chunkBytes(frame.payload);

    const out = new Uint8Array(size);
    const view = new DataView(out.buffer);
    for (let i = 0; i < 4; i++) {
        out[i] = "RIFF".charCodeAt(i);
        out[8 + i] = "WEBP".charCodeAt(i);
    }
    view.setUint32(4, size - 8, true);

    let pos = 12;
    const vp8x = putChunkHeader(out, view, pos, "VP8X", 10);
    out[vp8x] = VP8X_FLAGS;
    writeU24(view, vp8x + 4, width - 1);
    writeU24(view, vp8x + 7, height - 1);
    pos += chunkBytes(10);

    const anim = putChunkHeader(out, view, pos, "ANIM", 6);
    view.setUint16(anim + 4, loopCount, true);
    pos += chunkBytes(6);

    for (const frame of planned) {
        pos = writeFrame(out, view, pos, frame, width, height);
    }
    return out;
}
