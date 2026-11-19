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

/** Serialises one RIFF chunk, with the pad byte for odd sizes. */
function makeChunk(fourcc: string, data: Uint8Array): Uint8Array {
    const padded = data.byteLength & 1;
    const out = new Uint8Array(8 + data.byteLength + padded);
    for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
    const view = new DataView(out.buffer);
    view.setUint32(4, data.byteLength, true);
    out.set(data, 8);
    return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
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

function frameChunk(
    webp: Uint8Array,
    delayMs: number,
    width: number,
    height: number,
): Uint8Array {
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    // X and Y are 0, so their /2 encoding is 0 as well.
    writeU24(view, 0, 0);
    writeU24(view, 3, 0);
    writeU24(view, 6, width - 1);
    writeU24(view, 9, height - 1);
    const duration = Number.isFinite(delayMs)
        ? Math.round(delayMs)
        : MAX_DURATION_MS;
    writeU24(view, 12, Math.min(MAX_DURATION_MS, Math.max(1, duration)));
    header[15] = ANMF_FLAGS;
    const payload = concat(
        imageChunks(webp).map((chunk) => makeChunk(chunk.fourcc, chunk.data)),
    );
    return makeChunk("ANMF", concat([header, payload]));
}

/**
 * Muxes still WebP frames into one animated WebP. `loopCount` 0 loops
 * forever. Throws on an empty frame list, bad dimensions, or input that is
 * not a WebP file with image data.
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

    const vp8x = new Uint8Array(10);
    const vp8xView = new DataView(vp8x.buffer);
    vp8x[0] = VP8X_FLAGS;
    writeU24(vp8xView, 4, width - 1);
    writeU24(vp8xView, 7, height - 1);

    const anim = new Uint8Array(6);
    new DataView(anim.buffer).setUint16(4, loopCount, true);

    const parts: Uint8Array[] = [
        makeChunk("VP8X", vp8x),
        makeChunk("ANIM", anim),
    ];
    for (const frame of frames) {
        parts.push(frameChunk(frame.webp, frame.delayMs, width, height));
    }
    const body = concat(parts);
    const out = new Uint8Array(12 + body.byteLength);
    for (let i = 0; i < 4; i++) {
        out[i] = "RIFF".charCodeAt(i);
        out[8 + i] = "WEBP".charCodeAt(i);
    }
    const view = new DataView(out.buffer);
    view.setUint32(4, out.byteLength - 8, true);
    out.set(body, 12);
    return out;
}
