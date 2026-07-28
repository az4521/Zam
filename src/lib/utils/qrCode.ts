/**
 * Pure QR-code data helpers for device verification: turning an encoder's bit
 * matrix into SVG geometry, and validating a payload a camera decoded before it
 * is handed to the crypto layer. Dependency-free and SDK-free so it unit-tests
 * without the rust-crypto WASM or a DOM (same discipline as utils/videoTiles.ts).
 */

/** Modules of blank margin the QR spec requires around a symbol. */
export const QR_QUIET_ZONE = 4;

/** ASCII "MATRIX" — the prefix every Matrix verification QR payload starts with. */
const MATRIX_PREFIX = [0x4d, 0x41, 0x54, 0x52, 0x49, 0x58];

/**
 * Side length of the SVG viewBox for a symbol of `size` modules: the symbol
 * plus a quiet zone on each side. 0 for an empty symbol.
 */
export function qrViewBoxSize(size: number): number {
    if (!Number.isFinite(size) || size <= 0) return 0;
    return size + QR_QUIET_ZONE * 2;
}

/**
 * Build one SVG path `d` covering every dark module of a row-major bit matrix
 * (`data[row * size + col]`, non-zero = dark). Horizontal runs are coalesced
 * into single rectangles, which keeps the path an order of magnitude smaller
 * than one rect per module. Coordinates already include the quiet-zone offset,
 * so the result drops straight into a `qrViewBoxSize(size)` viewBox.
 *
 * Returns "" for an empty, undersized or all-light matrix — the caller renders
 * nothing rather than an unscannable partial symbol. `size` must be a whole
 * number: a fractional one makes `row * size + col` land between indices, which
 * would emit a corrupt path instead of failing honestly.
 */
export function qrModulePath(size: number, data: ArrayLike<number>): string {
    if (!Number.isInteger(size) || size <= 0) return "";
    if (data.length < size * size) return "";
    let path = "";
    for (let row = 0; row < size; row++) {
        let col = 0;
        while (col < size) {
            if (!data[row * size + col]) {
                col++;
                continue;
            }
            const start = col;
            while (col < size && data[row * size + col]) col++;
            const run = col - start;
            const x = start + QR_QUIET_ZONE;
            const y = row + QR_QUIET_ZONE;
            path += `M${x} ${y}h${run}v1h-${run}z`;
        }
    }
    return path;
}

/**
 * Normalise the `binaryData` a QR decoder produced (a plain number[]) into the
 * `Uint8ClampedArray` the SDK's `scanQRCode` expects.
 *
 * Returns null for an empty payload or any value that isn't a whole byte:
 * `Uint8ClampedArray` would silently clamp those, and feeding the crypto layer
 * a quietly-corrupted payload is worse than refusing the scan.
 */
export function toQrPayloadBytes(
    binaryData: ArrayLike<number> | null | undefined,
): Uint8ClampedArray | null {
    if (!binaryData || binaryData.length === 0) return null;
    const out = new Uint8ClampedArray(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        const value = binaryData[i];
        if (!Number.isInteger(value) || value < 0 || value > 255) return null;
        out[i] = value;
    }
    return out;
}

/**
 * True when a payload looks like a Matrix verification QR: the ASCII "MATRIX"
 * prefix plus at least the version byte that follows it. Lets the scanner say
 * "that's not a verification code" instead of handing an unrelated QR (a URL,
 * a WiFi config) to the SDK and surfacing its opaque error.
 */
export function isMatrixQrPayload(bytes: ArrayLike<number>): boolean {
    if (bytes.length <= MATRIX_PREFIX.length) return false;
    for (let i = 0; i < MATRIX_PREFIX.length; i++) {
        if (bytes[i] !== MATRIX_PREFIX[i]) return false;
    }
    return true;
}
