/**
 * Zam-only direct file transfer: the parts with no Matrix or LiveKit in them.
 *
 * A file too large to upload moves through a throwaway LiveKit room instead of
 * the media repo. Nothing announces that room: there is no MatrixRTC membership,
 * only a `file_offer` room event other clients ignore and Olm to-device
 * messages between the two devices.
 *
 * The SFU can drop data for a slow receiver and sees everything sent through
 * it, so each block is sealed with AES-GCM under a key only the two devices
 * hold, and every block is checked against a keyed hash tree before it is
 * written. The receiver acknowledges a block once it is on disk; that
 * acknowledgement is the flow control, the retransmission and the resume.
 */

export const FILE_OFFER_EVENT = "moe.crafty.matrix.file_offer";

const TO_DEVICE_PREFIX = "moe.crafty.matrix.file_transfer";
export const FILE_REQUEST_TYPE = `${TO_DEVICE_PREFIX}.request`;
/** From the receiver while the sender hashes the file or waits for a slot. */
export const FILE_PREPARING_TYPE = `${TO_DEVICE_PREFIX}.preparing`;
export const FILE_ACCEPT_TYPE = `${TO_DEVICE_PREFIX}.accept`;
export const FILE_REFUSE_TYPE = `${TO_DEVICE_PREFIX}.refuse`;
/** From the receiver: the SDP answer of a direct data channel. */
export const FILE_ANSWER_TYPE = `${TO_DEVICE_PREFIX}.answer`;
/** Either way: trickled ICE candidates of a direct data channel. */
export const FILE_CANDIDATES_TYPE = `${TO_DEVICE_PREFIX}.candidates`;
export const FILE_ACK_TYPE = `${TO_DEVICE_PREFIX}.ack`;
export const FILE_DONE_TYPE = `${TO_DEVICE_PREFIX}.done`;
export const FILE_CANCEL_TYPE = `${TO_DEVICE_PREFIX}.cancel`;
/** From the receiver to its own user's other cross-signed devices. */
export const FILE_ACCEPTED_TYPE = `${TO_DEVICE_PREFIX}.accepted`;

/** LiveKit data topic of the block and acknowledgement packets. */
export const FILE_DATA_TOPIC = "zam.file.v1";

export const FILE_TRANSFER_VERSION = 2;
export const BLOCK_SIZE = 1024 * 1024;
/** LiveKit's reliable data packets stop at about 15 KB. */
export const PART_SIZE = 14_000;
/** The largest part a data channel carries, which the decoder accepts. */
export const MAX_DATA_PAYLOAD = 61_440;
/** Largest offer accepted: bounds the receiver's table of block hashes. */
export const MAX_FILE_SIZE = 2 ** 40;
export const OFFER_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** AAD prefix of sealed blocks (the stable form is `m.file_transfer.v2`). */
export const AAD_PREFIX = "zam-file-v2";
/** HKDF info of the packet MAC key (stable: `m.file_transfer.v2 mac`). */
export const MAC_INFO = "zam-file-v2 mac";

const IV_BYTES = 12;
const TAG_BYTES = 16;
export const LEAF_BYTES = 32;
const DATA_PACKET = 1;
const ACK_PACKET = 2;
const LEAVES_PACKET = 3;
const DATA_HEADER_BYTES = 9;
const ACK_HEADER_BYTES = 7;
const LEAVES_HEADER_BYTES = 7;
/** Blocks one acknowledgement can list beyond the contiguous run. */
export const MAX_ACK_BLOCKS = 128;
/** Leaves one leaves packet carries: 7 + 437 * 32 stays under PART_SIZE. */
export const MAX_LEAVES_PER_PACKET = 437;
/** Bytes of the packet trailer: 8-byte sequence number and 16-byte tag. */
export const MAC_TRAILER_BYTES = 24;
const MAC_TAG_BYTES = 16;
const SEQ_BYTES = 8;

export function isFileOfferEventType(type: string): boolean {
    return type === FILE_OFFER_EVENT;
}

