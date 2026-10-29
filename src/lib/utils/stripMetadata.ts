/**
 * Strip privacy-leaking metadata (GPS location above all, but also camera
 * serials, timestamps, thumbnails and XMP/IPTC blocks) from a file before it
 * is uploaded, WITHOUT touching the picture/media data.
 *
 * Formats are recognised by their magic bytes, not the MIME type or name:
 *   - JPEG:  every APPn / COM segment is dropped except JFIF, the ICC colour
 *            profile and Adobe's colour-transform marker; bytes after the end
 *            of the image (MPF/vendor trailers) are dropped.
 *   - PNG:   eXIf, tEXt, zTXt, iTXt and tIME chunks are dropped.
 *   - WebP:  EXIF and XMP chunks are dropped.
 *   - GIF:   comment extensions and XMP application extensions are dropped.
 *   - TIFF / DNG: GPS, Exif and maker-note IFDs and the XMP / IPTC /
 *            Photoshop blocks are zeroed in place.
 *   - ISO-BMFF (HEIC, HEIF, AVIF, MP4, MOV, M4A, 3GP): Exif and XMP items,
 *            the QuickTime/3GPP location atoms (`©xyz`, `loci`, the
 *            `com.apple.quicktime.location.*` keys, Samsung `smta`, `uuid`
 *            XMP) are blanked in place, so no offset in the file moves.
 *
 * The one thing kept is the Exif ORIENTATION tag, rebuilt as a tiny Exif block
 * of its own, so a rotated photo still displays upright.
 *
 * Never throws: anything unrecognised or unparseable returns the ORIGINAL
 * file, since a file that cannot be sent is worse than the (opt-out-able)
 * default. Not covered: GPS tracks stored as a separate timed-metadata track
 * in a video (GoPro `gpmd`, Google `camm`), and non-media formats (PDF,
 * Office documents, RAW formats other than DNG).
 */

const ORIENTATION_TAG = 0x0112;

function ascii(b: Uint8Array, at: number, len: number): string {
    let s = "";
    for (let i = 0; i < len && at + i < b.length; i++) {
        s += String.fromCharCode(b[at + i]);
    }
    return s;
}

function dv(b: Uint8Array): DataView {
    return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

/** Orientation (2..8; 1 and unknown give null) from a TIFF header at `base`. */
function tiffOrientation(b: Uint8Array, base: number): number | null {
    if (base < 0 || base + 8 > b.length) return null;
    const le = b[base] === 0x49 && b[base + 1] === 0x49;
    if (!le && !(b[base] === 0x4d && b[base + 1] === 0x4d)) return null;
    const v = dv(b);
    if (v.getUint16(base + 2, le) !== 42) return null;
    const ifd = base + v.getUint32(base + 4, le);
    if (ifd + 2 > b.length) return null;
    const n = v.getUint16(ifd, le);
    for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return null;
        if (v.getUint16(e, le) === ORIENTATION_TAG) {
            const o = v.getUint16(e + 8, le);
            return o >= 2 && o <= 8 ? o : null;
        }
    }
    return null;
}

/** Exif payload (with or without the "Exif\0\0" prefix) to orientation. */
function exifOrientation(b: Uint8Array): number | null {
    const base = ascii(b, 0, 6) === "Exif\0\0" ? 6 : 0;
    return tiffOrientation(b, base);
}

