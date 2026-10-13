/**
 * Move an MP4's index to the front so it can play while it downloads.
 *
 * Phones, screen recorders and most encoders write the `moov` box (the index a
 * player needs before it can decode anything) AFTER the `mdat` box holding the
 * media. A receiver then has to download the whole file before the first frame,
 * and a homeserver that ignores `Range` requests leaves no way around that. The
 * fix is the one `qt-faststart` and `ffmpeg -movflags +faststart` apply: put
 * `moov` ahead of `mdat`. Everything inside `mdat` stays byte-for-byte as it
 * was; the only edit is that the chunk offsets in `moov` (`stco` / `co64`),
 * which are absolute file positions, all move by the size of `moov`.
 *
 * It works on file slices, so only the (small) `moov` is read into memory, never
 * the media. It is deliberately conservative: anything it does not fully
 * understand, or any result that does not check out, returns the ORIGINAL file
 * untouched. A video sent as-is is merely slow to start; a mangled one would not
 * play at all.
 */

interface Box {
    type: string;
    start: number;
    size: number;
    headerLen: number;
    /** The size field said "to the end of the file". */
    toEof: boolean;
}

// A real file has a handful of top-level boxes; a pathological one could make
// us read a header per few bytes, so cap how many we are willing to walk.
const MAX_TOP_LEVEL_BOXES = 4096;
// moov is an index, not media; an enormous one is not a file we should rewrite
// in memory.
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const CONTAINERS = new Set(["trak", "mdia", "minf", "stbl"]);
const U32_MAX = 0xffffffff;

function fourcc(view: DataView, at: number): string {
    return String.fromCharCode(
        view.getUint8(at),
        view.getUint8(at + 1),
        view.getUint8(at + 2),
        view.getUint8(at + 3),
    );
}

/** Walk the top-level boxes of `file`, or null if it is not a clean MP4. */
async function readTopLevel(file: Blob): Promise<Box[] | null> {
    const boxes: Box[] = [];
    let at = 0;
    while (at < file.size) {
        if (boxes.length >= MAX_TOP_LEVEL_BOXES) return null;
        const head = new DataView(
            await file.slice(at, Math.min(at + 16, file.size)).arrayBuffer(),
        );
        if (head.byteLength < 8) return null;
        let size = head.getUint32(0);
        let headerLen = 8;
        let toEof = false;
        if (size === 1) {
            if (head.byteLength < 16) return null;
            const big = head.getBigUint64(8);
            if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
            size = Number(big);
            headerLen = 16;
        } else if (size === 0) {
            size = file.size - at;
            toEof = true;
        }
        if (size < headerLen || at + size > file.size) return null;
        boxes.push({
            type: fourcc(head, 4),
            start: at,
            size,
            headerLen,
            toEof,
        });
        at += size;
    }
    return boxes;
}

/**
 * Add `delta` to every chunk offset in a `moov` box, in place. Returns the
 * patched offsets, or null if the box is not shaped the way we expect (or an
 * offset would not fit its field).
 */
function patchChunkOffsets(moov: Uint8Array, delta: number): number[] | null {
    const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const patched: number[] = [];
    let ok = true;

    const walk = (from: number, to: number) => {
        let at = from;
        while (ok && at < to) {
            if (to - at < 8) return void (ok = false);
            let size = view.getUint32(at);
            let headerLen = 8;
            if (size === 1) {
                if (to - at < 16) return void (ok = false);
                const big = view.getBigUint64(at + 8);
                if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
                    return void (ok = false);
                }
                size = Number(big);
                headerLen = 16;
            } else if (size === 0) {
                size = to - at;
            }
            if (size < headerLen || at + size > to) return void (ok = false);
            const type = fourcc(view, at + 4);
            const body = at + headerLen;
            const end = at + size;

            if (type === "mvex") {
                // Fragmented: offsets live in moof boxes, not here.
                return void (ok = false);
            }
            if (CONTAINERS.has(type)) {
                walk(body, end);
            } else if (type === "stco" || type === "co64") {
                const wide = type === "co64";
                if (end - body < 8) return void (ok = false);
                const count = view.getUint32(body + 4);
                const entry = wide ? 8 : 4;
                if (count * entry > end - body - 8) return void (ok = false);
                for (let i = 0; i < count; i++) {
                    const pos = body + 8 + i * entry;
                    if (wide) {
                        const next = view.getBigUint64(pos) + BigInt(delta);
                        if (next > BigInt(Number.MAX_SAFE_INTEGER)) {
                            return void (ok = false);
                        }
                        view.setBigUint64(pos, next);
                        patched.push(Number(next));
                    } else {
                        const next = view.getUint32(pos) + delta;
                        // A 32-bit table that would overflow would need
                        // converting to co64; not worth the risk here.
                        if (next > U32_MAX) return void (ok = false);
                        view.setUint32(pos, next);
                        patched.push(next);
                    }
                }
            }
            at = end;
        }
    };
    walk(8, moov.byteLength);
    return ok ? patched : null;
}

/**
 * The same MP4 with `moov` ahead of `mdat`, or `file` itself when it is
 * already that way, is not an MP4 we fully understand, or anything about the
 * result fails its checks.
 */
export async function faststartMp4(file: File): Promise<File> {
    try {
        return (await rewrite(file)) ?? file;
    } catch {
        return file;
    }
}

async function rewrite(file: File): Promise<File | null> {
    const boxes = await readTopLevel(file);
    if (!boxes || boxes.length < 2 || boxes[0].type !== "ftyp") return null;

    // Fragmented files, or HEIF-style top-level meta (whose iloc holds file
    // offsets we do not patch), are left alone.
    if (boxes.some((b) => b.type === "moof" || b.type === "meta")) return null;
    const moovs = boxes.filter((b) => b.type === "moov");
    const mdats = boxes.filter((b) => b.type === "mdat");
    if (moovs.length !== 1 || mdats.length === 0) return null;
    const moov = moovs[0];
    if (moov.size > MAX_MOOV_BYTES) return null;

    // Only the "all media, then the index" layout. With media on both sides of
    // the index the offsets would not all shift by the same amount.
    if (mdats.some((m) => m.start > moov.start)) return null;
    const firstMdat = mdats[0];
    if (moov.start < firstMdat.start) return null; // already faststart

    const bytes = new Uint8Array(
        await file.slice(moov.start, moov.start + moov.size).arrayBuffer(),
    );
    if (moov.toEof) {
        // "To the end of the file" stops meaning that once moov is not last.
        if (moov.size > U32_MAX) return null;
        new DataView(bytes.buffer).setUint32(0, moov.size);
    }
    const delta = moov.size;
    const offsets = patchChunkOffsets(bytes, delta);
    if (!offsets || offsets.length === 0) return null;

    // Every chunk must land inside an mdat in the NEW layout, which is what
    // makes this safe: a file whose offsets point anywhere else (external
    // data, an unexpected layout) fails here and is sent as it was.
    const inMdat = (offset: number) =>
        mdats.some(
            (m) =>
                offset >= m.start + m.headerLen + delta &&
                offset < m.start + m.size + delta,
        );
    if (!offsets.every(inMdat)) return null;

    const out = new File(
        [
            file.slice(0, firstMdat.start),
            bytes,
            file.slice(firstMdat.start, moov.start),
            file.slice(moov.start + moov.size),
        ],
        file.name,
        { type: file.type, lastModified: file.lastModified },
    );
    return out.size === file.size ? out : null;
}