export interface FileOffer {
    transferId: string;
    name: string;
    size: number;
    mimetype: string;
    senderDevice: string;
    expiresTs: number;
    relayOnly: boolean;
}

/** An offer's content, or null when it is malformed or another version. */
export function parseFileOffer(content: unknown): FileOffer | null {
    if (typeof content !== "object" || content === null) return null;
    const c = content as Record<string, unknown>;
    if (c.version !== FILE_TRANSFER_VERSION) return null;
    if (
        typeof c.transfer_id !== "string" ||
        !c.transfer_id ||
        typeof c.name !== "string" ||
        !c.name ||
        typeof c.mimetype !== "string" ||
        typeof c.sender_device !== "string" ||
        !c.sender_device ||
        typeof c.size !== "number" ||
        !Number.isSafeInteger(c.size) ||
        c.size < 0 ||
        c.size > MAX_FILE_SIZE ||
        !Number.isFinite(c.expires_ts)
    )
        return null;
    if (c.relay_only !== undefined && typeof c.relay_only !== "boolean")
        return null;
    return {
        transferId: c.transfer_id,
        name: c.name,
        size: c.size,
        mimetype: c.mimetype,
        senderDevice: c.sender_device,
        expiresTs: c.expires_ts as number,
        relayOnly: c.relay_only === true,
    };
}

/**
 * When an offer stops being acceptable: its own expiry, and never more than a
 * day after the server stamped it, whatever the offer claims.
 */
export function offerExpiresAt(
    offer: FileOffer,
    originServerTs: number,
): number {
    return Math.min(offer.expiresTs, originServerTs + OFFER_LIFETIME_MS);
}

export function buildFileOffer(offer: FileOffer): Record<string, unknown> {
    return {
        version: FILE_TRANSFER_VERSION,
        transfer_id: offer.transferId,
        name: offer.name,
        size: offer.size,
        mimetype: offer.mimetype,
        sender_device: offer.senderDevice,
        expires_ts: offer.expiresTs,
        ...(offer.relayOnly ? { relay_only: true } : {}),
    };
}

/** The LiveKit identity lk-jwt-service's legacy `/sfu/get` gives a device. */
export function transferIdentity(userId: string, deviceId: string): string {
    return `${userId}:${deviceId}`;
}

/**
 * The LiveKit identity lk-jwt-service's `/get_token` gives a device for a
 * MatrixRTC member: unpadded standard base64 of the SHA-256 of the JSON
 * array `[userId, deviceId, memberId]` (lk-jwt-service `helper.rs`
 * `legacy_livekit_identity_for`).
 */
export async function transferSlotIdentity(
    userId: string,
    deviceId: string,
    memberId: string,
): Promise<string> {
    const data = new TextEncoder().encode(
        JSON.stringify([userId, deviceId, memberId]),
    );
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    return bytesToBase64(hash).replace(/=+$/, "");
}

/** Every LiveKit identity the peer's device may have in a transfer's rooms:
 *  its SFU may have answered `/get_token` or only the legacy `/sfu/get`. */
export async function transferPeerIdentities(
    userId: string,
    deviceId: string,
    transferId: string,
): Promise<string[]> {
    return [
        await transferSlotIdentity(userId, deviceId, transferId),
        transferIdentity(userId, deviceId),
    ];
}

/**
 * The LiveKit room of one transfer. Only the two devices learn its name. On
 * `/get_token` it is the MatrixRTC slot within the offer's Matrix room (an
 * application-service lk-jwt-service only issues tokens for a room the
 * caller has joined); on legacy `/sfu/get` it is the room name itself. Either
 * way the random secret keeps it hidden from the rest of the room.
 */
export function transferRoomAlias(secret: string): string {
    return `zam-transfer-${secret}`;
}