/** A big-endian TIFF block holding nothing but the orientation tag. */
function orientationTiff(o: number): Uint8Array {
    return new Uint8Array([
        0x4d,
        0x4d,
        0x00,
        0x2a,
        0x00,
        0x00,
        0x00,
        0x08, // header, IFD at 8
        0x00,
        0x01, // one entry
        0x01,
        0x12,
        0x00,
        0x03,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        o,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00, // no next IFD
    ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

// ---------------------------------------------------------------- JPEG

function stripJpeg(b: Uint8Array): Uint8Array | null {
    if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    const v = dv(b);
    const kept: Uint8Array[] = [];
    let exifAt = 0; // index in `kept` after any leading JFIF APP0
    let orientation: number | null = null;
    let i = 2;

    scan: while (i + 1 < b.length) {
        if (b[i] !== 0xff) return null;
        let m = b[i + 1];
        while (m === 0xff && i + 2 < b.length) {
            i++;
            m = b[i + 1];
        }
        if (m === 0xd9) {
            kept.push(b.subarray(i, i + 2)); // anything after EOI is dropped
            break;
        }
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
            kept.push(b.subarray(i, i + 2));
            i += 2;
            continue;
        }
        if (i + 4 > b.length) return null;
        const len = v.getUint16(i + 2);
        if (len < 2 || i + 2 + len > b.length) return null;
        const segEnd = i + 2 + len;
        const seg = b.subarray(i, segEnd);
        const body = i + 4;

        let keep = true;
        if (m >= 0xe0 && m <= 0xef) {
            if (m === 0xe0) keep = ascii(b, body, 5) === "JFIF\0";
            else if (m === 0xe2) keep = ascii(b, body, 12) === "ICC_PROFILE\0";
            else if (m === 0xee) keep = ascii(b, body, 5) === "Adobe";
            else keep = false;
            if (m === 0xe1 && orientation === null) {
                orientation = exifOrientation(b.subarray(body, segEnd));
            }
        } else if (m === 0xfe) {
            keep = false;
        }
        if (keep) {
            // The Exif block goes right after any leading JFIF APP0.
            if (m === 0xe0 && exifAt === kept.length) exifAt++;
            kept.push(seg);
        }

        i = segEnd;
        if (m === 0xda) {
            // Entropy-coded data: copy to the next real marker. Walking
            // marker by marker (rather than searching for FF D9) is what
            // keeps a table that happens to contain those bytes intact.
            let j = i;
            while (j + 1 < b.length) {
                const n = b[j + 1];
                if (
                    b[j] === 0xff &&
                    n !== 0x00 &&
                    n !== 0xff &&
                    !(n >= 0xd0 && n <= 0xd7)
                ) {
                    break;
                }
                j++;
            }
            kept.push(b.subarray(i, j));
            i = j;
            if (j + 1 >= b.length) break scan; // truncated file
        }
    }

    if (orientation !== null) {
        const tiff = orientationTiff(orientation);
        const seg = new Uint8Array(4 + 6 + tiff.length);
        seg[0] = 0xff;
        seg[1] = 0xe1;
        new DataView(seg.buffer).setUint16(2, 2 + 6 + tiff.length);
        seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
        seg.set(tiff, 10);
        kept.splice(exifAt, 0, seg);
    }
    return concat([b.subarray(0, 2), ...kept]);
}

// ---------------------------------------------------------------- PNG

let crcTable: Uint32Array | null = null;
function crc32(parts: Uint8Array[]): number {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++)
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTable[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (const p of parts) {
        for (let i = 0; i < p.length; i++) {
            c = crcTable[(c ^ p[i]) & 0xff] ^ (c >>> 8);
        }
    }
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const t = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)));
    const out = new Uint8Array(12 + data.length);
    const o = dv(out);
    o.setUint32(0, data.length);
    out.set(t, 4);
    out.set(data, 8);
    o.setUint32(8 + data.length, crc32([t, data]));
    return out;
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array | null {
    if (b.length < 8 || ascii(b, 1, 3) !== "PNG") return null;
    const v = dv(b);
    const out: Uint8Array[] = [b.subarray(0, 8)];
    let orientation: number | null = null;
    let inserted = false;
    let i = 8;
    while (i + 12 <= b.length) {
        const len = v.getUint32(i);
        const type = ascii(b, i + 4, 4);
        const end = i + 12 + len;
        if (end > b.length) return null;
        if (type === "eXIf" && orientation === null) {
            orientation = exifOrientation(b.subarray(i + 8, i + 8 + len));
        }
        if (type === "IDAT" && !inserted) {
            inserted = true;
            if (orientation !== null) {
                out.push(pngChunk("eXIf", orientationTiff(orientation)));
            }
        }
        if (!PNG_DROP.has(type)) out.push(b.subarray(i, end));
        i = end;
        if (type === "IEND") break;
    }
    if (!inserted) return null;
    return concat(out);
}

// ---------------------------------------------------------------- WebP

