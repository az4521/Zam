// Minimal APNG (animated PNG) encoder. Pure: no DOM, no SDK. Output is a PNG
// file that browsers animate and that stays a valid still PNG for decoders
// that ignore the animation chunks.
//
// Size control: frame 0 is stored whole; each later frame stores only the
// bounding box of pixels that changed from the previous frame. That is safe
// because every frame uses dispose_op NONE and blend_op SOURCE, so pixels
// outside the stored rectangle keep the previous frame's contents.

export interface ApngFrame {
    /** Canvas width in pixels; every frame must share it. */
    width: number;
    /** Canvas height in pixels; every frame must share it. */
    height: number;
    /** How long this frame stays on screen, in milliseconds. */
    delayMs: number;
    /** Straight (non-premultiplied) RGBA, row-major, 4 bytes per pixel. */
    rgba: Uint8Array | Uint8ClampedArray;
}

const PNG_SIGNATURE = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

/** CRC-32 (ISO-HDLC, as PNG uses it) over the given bytes. */
export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
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

/**
 * zlib-wrapped deflate (RFC 1950), which is what PNG IDAT and fdAT carry.
 * CompressionStream("deflate") produces exactly that wrapper.
 */
async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new CompressionStream("deflate");
    const writer = stream.writable.getWriter();
    const writing = writer
        .write(data as BufferSource)
        .then(() => writer.close());
    const reader = stream.readable.getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
    }
    await writing;
    return concat(parts);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
    const body = concat([typeBytes, data]);
    const out = new Uint8Array(12 + data.byteLength);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.byteLength);
    out.set(body, 4);
    view.setUint32(8 + data.byteLength, crc32(body));
    return out;
}

function u32(...values: number[]): Uint8Array {
    const out = new Uint8Array(values.length * 4);
    const view = new DataView(out.buffer);
    values.forEach((value, i) => view.setUint32(i * 4, value >>> 0));
    return out;
}

function withU32Prefix(sequence: number, rest: Uint8Array): Uint8Array {
    return concat([u32(sequence), rest]);
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Smallest rectangle covering pixels that differ between two frames. */
function changedRect(
    prev: Uint8Array | Uint8ClampedArray,
    next: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
): Rect | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
            const p = rowStart + x * 4;
            if (
                prev[p] !== next[p] ||
                prev[p + 1] !== next[p + 1] ||
                prev[p + 2] !== next[p + 2] ||
                prev[p + 3] !== next[p + 3]
            ) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                maxY = y;
            }
        }
    }
    if (maxX < 0) return null;
    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
    };
}

/** Filter-type-0 scanlines for a rectangle of an RGBA frame. */
function cropScanlines(
    rgba: Uint8Array | Uint8ClampedArray,
    frameWidth: number,
    rect: Rect,
): Uint8Array {
    const rowBytes = rect.width * 4;
    const out = new Uint8Array((rowBytes + 1) * rect.height);
    for (let row = 0; row < rect.height; row++) {
        const src = ((rect.y + row) * frameWidth + rect.x) * 4;
        const dst = row * (rowBytes + 1);
        out[dst] = 0;
        out.set(rgba.subarray(src, src + rowBytes), dst + 1);
    }
    return out;
}

function frameControl(
    sequence: number,
    rect: Rect,
    delayMs: number,
): Uint8Array {
    const delay = Math.min(65535, Math.max(0, Math.round(delayMs)));
    const body = new Uint8Array(26);
    const view = new DataView(body.buffer);
    view.setUint32(0, sequence);
    view.setUint32(4, rect.width);
    view.setUint32(8, rect.height);
    view.setUint32(12, rect.x);
    view.setUint32(16, rect.y);
    view.setUint16(20, delay);
    view.setUint16(22, 1000);
    body[24] = 0; // dispose_op NONE: the next frame sees this one's pixels
    body[25] = 0; // blend_op SOURCE: the stored rectangle replaces pixels
    return chunk("fcTL", body);
}

/**
 * Encodes frames as an APNG. `playCount` 0 loops forever.
 * Throws on empty input, mismatched sizes or a short pixel buffer.
 */
export async function encodeApng(
    frames: ApngFrame[],
    playCount = 0,
): Promise<Uint8Array> {
    if (frames.length === 0) throw new Error("encodeApng: no frames");
    const { width, height } = frames[0];
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        throw new Error("encodeApng: width and height must be integers");
    }
    if (width < 1 || height < 1) throw new Error("encodeApng: empty canvas");
    for (const frame of frames) {
        if (frame.width !== width || frame.height !== height) {
            throw new Error("encodeApng: all frames must share one size");
        }
        if (frame.rgba.length !== width * height * 4) {
            throw new Error("encodeApng: pixel buffer has the wrong length");
        }
    }

    const parts: Uint8Array[] = [PNG_SIGNATURE];
    const ihdr = new Uint8Array(13);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(0, width);
    ihdrView.setUint32(4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type RGBA
    // compression, filter and interlace methods stay 0
    parts.push(chunk("IHDR", ihdr));
    parts.push(chunk("acTL", u32(frames.length, playCount)));

    let sequence = 0;
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        let rect: Rect = { x: 0, y: 0, width, height };
        if (i > 0) {
            // An identical frame still needs a 1x1 control chunk to keep the
            // frame count and timing right.
            rect = changedRect(
                frames[i - 1].rgba,
                frame.rgba,
                width,
                height,
            ) ?? { x: 0, y: 0, width: 1, height: 1 };
        }
        parts.push(frameControl(sequence++, rect, frame.delayMs));
        const data = await zlibDeflate(cropScanlines(frame.rgba, width, rect));
        if (i === 0) {
            parts.push(chunk("IDAT", data));
        } else {
            parts.push(chunk("fdAT", withU32Prefix(sequence++, data)));
        }
    }
    parts.push(chunk("IEND", new Uint8Array(0)));
    return concat(parts);
}
