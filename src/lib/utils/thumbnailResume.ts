/**
 * Resuming a download from a thumbnail prefix: a JPEG whose first bytes Zam
 * already holds (the progressive scans that make up its thumbnail) only needs
 * the rest of the file from the last AES block boundary at or before the
 * prefix's end. This module is the SDK-free core of that: the offset, the
 * Content-Range check, and the reader that yields the whole plaintext.
 *
 * The overlap between the prefix and the first fetched block is checked
 * against the bytes fetched, so a prefix that is not the start of this file
 * fails here. For an encrypted file the SHA-256 in finish() covers the
 * rebuilt ciphertext prefix too, so a wrong prefix fails there as well. A
 * failure rejects the read; the caller then does a plain full download.
 */

import {
    createStreamDecryptor,
    type EncryptedFileInfo,
} from "./decryptAttachment";

/** What the resume reader needs from a body: a ReadableStream's reader. */
export interface ByteReader {
    read(): Promise<ReadableStreamReadResult<Uint8Array>>;
}

const AES_BLOCK = 16;

/**
 * The byte to start the ranged request at for a prefix of `prefixLength`
 * bytes: the last AES block boundary at or before its end. The bytes between
 * it and the prefix's end are re-fetched and checked against the prefix. Zero
 * means nothing can be skipped (a prefix under one block).
 */
export function resumeOffset(prefixLength: number): number {
    return prefixLength - (prefixLength % AES_BLOCK);
}

/** The first byte of a `Content-Range: bytes a-b/total` header, or null. */
export function contentRangeStart(header: string | null): number | null {
    const m = /^\s*bytes\s+(\d+)-(\d+)\/(\d+|\*)\s*$/i.exec(header ?? "");
    if (!m) return null;
    const start = Number(m[1]);
    return Number.isSafeInteger(start) ? start : null;
}

/** Equal-length byte compare. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

/**
 * Checks the bytes the body yields from `offset` against the prefix's tail
 * (`prefix[offset..n)`, under one AES block). Chunks are held until that many
 * bytes have arrived, then released in one piece. A short file is an error.
 */
class OverlapGuard {
    private readonly expected: Uint8Array;
    private held: Uint8Array[] = [];
    private heldLength = 0;
    private checked: boolean;

    constructor(expected: Uint8Array) {
        this.expected = expected;
        this.checked = expected.length === 0;
    }

    /** The bytes to pass on, or null while the overlap is still gathering. */
    feed(chunk: Uint8Array): Uint8Array | null {
        if (this.checked) return chunk;
        this.held.push(chunk);
        this.heldLength += chunk.length;
        if (this.heldLength < this.expected.length) return null;
        const all = new Uint8Array(this.heldLength);
        let at = 0;
        for (const c of this.held) {
            all.set(c, at);
            at += c.length;
        }
        this.held = [];
        if (!bytesEqual(all.subarray(0, this.expected.length), this.expected)) {
            throw new Error("Image does not match its thumbnail");
        }
        this.checked = true;
        return all;
    }

    /** Throws when the file ended before the overlap was checked. */
    end(): void {
        if (!this.checked)
            throw new Error("Image is shorter than its thumbnail");
    }
}

export interface ResumeReaderOptions {
    /** The file's first bytes, as held (the thumbnail's plaintext). */
    prefix: Uint8Array;
    /** `content.file` of an encrypted image; omit for a plain one. */
    decrypt?: EncryptedFileInfo;
    subtle?: SubtleCrypto;
}

/**
 * A reader over the whole plaintext of a file whose bytes from
 * `resumeOffset(prefix.length)` on come from `body` (ciphertext when `decrypt`
 * is set, plaintext otherwise). It yields the held prefix up to that offset
 * first, then the body's plaintext, so a consumer sees the file from byte 0.
 *
 * Plaintext from before the final read is UNVERIFIED for an encrypted file,
 * as with every streamed download: the final read runs the hash check and
 * rejects on a mismatch.
 */
export async function resumeBodyReader(
    body: ByteReader,
    opts: ResumeReaderOptions,
): Promise<ByteReader> {
    const n = opts.prefix.length;
    const offset = resumeOffset(n);
    const decryptor = opts.decrypt
        ? await createStreamDecryptor(
              opts.decrypt,
              opts.subtle ?? globalThis.crypto.subtle,
              {
                  offset,
                  plaintext: opts.prefix.slice(0, offset),
              },
          )
        : null;
    const guard = new OverlapGuard(opts.prefix.slice(offset, n));
    let head: Uint8Array | null =
        offset > 0 ? opts.prefix.slice(0, offset) : null;
    let finished = false;
    return {
        async read() {
            if (head) {
                const first = head;
                head = null;
                return { done: false, value: first };
            }
            while (!finished) {
                const r = await body.read();
                if (r.done) {
                    finished = true;
                    const tail = decryptor
                        ? await decryptor.finish()
                        : new Uint8Array(0);
                    const last = guard.feed(tail);
                    guard.end();
                    if (last && last.length) {
                        return { done: false, value: last };
                    }
                    break;
                }
                const out = decryptor ? await decryptor.push(r.value) : r.value;
                const pass = guard.feed(out);
                if (pass && pass.length) return { done: false, value: pass };
            }
            return { done: true, value: undefined };
        },
    };
}