function stripWebp(b: Uint8Array): Uint8Array | null {
    if (
        b.length < 12 ||
        ascii(b, 0, 4) !== "RIFF" ||
        ascii(b, 8, 4) !== "WEBP"
    ) {
        return null;
    }
    const v = dv(b);
    const riffEnd = Math.min(b.length, 8 + v.getUint32(4, true));
    const chunks: Uint8Array[] = [];
    let orientation: number | null = null;
    let vp8x = -1; // index in chunks
    let i = 12;
    while (i + 8 <= riffEnd) {
        const type = ascii(b, i, 4);
        const len = v.getUint32(i + 4, true);
        const end = i + 8 + len + (len & 1);
        if (end > b.length) return null;
        const data = b.subarray(i + 8, i + 8 + len);
        if (type === "EXIF") {
            orientation ??= exifOrientation(data);
        } else if (type !== "XMP ") {
            if (type === "VP8X") vp8x = chunks.length;
            chunks.push(b.slice(i, end));
        }
        i = end;
    }
    let exif: Uint8Array | null = null;
    if (orientation !== null && vp8x >= 0) {
        const tiff = orientationTiff(orientation);
        exif = new Uint8Array(8 + tiff.length);
        exif.set([0x45, 0x58, 0x49, 0x46], 0);
        new DataView(exif.buffer).setUint32(4, tiff.length, true);
        exif.set(tiff, 8);
    }
    if (vp8x >= 0) {
        // Flags byte: clear "has EXIF" (0x08) and "has XMP" (0x04).
        chunks[vp8x][8] = (chunks[vp8x][8] & ~0x0c) | (exif ? 0x08 : 0);
    }
    const body = concat([...chunks, ...(exif ? [exif] : [])]);
    const out = new Uint8Array(12 + body.length);
    out.set(b.subarray(0, 12), 0);
    out.set(body, 12);
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return out;
}

// ---------------------------------------------------------------- GIF

function stripGif(b: Uint8Array): Uint8Array | null {
    if (b.length < 13 || ascii(b, 0, 3) !== "GIF") return null;
    const out: Uint8Array[] = [];
    let i = 13;
    if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
    out.push(b.subarray(0, i));

    const subBlocksEnd = (at: number): number => {
        while (at < b.length && b[at] !== 0) at += b[at] + 1;
        return at + 1;
    };
    while (i < b.length) {
        const start = i;
        if (b[i] === 0x3b) {
            out.push(b.subarray(i, i + 1));
            break;
        } else if (b[i] === 0x21) {
            const label = b[i + 1];
            const end = subBlocksEnd(i + 2);
            // XMP lives in an "XMP DataXMP" application extension.
            const xmp = label === 0xff && ascii(b, i + 3, 11) === "XMP DataXMP";
            if (end > b.length) return null;
            if (label !== 0xfe && !xmp) out.push(b.subarray(start, end));
            i = end;
        } else if (b[i] === 0x2c) {
            let p = i + 10;
            if (b[i + 9] & 0x80) p += 3 * (1 << ((b[i + 9] & 7) + 1));
            const end = subBlocksEnd(p + 1);
            if (end > b.length) return null;
            out.push(b.subarray(start, end));
            i = end;
        } else {
            return null;
        }
    }
    return concat(out);
}

// ---------------------------------------------------------------- TIFF / DNG

const TIFF_TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8, 4];
// XMP, IPTC, Photoshop image resources.
const TIFF_BLOB_TAGS = new Set([700, 33723, 34377]);
const TIFF_GPS_IFD = 0x8825;
const TIFF_EXIF_IFD = 0x8769;
const TIFF_SUB_IFDS = new Set([0xa005]); // interoperability, inside Exif

/** Zero an IFD, its out-of-line values and the IFDs it points at. */
function zeroIfd(
    b: Uint8Array,
    v: DataView,
    le: boolean,
    at: number,
    depth: number,
) {
    if (depth > 4 || at <= 0 || at + 2 > b.length) return;
    const n = v.getUint16(at, le);
    if (at + 2 + n * 12 > b.length) return;
    for (let k = 0; k < n; k++) {
        const e = at + 2 + k * 12;
        const tag = v.getUint16(e, le);
        const size =
            (TIFF_TYPE_SIZE[v.getUint16(e + 2, le)] ?? 1) *
            v.getUint32(e + 4, le);
        if (TIFF_SUB_IFDS.has(tag))
            zeroIfd(b, v, le, v.getUint32(e + 8, le), depth + 1);
        if (size > 4) {
            const off = v.getUint32(e + 8, le);
            if (off + size <= b.length) b.fill(0, off, off + size);
        }
    }
    b.fill(0, at, at + 2 + n * 12); // entry count 0 = a valid, empty IFD
}