export function randomToken(bytes = 16): string {
    return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function bytesToBase64(bytes: Uint8Array): string {
    let s = "";
    // In pieces: fromCharCode takes its bytes as arguments, and a block's worth
    // overflows the stack.
    for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
    return bytesToBase64(bytes)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
    const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

/** Blocks in a file of `size` bytes. An empty file still has one. */
export function blockCount(size: number): number {
    return Math.max(1, Math.ceil(size / BLOCK_SIZE));
}

/** Plaintext length of block `index`. */
export function blockLength(size: number, index: number): number {
    return Math.min(BLOCK_SIZE, size - index * BLOCK_SIZE);
}

export async function generateTransferKey(): Promise<{
    key: CryptoKey;
    raw: Uint8Array<ArrayBuffer>;
}> {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    return { key: await importTransferKey(raw), raw };
}

export function importTransferKey(
    raw: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
        "encrypt",
        "decrypt",
    ]);
}

// Binds a sealed block to its place in this file and to the file's size, so the
// SFU can't reorder, replay or cut short what it carries.
function blockAad(
    prefix: string,
    transferId: string,
    index: number,
    size: number,
): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(`${prefix}|${transferId}|${index}|${size}`);
}

/** A sealed block as its two parts, IV and ciphertext, which are not joined. */
export interface SealedParts {
    iv: Uint8Array<ArrayBuffer>;
    ciphertext: Uint8Array<ArrayBuffer>;
}

/**
 * The sealed block, in two parts: the caller joins them only if it needs one
 * buffer. Sending splits the block into packets anyway, so the join is a copy
 * of a block that is not needed.
 */
export async function sealBlockParts(
    key: CryptoKey,
    transferId: string,
    size: number,
    index: number,
    plain: Uint8Array<ArrayBuffer>,
    opts?: { iv?: Uint8Array<ArrayBuffer>; prefix?: string },
): Promise<SealedParts> {
    // A fixed IV is for the test vectors only; real blocks always get a fresh one.
    const iv = opts?.iv ?? crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
            additionalData: blockAad(
                opts?.prefix ?? AAD_PREFIX,
                transferId,
                index,
                size,
            ),
        },
        key,
        plain,
    );
    return { iv, ciphertext: new Uint8Array(sealed) };
}

/** IV then ciphertext, ready to split into parts. */
export async function sealBlock(
    key: CryptoKey,
    transferId: string,
    size: number,
    index: number,
    plain: Uint8Array<ArrayBuffer>,
    opts?: { iv?: Uint8Array<ArrayBuffer>; prefix?: string },
): Promise<Uint8Array<ArrayBuffer>> {
    const { iv, ciphertext } = await sealBlockParts(
        key,
        transferId,
        size,
        index,
        plain,
        opts,
    );
    const out = new Uint8Array(IV_BYTES + ciphertext.length);
    out.set(iv);
    out.set(ciphertext, IV_BYTES);
    return out;
}

/** The block's plaintext. Rejects if it was altered or belongs elsewhere. */
export async function openBlock(
    key: CryptoKey,
    transferId: string,
    size: number,
    index: number,
    sealed: Uint8Array<ArrayBuffer>,
    prefix = AAD_PREFIX,
): Promise<Uint8Array<ArrayBuffer>> {
    const plain = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: sealed.subarray(0, IV_BYTES),
            additionalData: blockAad(prefix, transferId, index, size),
        },
        key,
        sealed.subarray(IV_BYTES),
    );
    return new Uint8Array(plain);
}

/** Sealed length of block `index`. */
export function sealedLength(size: number, index: number): number {
    return blockLength(size, index) + IV_BYTES + TAG_BYTES;
}

function hmacKeyUsage(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        raw,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
}

/** The keyed hash of a file's blocks. Only the two devices hold it. */
export function importHashKey(
    raw: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
    return hmacKeyUsage(raw);
}

/** Bytes the leaf's header takes in front of the plaintext. */
export const LEAF_HEADER_BYTES = 1 + SEQ_BYTES;

