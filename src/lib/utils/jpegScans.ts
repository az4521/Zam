/**
 * Scan layout of a progressive (SOF2) JPEG. Walks the marker segments without
 * decoding any entropy data, so it works on the output of jpegToProgressive
 * and on any other progressive file.
 */

export interface JpegScan {
    /** Offset just past this scan's entropy-coded data (the next marker's 0xFF). */
    end: number;
    /** Component ids (SOF ids) the scan codes. */
    componentIds: number[];
    ss: number;
    se: number;
    ah: number;
    al: number;
}

export interface ProgressiveLayout {
    componentIds: number[];
    scans: JpegScan[];
}

/** Parses the frame and every scan header. Returns null for anything that is not a well-formed SOF2 JPEG. */
export function progressiveLayout(bytes: Uint8Array): ProgressiveLayout | null {
    const len = bytes.length;
    if (len < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let frameIds: number[] | null = null;
    const scans: JpegScan[] = [];
    let p = 2;
    while (p < len) {
        if (bytes[p] !== 0xff) return null;
        let q = p + 1;
        while (q < len && bytes[q] === 0xff) q++; // fill bytes
        if (q >= len) return null;
        const m = bytes[q];
        p = q + 1;
        if (m === 0xd9) break; // EOI
        if (m === 0x01 || m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) continue;
        if (p + 2 > len) return null;
        const segLen = (bytes[p] << 8) | bytes[p + 1];
        if (segLen < 2 || p + segLen > len) return null;
        const body = p + 2;
        const segEnd = p + segLen;
        if (isSofMarker(m)) {
            if (m !== 0xc2 || frameIds) return null;
            frameIds = parseFrameIds(bytes, body, segEnd);
            if (!frameIds) return null;
        } else if (m === 0xda) {
            if (!frameIds) return null;
            const scan = parseScanHeader(bytes, body, segEnd, frameIds);
            if (!scan) return null;
            const end = skipEntropyData(bytes, segEnd);
            if (end < 0) return null;
            scan.end = end;
            scans.push(scan);
            p = end;
            continue;
        }
        p = segEnd;
    }
    if (!frameIds || scans.length === 0) return null;
    return { componentIds: frameIds, scans };
}

/** Byte offsets just past each scan's entropy-coded data in a progressive JPEG, or null. */
export function progressiveScanEnds(bytes: Uint8Array): number[] | null {
    const layout = progressiveLayout(bytes);
    return layout ? layout.scans.map((s) => s.end) : null;
}

/**
 * Largest scan end <= maxBytes that covers the DC scan of every component and
 * at least one AC scan of the luma (first) component. Null otherwise.
 */
export function choosePrefix(
    bytes: Uint8Array,
    maxBytes: number,
): { length: number; scanIndex: number } | null {
    const layout = progressiveLayout(bytes);
    if (!layout) return null;
    const { scans, componentIds } = layout;
    let i = -1;
    for (let j = 0; j < scans.length; j++) {
        if (scans[j].end <= maxBytes) i = j;
        else break;
    }
    if (i < 0) return null;
    const luma = componentIds[0];
    for (const id of componentIds) {
        if (
            !scans.some(
                (s, j) => j <= i && s.ss === 0 && s.componentIds.includes(id),
            )
        )
            return null;
    }
    if (
        !scans.some(
            (s, j) => j <= i && s.ss > 0 && s.componentIds.includes(luma),
        )
    )
        return null;
    return { length: scans[i].end, scanIndex: i };
}

function isSofMarker(m: number): boolean {
    return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
}

function parseFrameIds(
    bytes: Uint8Array,
    body: number,
    segEnd: number,
): number[] | null {
    if (body + 6 > segEnd) return null;
    const nc = bytes[body + 5];
    if (nc < 1 || nc > 4 || segEnd - body !== 6 + 3 * nc) return null;
    const ids: number[] = [];
    for (let i = 0; i < nc; i++) ids.push(bytes[body + 6 + 3 * i]);
    return ids;
}

function parseScanHeader(
    bytes: Uint8Array,
    body: number,
    segEnd: number,
    frameIds: number[],
): JpegScan | null {
    if (body + 1 > segEnd) return null;
    const ns = bytes[body];
    if (ns < 1 || ns > 4 || segEnd - body !== 1 + 2 * ns + 3) return null;
    const componentIds: number[] = [];
    for (let i = 0; i < ns; i++) {
        const id = bytes[body + 1 + 2 * i];
        if (!frameIds.includes(id)) return null;
        componentIds.push(id);
    }
    const q = body + 1 + 2 * ns;
    const ss = bytes[q];
    const se = bytes[q + 1];
    const ah = bytes[q + 2] >> 4;
    const al = bytes[q + 2] & 15;
    if (ss > se || se > 63) return null;
    return { end: 0, componentIds, ss, se, ah, al };
}

/** Returns the offset of the first marker after the entropy data starting at start, or -1 if none. */
function skipEntropyData(bytes: Uint8Array, start: number): number {
    const len = bytes.length;
    let i = start;
    for (;;) {
        if (i >= len) return -1;
        if (bytes[i] !== 0xff) {
            i++;
            continue;
        }
        if (i + 1 >= len) return -1;
        const nx = bytes[i + 1];
        if (nx === 0 || (nx >= 0xd0 && nx <= 0xd7)) {
            i += 2;
            continue;
        }
        if (nx === 0xff) {
            i++;
            continue;
        }
        return i;
    }
}