function scrubTiff(b: Uint8Array): boolean {
    if (b.length < 8) return false;
    const le = b[0] === 0x49 && b[1] === 0x49;
    if (!le && !(b[0] === 0x4d && b[1] === 0x4d)) return false;
    const v = dv(b);
    if (v.getUint16(2, le) !== 42) return false; // BigTIFF etc.: leave alone
    const ifd0 = v.getUint32(4, le);
    if (ifd0 + 2 > b.length) return false;
    const n = v.getUint16(ifd0, le);
    if (ifd0 + 2 + n * 12 > b.length) return false;
    for (let k = 0; k < n; k++) {
        const e = ifd0 + 2 + k * 12;
        const tag = v.getUint16(e, le);
        if (tag === TIFF_GPS_IFD || tag === TIFF_EXIF_IFD) {
            zeroIfd(b, v, le, v.getUint32(e + 8, le), 0);
        } else if (TIFF_BLOB_TAGS.has(tag)) {
            const size =
                (TIFF_TYPE_SIZE[v.getUint16(e + 2, le)] ?? 1) *
                v.getUint32(e + 4, le);
            if (size > 4) {
                const off = v.getUint32(e + 8, le);
                if (off + size <= b.length) b.fill(0, off, off + size);
            } else {
                b.fill(0, e + 8, e + 12);
            }
        }
    }
    return true;
}

// ---------------------------------------------------------------- ISO-BMFF

const MAX_BOX_BYTES = 64 * 1024 * 1024;
const MAX_TOP_LEVEL = 4096;

interface Patch {
    at: number;
    data: Uint8Array;
}

interface Box {
    type: string;
    start: number; // absolute
    size: number;
    headerLen: number;
}

/** Child boxes of `buf[from, to)`, or null if the layout is not sane. */
function childBoxes(buf: Uint8Array, from: number, to: number): Box[] | null {
    const v = dv(buf);
    const boxes: Box[] = [];
    let at = from;
    while (at < to) {
        if (to - at < 8 || boxes.length > MAX_TOP_LEVEL) return null;
        let size = v.getUint32(at);
        let headerLen = 8;
        if (size === 1) {
            if (to - at < 16) return null;
            const big = v.getBigUint64(at + 8);
            if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
            size = Number(big);
            headerLen = 16;
        } else if (size === 0) {
            size = to - at;
        }
        if (size < headerLen || at + size > to) return null;
        boxes.push({ type: ascii(buf, at + 4, 4), start: at, size, headerLen });
        at += size;
    }
    return boxes;
}

function blank(buf: Uint8Array, box: Box) {
    buf.set([0x66, 0x72, 0x65, 0x65], box.start + 4); // "free"
    buf.fill(0, box.start + box.headerLen, box.start + box.size);
}

const BLANK_BOXES = new Set([
    "©xyz",
    "loci",
    "smta",
    "gps ",
    "GPS ",
    "xyz ",
    "XMP_",
    "uuid",
]);
const DESCEND = new Set(["moov", "trak", "udta"]);
const GPS_KEY = /location|gps|geo|coordinate/i;

/** meta box layout: ISO has version/flags first, QuickTime does not. */
function metaChildStart(buf: Uint8Array, box: Box): number {
    const body = box.start + box.headerLen;
    return ascii(buf, body + 4, 4) === "hdlr" ? body : body + 4;
}

function scrubMetaKeys(buf: Uint8Array, kids: Box[]) {
    const keys = kids.find((k) => k.type === "keys");
    const ilst = kids.find((k) => k.type === "ilst");
    if (!keys || !ilst) return;
    const v = dv(buf);
    const drop = new Set<number>();
    let at = keys.start + keys.headerLen + 8;
    const count = v.getUint32(keys.start + keys.headerLen + 4);
    for (let idx = 1; idx <= count && at + 8 <= keys.start + keys.size; idx++) {
        const size = v.getUint32(at);
        if (size < 8) break;
        if (GPS_KEY.test(ascii(buf, at + 8, size - 8))) drop.add(idx);
        at += size;
    }
    if (drop.size === 0) return;
    const items = childBoxes(
        buf,
        ilst.start + ilst.headerLen,
        ilst.start + ilst.size,
    );
    for (const item of items ?? []) {
        if (drop.has(v.getUint32(item.start + 4))) {
            blank(buf, item);
        }
    }
}

/** HEIF Exif / XMP items: blank their data (wherever it lives) and mark the
 *  item type unknown. Returns file-level patches for data outside `buf`. */