/**
 * Leaf of block `index` for a plaintext already sitting at
 * `buf[LEAF_HEADER_BYTES..LEAF_HEADER_BYTES + length)`. Writes the header into
 * the first bytes of `buf` and signs a view of it, so no copy is made. The
 * caller may reuse `buf` once this resolves, not before.
 */
export async function blockLeafInPlace(
    hashKey: CryptoKey,
    index: number,
    buf: Uint8Array<ArrayBuffer>,
    length: number,
): Promise<Uint8Array<ArrayBuffer>> {
    buf[0] = 0x00;
    new DataView(buf.buffer, buf.byteOffset, LEAF_HEADER_BYTES).setBigUint64(
        1,
        BigInt(index),
    );
    const mac = await crypto.subtle.sign(
        "HMAC",
        hashKey,
        buf.subarray(0, LEAF_HEADER_BYTES + length),
    );
    return new Uint8Array(mac);
}

/**
 * Leaf of block `index`: HMAC(hash_key, 0x00 || uint64be(index) || plain).
 * Copies `plain` once, behind the header, because WebCrypto's HMAC takes its
 * input whole. Callers with a buffer of their own use blockLeafInPlace.
 */
export async function blockLeaf(
    hashKey: CryptoKey,
    index: number,
    plain: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const buf = new Uint8Array(LEAF_HEADER_BYTES + plain.length);
    buf.set(plain, LEAF_HEADER_BYTES);
    return blockLeafInPlace(hashKey, index, buf, plain.length);
}

async function parentNode(
    left: Uint8Array,
    right: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
    const input = new Uint8Array(1 + left.length + right.length);
    input[0] = 0x01;
    input.set(left, 1);
    input.set(right, 1 + left.length);
    return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}

/**
 * Root of the hash tree over `leaves`. An odd node at the end of a level moves
 * up unchanged, so a single leaf is its own root.
 */
export async function treeRoot(
    leaves: Uint8Array[],
): Promise<Uint8Array<ArrayBuffer>> {
    if (leaves.length === 0) throw new Error("no leaves");
    let level: Uint8Array[] = leaves;
    while (level.length > 1) {
        const next: Uint8Array[] = [];
        for (let i = 0; i < level.length; i += 2)
            next.push(
                i + 1 < level.length
                    ? await parentNode(level[i], level[i + 1])
                    : level[i],
            );
        level = next;
    }
    return new Uint8Array(level[0]);
}

/**
 * Whether `leaves` is the complete leaf list of a `size`-byte file that
 * rebuilds `root`. The count matters: with odd-node promotion, a list that is
 * too short can still reproduce the root.
 */
export async function leafListMatches(
    leaves: Uint8Array[],
    size: number,
    root: Uint8Array,
): Promise<boolean> {
    if (leaves.length !== blockCount(size)) return false;
    if (leaves.some((leaf) => leaf.length !== LEAF_BYTES)) return false;
    const rebuilt = await treeRoot(leaves);
    if (rebuilt.length !== root.length) return false;
    let diff = 0;
    for (let i = 0; i < rebuilt.length; i++) diff |= rebuilt[i] ^ root[i];
    return diff === 0;
}

export interface DataPacket {
    block: number;
    part: number;
    parts: number;
    payload: Uint8Array<ArrayBuffer>;
}

export interface AckPacket {
    /** Every block below this one is on disk. */
    contiguous: number;
    /** Blocks past `contiguous` that are on disk too. */
    have: number[];
}

export interface LeavesPacket {
    /** Index of the first leaf in this packet. */
    first: number;
    leaves: Uint8Array[];
}

/**
 * Split a sealed block, given as consecutive segments that together are its
 * bytes, into the packets that carry it. Each packet is copied out of the
 * segments once; the segments themselves are not joined first.
 */
