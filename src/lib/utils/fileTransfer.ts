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
 * hold, and the receiver acknowledges a block once it is on disk. That one
 * acknowledgement is the flow control, the retransmission and the resume.
 */

export const FILE_OFFER_EVENT = "moe.crafty.matrix.file_offer";

const TO_DEVICE_PREFIX = "moe.crafty.matrix.file_transfer";
export const FILE_REQUEST_TYPE = `${TO_DEVICE_PREFIX}.request`;
export const FILE_ACCEPT_TYPE = `${TO_DEVICE_PREFIX}.accept`;
export const FILE_REFUSE_TYPE = `${TO_DEVICE_PREFIX}.refuse`;
export const FILE_ACK_TYPE = `${TO_DEVICE_PREFIX}.ack`;
export const FILE_FINISH_TYPE = `${TO_DEVICE_PREFIX}.finish`;
export const FILE_DONE_TYPE = `${TO_DEVICE_PREFIX}.done`;
export const FILE_CANCEL_TYPE = `${TO_DEVICE_PREFIX}.cancel`;

/** LiveKit data topic of the block and acknowledgement packets. */
export const FILE_DATA_TOPIC = "zam.file.v1";

export const FILE_TRANSFER_VERSION = 1;
export const BLOCK_SIZE = 1024 * 1024;
/** LiveKit's reliable data packets stop at about 15 KB. */
export const PART_SIZE = 14_000;
/** Largest offer accepted: bounds the receiver's table of block hashes. */
export const MAX_FILE_SIZE = 2 ** 40;
export const OFFER_LIFETIME_MS = 24 * 60 * 60 * 1000;

const IV_BYTES = 12;
const TAG_BYTES = 16;
const HASH_BYTES = 32;
const DATA_PACKET = 1;
const ACK_PACKET = 2;
const DATA_HEADER_BYTES = 9;
const ACK_HEADER_BYTES = 7;
/** Blocks one acknowledgement can list beyond the contiguous run. */
export const MAX_ACK_BLOCKS = 128;

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
}

/** An offer's content, or null when it is malformed or from a newer Zam. */
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
        typeof c.expires_ts !== "number"
    )
        return null;
    return {
        transferId: c.transfer_id,
        name: c.name,
        size: c.size,
        mimetype: c.mimetype,
        senderDevice: c.sender_device,
        expiresTs: c.expires_ts,
    };
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
    };
}

/** The LiveKit identity lk-jwt-service gives a device. */
export function transferIdentity(userId: string, deviceId: string): string {
    return `${userId}:${deviceId}`;
}

/** The LiveKit room of one transfer. Only the two devices learn its name. */
export function transferRoomAlias(roomId: string, secret: string): string {
    return `${roomId}|zam-transfer-${secret}`;
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
    transferId: string,
    index: number,
    size: number,
): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
        `zam-file-v${FILE_TRANSFER_VERSION}|${transferId}|${index}|${size}`,
    );
}

/** IV then ciphertext, ready to split into parts. */
export async function sealBlock(
    key: CryptoKey,
    transferId: string,
    size: number,
    index: number,
    plain: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
            additionalData: blockAad(transferId, index, size),
        },
        key,
        plain,
    );
    const out = new Uint8Array(IV_BYTES + sealed.byteLength);
    out.set(iv);
    out.set(new Uint8Array(sealed), IV_BYTES);
    return out;
}

/** The block's plaintext. Rejects if it was altered or belongs elsewhere. */
export async function openBlock(
    key: CryptoKey,
    transferId: string,
    size: number,
    index: number,
    sealed: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const plain = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: sealed.subarray(0, IV_BYTES),
            additionalData: blockAad(transferId, index, size),
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

/** Hash table for a file's blocks, filled in as they pass through. */
export class BlockHashes {
    private readonly table: Uint8Array<ArrayBuffer>;

    constructor(blocks: number) {
        this.table = new Uint8Array(blocks * HASH_BYTES);
    }

    async add(index: number, plain: Uint8Array<ArrayBuffer>): Promise<void> {
        const hash = await crypto.subtle.digest("SHA-256", plain);
        this.table.set(new Uint8Array(hash), index * HASH_BYTES);
    }

    /** The file's hash: SHA-256 over the block hashes, in order. */
    async root(): Promise<string> {
        return bytesToBase64Url(
            new Uint8Array(await crypto.subtle.digest("SHA-256", this.table)),
        );
    }
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

/** Split a sealed block into the packets that carry it. */
export function encodeDataPackets(
    block: number,
    sealed: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer>[] {
    const parts = Math.max(1, Math.ceil(sealed.length / PART_SIZE));
    const packets: Uint8Array<ArrayBuffer>[] = [];
    for (let part = 0; part < parts; part++) {
        const chunk = sealed.subarray(part * PART_SIZE, (part + 1) * PART_SIZE);
        const packet = new Uint8Array(DATA_HEADER_BYTES + chunk.length);
        const view = new DataView(packet.buffer);
        view.setUint8(0, DATA_PACKET);
        view.setUint32(1, block);
        view.setUint16(5, part);
        view.setUint16(7, parts);
        packet.set(chunk, DATA_HEADER_BYTES);
        packets.push(packet);
    }
    return packets;
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

export function decodePacket(
    packet: Uint8Array,
): { kind: "data"; data: DataPacket } | { kind: "ack"; ack: AckPacket } | null {
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

/** Whether a failed write means the disk or the browser's quota ran out. */
export function isStorageFullError(err: unknown): boolean {
    const e = err as { name?: string; message?: string; code?: string } | null;
    return (
        e?.name === "QuotaExceededError" ||
        e?.message === "QuotaExceededError" ||
        e?.code === "STORAGE_FULL"
    );
}

/** A name safe to suggest to a save dialog. It comes from a remote sender. */
export function safeFileName(name: string): string {
    const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
    // eslint-disable-next-line no-control-regex
    const clean = base.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim();
    return !clean || clean === "." || clean === ".." ? "download" : clean;
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