function scrubHeifItems(
    buf: Uint8Array,
    kids: Box[],
    fileSize: number,
): Patch[] {
    const iinf = kids.find((k) => k.type === "iinf");
    const iloc = kids.find((k) => k.type === "iloc");
    if (!iinf || !iloc) return [];
    const v = dv(buf);
    const ids = new Set<number>();

    const iinfVer = buf[iinf.start + iinf.headerLen];
    const first = iinf.start + iinf.headerLen + 4 + (iinfVer === 0 ? 2 : 4);
    for (const infe of childBoxes(buf, first, iinf.start + iinf.size) ?? []) {
        if (infe.type !== "infe") continue;
        const p = infe.start + infe.headerLen;
        const ver = buf[p];
        if (ver < 2) continue;
        const idLen = ver === 2 ? 2 : 4;
        const id = ver === 2 ? v.getUint16(p + 4) : v.getUint32(p + 4);
        const typeAt = p + 4 + idLen + 2;
        const type = ascii(buf, typeAt, 4);
        let hit = type === "Exif";
        if (type === "mime") {
            // name\0 content_type\0
            const rest = ascii(
                buf,
                typeAt + 4,
                infe.start + infe.size - typeAt - 4,
            );
            hit = /rdf\+xml/i.test(rest);
        }
        if (hit) {
            ids.add(id);
            buf.set([0x66, 0x72, 0x65, 0x65], typeAt); // "free"
        }
    }
    if (ids.size === 0) return [];

    const patches: Patch[] = [];
    const idat = kids.find((k) => k.type === "idat");
    const p = iloc.start + iloc.headerLen;
    const ver = buf[p];
    const sizes = v.getUint16(p + 4);
    const offSize = sizes >> 12;
    const lenSize = (sizes >> 8) & 15;
    const baseSize = (sizes >> 4) & 15;
    const idxSize = ver === 1 || ver === 2 ? sizes & 15 : 0;
    let at = p + 6;
    const readN = (n: number): number => {
        let x = 0;
        for (let k = 0; k < n; k++) x = x * 256 + buf[at + k];
        at += n;
        return x;
    };
    const count = ver < 2 ? readN(2) : readN(4);
    for (let k = 0; k < count && at < iloc.start + iloc.size; k++) {
        const id = ver < 2 ? readN(2) : readN(4);
        const method = ver === 1 || ver === 2 ? readN(2) & 15 : 0;
        readN(2); // data reference index
        const base = readN(baseSize);
        const extents = readN(2);
        for (let e = 0; e < extents; e++) {
            if (idxSize) readN(idxSize);
            const off = readN(offSize);
            const len = readN(lenSize);
            if (!ids.has(id) || len === 0) continue;
            if (method === 0 && base + off + len <= fileSize) {
                patches.push({ at: base + off, data: new Uint8Array(len) });
            } else if (method === 1 && idat) {
                const s = idat.start + idat.headerLen + base + off;
                if (s + len <= idat.start + idat.size) buf.fill(0, s, s + len);
            }
        }
    }
    return patches;
}

function scrubBoxes(
    buf: Uint8Array,
    from: number,
    to: number,
    base: number,
    fileSize: number,
    patches: Patch[],
): boolean {
    const boxes = childBoxes(buf, from, to);
    if (!boxes) return false;
    let changed = false;
    for (const box of boxes) {
        if (BLANK_BOXES.has(box.type)) {
            // A uuid box is blanked only when it is XMP; other uuids are
            // vendor payloads we cannot judge.
            if (box.type === "uuid") {
                const xmp = [
                    0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71,
                    0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac,
                ];
                const id = buf.subarray(
                    box.start + box.headerLen,
                    box.start + box.headerLen + 16,
                );
                if (!xmp.every((x, i) => id[i] === x)) continue;
            }
            blank(buf, box);
            changed = true;
        } else if (DESCEND.has(box.type)) {
            changed =
                scrubBoxes(
                    buf,
                    box.start + box.headerLen,
                    box.start + box.size,
                    base,
                    fileSize,
                    patches,
                ) || changed;
        } else if (box.type === "meta") {
            const start = metaChildStart(buf, box);
            const kids = childBoxes(buf, start, box.start + box.size);
            if (!kids) continue;
            patches.push(...scrubHeifItems(buf, kids, fileSize));
            scrubMetaKeys(buf, kids);
            for (const k of kids) if (k.type === "xml ") blank(buf, k);
            changed = true; // item types / keys may have been edited
        }
    }
    return changed;
}