export function encodeDataPacketsFrom(
    block: number,
    segments: Uint8Array[],
): Uint8Array<ArrayBuffer>[] {
    const total = segments.reduce((n, s) => n + s.length, 0);
    const parts = Math.max(1, Math.ceil(total / PART_SIZE));
    const packets: Uint8Array<ArrayBuffer>[] = [];
    for (let part = 0; part < parts; part++) {
        const start = part * PART_SIZE;
        const end = Math.min(total, start + PART_SIZE);
        const packet = new Uint8Array(DATA_HEADER_BYTES + (end - start));
        const view = new DataView(packet.buffer);
        view.setUint8(0, DATA_PACKET);
        view.setUint32(1, block);
        view.setUint16(5, part);
        view.setUint16(7, parts);
        // Copies the part of each segment that falls inside [start, end).
        let segStart = 0;
        for (const seg of segments) {
            const segEnd = segStart + seg.length;
            const lo = Math.max(start, segStart);
            const hi = Math.min(end, segEnd);
            if (lo < hi)
                packet.set(
                    seg.subarray(lo - segStart, hi - segStart),
                    DATA_HEADER_BYTES + (lo - start),
                );
            segStart = segEnd;
        }
        packets.push(packet);
    }
    return packets;
}

/** Split a sealed block into the packets that carry it. */
export function encodeDataPackets(
    block: number,
    sealed: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer>[] {
    return encodeDataPacketsFrom(block, [sealed]);
}

export function encodeAckPacket(ack: AckPacket): Uint8Array<ArrayBuffer> {
    const have = ack.have.slice(0, MAX_ACK_BLOCKS);
    const packet = new Uint8Array(ACK_HEADER_BYTES + have.length * 4);
    const view = new DataView(packet.buffer);
    view.setUint8(0, ACK_PACKET);
    view.setUint32(1, ack.contiguous);
    view.setUint16(5, have.length);
    have.forEach((block, i) => view.setUint32(ACK_HEADER_BYTES + i * 4, block));
    return packet;
}

/**
 * One leaves packet: the leaves from index `first` on, at most
 * MAX_LEAVES_PER_PACKET of them, from `leaves`, the whole list.
 */
export function encodeLeavesPacket(
    first: number,
    leaves: Uint8Array[],
): Uint8Array<ArrayBuffer> {
    const count = Math.min(MAX_LEAVES_PER_PACKET, leaves.length - first);
    if (count < 1) throw new Error("no leaves at that index");
    const packet = new Uint8Array(LEAVES_HEADER_BYTES + count * LEAF_BYTES);
    const view = new DataView(packet.buffer);
    view.setUint8(0, LEAVES_PACKET);
    view.setUint32(1, first);
    view.setUint16(5, count);
    for (let i = 0; i < count; i++) {
        const leaf = leaves[first + i];
        if (leaf.length !== LEAF_BYTES) throw new Error("bad leaf length");
        packet.set(leaf, LEAVES_HEADER_BYTES + i * LEAF_BYTES);
    }
    return packet;
}

/** The leaf list in packets of up to 437 leaves, in order from leaf 0. */
export function encodeLeavesPackets(
    leaves: Uint8Array[],
): Uint8Array<ArrayBuffer>[] {
    const packets: Uint8Array<ArrayBuffer>[] = [];
    for (let first = 0; first < leaves.length; first += MAX_LEAVES_PER_PACKET)
        packets.push(encodeLeavesPacket(first, leaves));
    return packets;
}

export function decodePacket(
    packet: Uint8Array,
):
    | { kind: "data"; data: DataPacket }
    | { kind: "ack"; ack: AckPacket }
    | { kind: "leaves"; leaves: LeavesPacket }
    | null {
    if (packet.length < 1) return null;
    const view = new DataView(
        packet.buffer,
        packet.byteOffset,
        packet.byteLength,
    );
    const kind = view.getUint8(0);
    if (kind === DATA_PACKET && packet.length >= DATA_HEADER_BYTES) {
        const parts = view.getUint16(7);
        const part = view.getUint16(5);
        if (parts === 0 || part >= parts) return null;
        const payloadLength = packet.length - DATA_HEADER_BYTES;
        if (payloadLength > MAX_DATA_PAYLOAD) return null;
        return {
            kind: "data",
            data: {
                block: view.getUint32(1),
                part,
                parts,
                payload: packet.slice(DATA_HEADER_BYTES),
            },
        };
    }
    if (kind === ACK_PACKET && packet.length >= ACK_HEADER_BYTES) {
        const count = view.getUint16(5);
        if (
            count > MAX_ACK_BLOCKS ||
            packet.length !== ACK_HEADER_BYTES + count * 4
        )
            return null;
        const have: number[] = [];
        for (let i = 0; i < count; i++)
            have.push(view.getUint32(ACK_HEADER_BYTES + i * 4));
        return { kind: "ack", ack: { contiguous: view.getUint32(1), have } };
    }
    if (kind === LEAVES_PACKET && packet.length >= LEAVES_HEADER_BYTES) {
        const count = view.getUint16(5);
        if (
            count < 1 ||
            count > MAX_LEAVES_PER_PACKET ||
            packet.length !== LEAVES_HEADER_BYTES + count * LEAF_BYTES
        )
            return null;
        const leaves: Uint8Array[] = [];
        for (let i = 0; i < count; i++) {
            const start = LEAVES_HEADER_BYTES + i * LEAF_BYTES;
            leaves.push(packet.slice(start, start + LEAF_BYTES));
        }
        return {
            kind: "leaves",
            leaves: { first: view.getUint32(1), leaves },
        };
    }
    return null;
}

/** An acknowledgement from a to-device message, or null if malformed. */
export function parseAckContent(content: unknown): AckPacket | null {
    if (typeof content !== "object" || content === null) return null;
    const c = content as Record<string, unknown>;
    if (
        typeof c.contiguous !== "number" ||
        !Number.isSafeInteger(c.contiguous) ||
        c.contiguous < 0 ||
        !Array.isArray(c.have) ||
        c.have.length > MAX_ACK_BLOCKS ||
        !c.have.every((b) => Number.isSafeInteger(b) && b >= 0)
    )
        return null;
    return { contiguous: c.contiguous, have: c.have as number[] };
}

function seqBytes(seq: number): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(SEQ_BYTES);
    new DataView(out.buffer).setBigUint64(0, BigInt(seq));
    return out;
}

