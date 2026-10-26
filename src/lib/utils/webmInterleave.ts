import { readId, readSize } from "./webmProbe";

/**
 * Put the blocks of each WebM Cluster in timestamp order, on the fly.
 *
 * Chromium's MediaSource rejects a Cluster whose block timestamps ever go
 * backwards, across tracks as well as within one ("Got a block with a
 * timecode before the previous block"). Muxers write blocks in decode order,
 * rounding each track's time on its own, so an audio+video WebM (anything
 * ffmpeg makes with Opus or Vorbis) routinely has a 101 ms audio block just
 * before a 100 ms video frame, and fails to play at all.
 *
 * So each Cluster is held until it is complete and, when its blocks are out
 * of order, written back with them stably sorted by timestamp. Each track's
 * own order is kept, and the Cluster stays the same size, so offsets into the
 * stream (seekIndex.ts) are unaffected. Everything outside Clusters passes
 * straight through. Anything this can't walk is passed through unchanged
 * from then on, which is no worse than before.
 */

const ID_SEGMENT = 0x18538067;
const ID_CLUSTER = 0x1f43b675;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_CRC32 = 0xbf;
/** Segment children: one of these ends a Cluster of unknown size. */
const LEVEL1 = new Set([
    ID_CLUSTER,
    0x114d9b74, // SeekHead
    0x1549a966, // Info
    0x1654ae6b, // Tracks
    0x1c53bb6b, // Cues
    0x1043a770, // Chapters
    0x1941a469, // Attachments
    0x1254c367, // Tags
]);
// Largest Cluster child held whole. Nothing that size is one frame.
const MAX_CHILD = 64 * 1024 * 1024;

interface Child {
    bytes: Uint8Array;
    /** Block timestamp relative to the Cluster; null for anything else. */
    time: number | null;
    crc: boolean;
}

interface OpenCluster {
    head: Uint8Array;
    /** Body bytes still to come, or null for a Cluster of unknown size. */
    left: number | null;
    children: Child[];
}

/** The signed 16-bit timestamp of the Block whose body starts at b[p]. */
function blockTime(b: Uint8Array, p: number, end: number): number | null {
    const track = readSize(b, p);
    if (!track || p + track.length + 2 > end) return null;
    const q = p + track.length;
    return (((b[q] << 8) | b[q + 1]) << 16) >> 16;
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

/** See the file header. push() bytes, end() at the end of the stream. */
export class WebmInterleaver {
    private tail: Uint8Array = new Uint8Array(0);
    /** Bytes still to pass straight through (the rest of a big element). */
    private pass = 0;
    private broken = false;
    private cluster: OpenCluster | null = null;

    push(chunk: Uint8Array): Uint8Array[] {
        if (this.broken) return [chunk];
        const out: Uint8Array[] = [];
        if (this.pass > 0) {
            const n = Math.min(this.pass, chunk.length);
            out.push(chunk.subarray(0, n));
            this.pass -= n;
            chunk = chunk.subarray(n);
        }
        this.tail = concat([this.tail, chunk]);
        this.scan(out);
        return out;
    }

    end(): Uint8Array[] {
        if (this.broken) return [];
        const out: Uint8Array[] = [];
        if (this.cluster) this.finish(out);
        if (this.tail.length) out.push(this.tail);
        this.tail = new Uint8Array(0);
        return out;
    }

    private scan(out: Uint8Array[]) {
        const b = this.tail;
        let p = 0;
        for (;;) {
            if (this.cluster?.left === 0) this.finish(out);
            const id = readId(b, p);
            const size = id && readSize(b, p + id.length);
            if (!id || !size) {
                // Short, unless there were plenty of bytes to read it from.
                if (b.length - p >= 12) return this.giveUp(out, b, p);
                break;
            }
            const body = p + id.length + size.length;
            const c = this.cluster;
            if (c && !(c.left === null && LEVEL1.has(id.id))) {
                if (size.size === null || size.size > MAX_CHILD)
                    return this.giveUp(out, b, p);
                const end = body + size.size;
                if (end > b.length) break;
                let time: number | null = null;
                if (id.id === ID_SIMPLE_BLOCK) time = blockTime(b, body, end);
                else if (id.id === ID_BLOCK_GROUP) {
                    for (let q = body; q < end;) {
                        const cid = readId(b, q);
                        const cs = cid && readSize(b, q + cid.length);
                        if (!cid || !cs || cs.size === null) break;
                        const cb = q + cid.length + cs.length;
                        if (cid.id === ID_BLOCK) {
                            time = blockTime(b, cb, cb + cs.size);
                            break;
                        }
                        q = cb + cs.size;
                    }
                }
                c.children.push({
                    bytes: b.slice(p, end),
                    time,
                    crc: id.id === ID_CRC32,
                });
                if (c.left !== null) {
                    c.left -= end - p;
                    if (c.left < 0) return this.giveUp(out, b, end);
                }
                p = end;
                continue;
            }
            if (c) this.finish(out);
            if (id.id === ID_CLUSTER) {
                this.cluster = {
                    head: b.slice(p, body),
                    left: size.size,
                    children: [],
                };
                p = body;
                continue;
            }
            if (id.id === ID_SEGMENT || size.size === null) {
                // Entered: its children come through this loop.
                out.push(b.slice(p, body));
                p = body;
                continue;
            }
            const avail = Math.min(size.size, b.length - body);
            out.push(b.slice(p, body + avail));
            if (avail < size.size) {
                this.pass = size.size - avail;
                p = b.length;
                break;
            }
            p = body + size.size;
        }
        this.tail = b.slice(p);
    }

    private finish(out: Uint8Array[]) {
        const c = this.cluster!;
        this.cluster = null;
        const blocks = c.children.filter((ch) => ch.time !== null);
        const ordered = blocks.every(
            (ch, i) => i === 0 || ch.time! >= blocks[i - 1].time!,
        );
        // A CRC-32 covers the children in their written order.
        if (ordered || c.children.some((ch) => ch.crc)) {
            out.push(concat([c.head, ...c.children.map((ch) => ch.bytes)]));
            return;
        }
        // Array.prototype.sort is stable: each track keeps its own order.
        const sorted = [...blocks].sort((x, y) => x.time! - y.time!);
        const rest = c.children.filter((ch) => ch.time === null);
        out.push(
            concat([c.head, ...[...rest, ...sorted].map((ch) => ch.bytes)]),
        );
    }

    private giveUp(out: Uint8Array[], b: Uint8Array, p: number) {
        this.broken = true;
        if (this.cluster) {
            const c = this.cluster;
            this.cluster = null;
            out.push(concat([c.head, ...c.children.map((ch) => ch.bytes)]));
        }
        out.push(b.subarray(p));
        this.tail = new Uint8Array(0);
    }
}