async function stripIsoBmff(file: File): Promise<File | null> {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length < 12 || ascii(head, 4, 4) !== "ftyp") return null;

    // Top-level layout, header by header, so media is never read.
    const patches: Patch[] = [];
    let at = 0;
    let n = 0;
    while (at < file.size && n++ < MAX_TOP_LEVEL) {
        const h = new DataView(
            await file.slice(at, Math.min(at + 16, file.size)).arrayBuffer(),
        );
        if (h.byteLength < 8) return null;
        let size = h.getUint32(0);
        let headerLen = 8;
        if (size === 1) {
            if (h.byteLength < 16) return null;
            const big = h.getBigUint64(8);
            if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
            size = Number(big);
            headerLen = 16;
        } else if (size === 0) {
            size = file.size - at;
        }
        if (size < headerLen || at + size > file.size) return null;
        const type = String.fromCharCode(
            h.getUint8(4),
            h.getUint8(5),
            h.getUint8(6),
            h.getUint8(7),
        );
        if (
            (type === "moov" ||
                type === "meta" ||
                type === "uuid" ||
                type === "XMP_") &&
            size <= MAX_BOX_BYTES
        ) {
            const bytes = new Uint8Array(
                await file.slice(at, at + size).arrayBuffer(),
            );
            const wrapper = new Uint8Array(bytes.length);
            wrapper.set(bytes);
            // Scrub the box as a one-child list so its own type is checked too.
            const itemPatches: Patch[] = [];
            const changed = scrubBoxes(
                wrapper,
                0,
                wrapper.length,
                at,
                file.size,
                itemPatches,
            );
            if (changed) patches.push({ at, data: wrapper });
            patches.push(...itemPatches);
        }
        at += size;
    }
    if (patches.length === 0) return null;

    // Assemble: patches are non-overlapping by construction, apply in order.
    patches.sort((a, b) => a.at - b.at);
    const parts: BlobPart[] = [];
    let pos = 0;
    for (const p of patches) {
        if (p.at < pos) continue; // an Exif item inside a patched box: skip
        parts.push(file.slice(pos, p.at), p.data as BlobPart);
        pos = p.at + p.data.length;
    }
    parts.push(file.slice(pos));
    const out = new File(parts, file.name, {
        type: file.type,
        lastModified: file.lastModified,
    });
    return out.size === file.size ? out : null;
}

// ---------------------------------------------------------------- entry

function rebuild(file: File, bytes: Uint8Array): File {
    return new File([bytes as BlobPart], file.name, {
        type: file.type,
        lastModified: file.lastModified,
    });
}

/**
 * `file` without location and other identifying metadata (see the top of this
 * file), keeping only the Exif orientation. Returns `file` itself when there
 * is nothing to strip, the format is not recognised, or anything fails.
 */
export async function stripLocationMetadata(file: File): Promise<File> {
    try {
        const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const sig = ascii(head, 0, 4);
        if (head[0] === 0xff && head[1] === 0xd8) {
            const out = stripJpeg(new Uint8Array(await file.arrayBuffer()));
            return out ? rebuild(file, out) : file;
        }
        if (head[0] === 0x89 && sig.slice(1) === "PNG") {
            const out = stripPng(new Uint8Array(await file.arrayBuffer()));
            return out ? rebuild(file, out) : file;
        }
        if (sig === "GIF8") {
            const out = stripGif(new Uint8Array(await file.arrayBuffer()));
            return out ? rebuild(file, out) : file;
        }
        if (sig === "RIFF" && ascii(head, 8, 4) === "WEBP") {
            const out = stripWebp(new Uint8Array(await file.arrayBuffer()));
            return out ? rebuild(file, out) : file;
        }
        if (
            (head[0] === 0x49 &&
                head[1] === 0x49 &&
                head[2] === 42 &&
                head[3] === 0) ||
            (head[0] === 0x4d &&
                head[1] === 0x4d &&
                head[2] === 0 &&
                head[3] === 42)
        ) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return scrubTiff(bytes) ? rebuild(file, bytes) : file;
        }
        if (ascii(head, 4, 4) === "ftyp") {
            return (await stripIsoBmff(file)) ?? file;
        }
        return file;
    } catch (err) {
        console.warn("Metadata stripping failed", err);
        return file;
    }
}