/** HMAC input: direction || sequence || packet, the tag covers exactly this. */
function macInput(
    direction: 1 | 2,
    seq: Uint8Array<ArrayBuffer>,
    packet: Uint8Array,
): Uint8Array<ArrayBuffer> {
    const input = new Uint8Array(1 + SEQ_BYTES + packet.length);
    input[0] = direction;
    input.set(seq, 1);
    input.set(packet, 1 + SEQ_BYTES);
    return input;
}

/** HKDF-SHA-256 of the transfer key, as the 32 raw bytes of the MAC key. */
export async function deriveMacKeyBits(
    rawKey: Uint8Array<ArrayBuffer>,
    info = MAC_INFO,
): Promise<Uint8Array<ArrayBuffer>> {
    const base = await crypto.subtle.importKey("raw", rawKey, "HKDF", false, [
        "deriveBits",
    ]);
    const bits = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: new TextEncoder().encode(info),
        },
        base,
        256,
    );
    return new Uint8Array(bits);
}

/** The HMAC key that authenticates every packet of a transfer. */
export async function deriveMacKey(
    rawKey: Uint8Array<ArrayBuffer>,
    info = MAC_INFO,
): Promise<CryptoKey> {
    return hmacKeyUsage(await deriveMacKeyBits(rawKey, info));
}

/** packet || uint64be(seq) || first 16 bytes of HMAC(direction || seq || packet). */
export async function sealPacket(
    macKey: CryptoKey,
    direction: 1 | 2,
    seq: number,
    packet: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
    if (!Number.isSafeInteger(seq) || seq < 0)
        throw new Error("bad sequence number");
    const seq8 = seqBytes(seq);
    const tag = new Uint8Array(
        await crypto.subtle.sign(
            "HMAC",
            macKey,
            macInput(direction, seq8, packet),
        ),
    );
    const out = new Uint8Array(packet.length + MAC_TRAILER_BYTES);
    out.set(packet);
    out.set(seq8, packet.length);
    out.set(tag.subarray(0, MAC_TAG_BYTES), packet.length + SEQ_BYTES);
    return out;
}

/**
 * The packet inside a sealed one, or null when it is short or its tag fails.
 * `direction` is the direction the packet must come from. The caller checks
 * sequence numbers against what it has accepted.
 */
export async function openPacket(
    macKey: CryptoKey,
    direction: 1 | 2,
    wire: Uint8Array,
): Promise<{ seq: number; packet: Uint8Array<ArrayBuffer> } | null> {
    if (wire.length < MAC_TRAILER_BYTES + 1) return null;
    const bodyLength = wire.length - MAC_TRAILER_BYTES;
    const packet = wire.slice(0, bodyLength);
    const seq8 = wire.slice(bodyLength, bodyLength + SEQ_BYTES);
    const tag = wire.subarray(bodyLength + SEQ_BYTES);
    const expected = new Uint8Array(
        await crypto.subtle.sign(
            "HMAC",
            macKey,
            macInput(direction, seq8, packet),
        ),
    ).subarray(0, MAC_TAG_BYTES);
    // Every byte is compared, so the position of a mismatch leaks nothing.
    let diff = 0;
    for (let i = 0; i < MAC_TAG_BYTES; i++) diff |= tag[i] ^ expected[i];
    if (diff !== 0) return null;
    const seq = new DataView(seq8.buffer).getBigUint64(0);
    if (seq > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return { seq: Number(seq), packet };
}

/** Whether a failed write means the disk or the browser's quota ran out. */
export function isStorageFullError(err: unknown): boolean {
    const e = err as { name?: string; message?: string; code?: string } | null;
    return (
        e?.name === "QuotaExceededError" ||
        e?.message === "QuotaExceededError" ||
        e?.code === "STORAGE_FULL"
    );
}

/** Longest name suggested, extension included. */
const MAX_NAME_LENGTH = 200;
/** An extension longer than this is treated as part of the name. */
const MAX_EXTENSION_LENGTH = 16;
// Controls, C1 controls and bidirectional controls. Written as escapes: a
// bidi override in a name can make "a‮txt.exe" look like "exe.txta".
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F؜‎‏‪-‮⁦-⁩]/g;
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/;

/**
 * A name safe to suggest to a save dialog. It comes from a remote sender, so
 * it is cleaned to the rules in the MSC: no directory part, no control or
 * bidirectional characters, no leading dots or trailing dots and spaces, no
 * Windows device name, at most MAX_NAME_LENGTH characters.
 */
export function safeFileName(name: string): string {
    // Only the last path segment survives, so "../../etc/passwd" is "passwd".
    const segment = name.split(/[\\/]/).pop() ?? "";
    let clean = segment
        .replace(UNSAFE_CHARS, "")
        .replace(/[<>:"|?*]/g, "_")
        .replace(/^[ .]+/, "")
        .replace(/[ .]+$/, "");
    if (!clean) return "file";
    // The base name is what Windows reserves, case-insensitively: "CON.txt".
    const dot = clean.indexOf(".");
    const stem = (dot < 0 ? clean : clean.slice(0, dot))
        .replace(/ +$/, "")
        .toUpperCase();
    if (WINDOWS_RESERVED.test(stem)) clean = `_${clean}`;
    if (clean.length > MAX_NAME_LENGTH) {
        const lastDot = clean.lastIndexOf(".");
        const ext = lastDot > 0 ? clean.slice(lastDot) : "";
        if (ext && ext.length - 1 <= MAX_EXTENSION_LENGTH)
            clean = clean.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
        else clean = clean.slice(0, MAX_NAME_LENGTH).replace(/[ .]+$/, "");
    }
    return clean || "file";
}

export function formatTransferBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}
