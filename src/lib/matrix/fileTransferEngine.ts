// The two ends of a transfer, over any packet link (the real one is a LiveKit
// data channel, see fileTransfer.ts). The link may lose packets and may go
// away for a while; both ends carry on from what the receiver has on disk.
import {
    BLOCK_SIZE,
    BlockHashes,
    MAX_ACK_BLOCKS,
    blockCount,
    blockLength,
    decodePacket,
    encodeAckPacket,
    isStorageFullError,
    encodeDataPackets,
    openBlock,
    sealBlock,
    sealedLength,
    type AckPacket,
    type DataPacket,
} from "$lib/utils/fileTransfer";

export interface TransferLink {
    /** Rejects while the link is down. */
    send(packet: Uint8Array<ArrayBuffer>): Promise<void>;
    onPacket(handler: (packet: Uint8Array) => void): void;
}

/** Where received blocks go. Writes may arrive out of order. */
export interface TransferSink {
    write(position: number, data: Uint8Array<ArrayBuffer>): Promise<void>;
}

export interface TransferTiming {
    /** How often the timers below are looked at. */
    tickMs: number;
    /** No acknowledgement for this long: assume the oldest block was lost. */
    resendMs: number;
    /** Same, when acknowledgements only come over to-device messages. */
    slowResendMs: number;
    /** Nothing at all for this long: give up. */
    stallMs: number;
}

export const DEFAULT_TIMING: TransferTiming = {
    tickMs: 500,
    resendMs: 3_000,
    slowResendMs: 12_000,
    stallMs: 120_000,
};

const INITIAL_WINDOW = 4;
const MIN_WINDOW = 2;
/** Sealed blocks held in memory, and queued at the SFU, at most. */
const MAX_WINDOW = 32;
const WINDOW_CUT_GAP_MS = 1_000;
/** Blocks the receiver assembles at once: what an honest sender can have out. */
const MAX_PARTIAL_BLOCKS = MAX_ACK_BLOCKS;
/** Failed blocks before the transfer counts as tampered with. */
const MAX_BAD_BLOCKS = 16;
const ACK_HEARTBEAT_MS = 1_000;

export class TransferError extends Error {
    constructor(
        readonly reason:
            "stalled" | "corrupt" | "write-failed" | "storage-full",
    ) {
        super(reason);
        this.name = "TransferError";
    }
}

interface InFlight {
    packets: Uint8Array<ArrayBuffer>[];
    sentAt: number;
}

export class BlockSender {
    private readonly blocks: number;
    private readonly hashes: BlockHashes;
    private readonly inFlight = new Map<number, InFlight>();
    private readonly resend = new Set<number>();
    private nextBlock = 0;
    private acked = 0;
    private window = INITIAL_WINDOW;
    private lastCut = 0;
    private lastProgress = Date.now();
    private receiverReady = false;
    private slowAcks = false;
    private pumping = false;
    private stopped = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private settle: { resolve: () => void; reject: (e: Error) => void } | null =
        null;

    constructor(
        private readonly file: Blob,
        private readonly key: CryptoKey,
        private readonly transferId: string,
        private readonly link: TransferLink,
        private readonly onProgress: (bytes: number) => void,
        private readonly timing = DEFAULT_TIMING,
    ) {
        this.blocks = blockCount(file.size);
        this.hashes = new BlockHashes(this.blocks);
        link.onPacket((packet) => {
            const decoded = decodePacket(packet);
            if (decoded?.kind === "ack") this.handleAck(decoded.ack);
        });
    }

    /** Sends everything. Resolves with the file's hash once all of it is on
     *  the receiver's disk. Nothing moves until the receiver says it's there. */
    async run(): Promise<string> {
        await new Promise<void>((resolve, reject) => {
            this.settle = { resolve, reject };
            this.timer = setInterval(() => this.tick(), this.timing.tickMs);
        }).finally(() => this.stop());
        return this.hashes.root();
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** An acknowledgement that came some other way than the link. */
    handleSlowAck(ack: AckPacket): void {
        this.slowAcks = true;
        this.handleAck(ack);
    }

    private handleAck(ack: AckPacket): void {
        if (this.stopped) return;
        const now = Date.now();
        this.receiverReady = true;
        const have = new Set(ack.have);
        let progressed = false;
        for (const block of [...this.inFlight.keys()]) {
            if (block >= ack.contiguous && !have.has(block)) continue;
            this.inFlight.delete(block);
            this.resend.delete(block);
            this.acked++;
            progressed = true;
        }
        // Anything older than a block the receiver has, and not just sent, was
        // lost on the way: the SFU drops data rather than queue it forever.
        const newest = Math.max(ack.contiguous - 1, ...ack.have);
        let lost = false;
        for (const [block, flight] of this.inFlight) {
            if (
                block < newest &&
                !this.resend.has(block) &&
                now - flight.sentAt >= this.resendDelay() / 2
            ) {
                this.resend.add(block);
                lost = true;
            }
        }
        if (lost) this.cutWindow(now);
        if (progressed) {
            this.lastProgress = now;
            this.window = Math.min(MAX_WINDOW, this.window + 1 / this.window);
            this.onProgress(this.sentBytes());
        } else if (this.nextBlock === 0) {
            this.lastProgress = now;
        }
        if (this.acked === this.blocks) {
            this.settle?.resolve();
            return;
        }
        void this.pump();
    }

    private resendDelay(): number {
        return this.slowAcks ? this.timing.slowResendMs : this.timing.resendMs;
    }

    private sentBytes(): number {
        return Math.min(this.acked * BLOCK_SIZE, this.file.size);
    }

    private cutWindow(now: number): void {
        if (now - this.lastCut < WINDOW_CUT_GAP_MS) return;
        this.lastCut = now;
        this.window = Math.max(MIN_WINDOW, this.window / 2);
    }

    private tick(): void {
        const now = Date.now();
        if (now - this.lastProgress >= this.timing.stallMs) {
            this.settle?.reject(new TransferError("stalled"));
            return;
        }
        if (!this.receiverReady) return;
        const delay = this.resendDelay();
        const oldest = this.inFlight.entries().next().value;
        if (
            oldest &&
            now - this.lastProgress >= delay &&
            now - oldest[1].sentAt >= delay
        ) {
            this.resend.add(oldest[0]);
            this.cutWindow(now);
        }
        void this.pump();
    }

    private async seal(block: number): Promise<InFlight> {
        const start = block * BLOCK_SIZE;
        const plain = new Uint8Array(
            await this.file
                .slice(start, start + blockLength(this.file.size, block))
                .arrayBuffer(),
        );
        await this.hashes.add(block, plain);
        const sealed = await sealBlock(
            this.key,
            this.transferId,
            this.file.size,
            block,
            plain,
        );
        return { packets: encodeDataPackets(block, sealed), sentAt: 0 };
    }

    private async transmit(flight: InFlight): Promise<void> {
        for (const packet of flight.packets) {
            if (this.stopped) return;
            await this.link.send(packet);
        }
        flight.sentAt = Date.now();
    }

    // One at a time, so packets of two blocks never interleave and a slow link
    // holds everything up rather than filling memory.
    private async pump(): Promise<void> {
        if (this.pumping || !this.receiverReady) return;
        this.pumping = true;
        try {
            while (!this.stopped) {
                const lost = this.resend.values().next().value;
                if (lost !== undefined) {
                    const flight = this.inFlight.get(lost);
                    if (flight) await this.transmit(flight);
                    this.resend.delete(lost);
                    continue;
                }
                if (
                    this.nextBlock >= this.blocks ||
                    this.inFlight.size >= Math.floor(this.window)
                )
                    break;
                const block = this.nextBlock;
                const flight = await this.seal(block);
                // In flight before it's sent, so a resend can find it.
                this.inFlight.set(block, flight);
                this.nextBlock++;
                await this.transmit(flight);
            }
        } catch (err) {
            // The link is down. The tick starts this again; what didn't go
            // out is still in flight and gets resent.
            console.warn("[file-transfer] send paused", err);
        } finally {
            this.pumping = false;
        }
    }
}

export class BlockReceiver {
    private readonly blocks: number;
    private readonly hashes: BlockHashes;
    private readonly partial = new Map<number, (DataPacket | undefined)[]>();
    private readonly stored = new Set<number>();
    private readonly working = new Set<number>();
    private contiguous = 0;
    private storedBytes = 0;
    private badBlocks = 0;
    private lastData = Date.now();
    private stopped = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private settle: {
        resolve: (root: string) => void;
        reject: (e: Error) => void;
    } | null = null;

    constructor(
        private readonly size: number,
        private readonly key: CryptoKey,
        private readonly transferId: string,
        private readonly link: TransferLink,
        private readonly sink: TransferSink,
        private readonly onProgress: (bytes: number) => void,
        // Told what we hold when the link has gone quiet: acknowledgements may
        // not be getting through it, if the SFU won't let us publish there.
        private readonly slowAck: (ack: AckPacket) => void,
        private readonly timing = DEFAULT_TIMING,
    ) {
        this.blocks = blockCount(size);
        this.hashes = new BlockHashes(this.blocks);
        link.onPacket((packet) => {
            const decoded = decodePacket(packet);
            if (decoded?.kind === "data") this.handleData(decoded.data);
        });
    }

    /** Resolves with the file's hash once every block is on disk. Keeps
     *  answering until stopped, in case the last acknowledgement was lost. */
    run(): Promise<string> {
        let lastSlowAck = 0;
        this.timer = setInterval(
            () => {
                const now = Date.now();
                if (now - this.lastData >= this.timing.stallMs) {
                    this.settle?.reject(new TransferError("stalled"));
                    return;
                }
                this.sendAck();
                if (
                    now - this.lastData >= this.timing.slowResendMs / 3 &&
                    now - lastSlowAck >= this.timing.slowResendMs / 3
                ) {
                    lastSlowAck = now;
                    this.slowAck(this.currentAck());
                }
            },
            Math.min(this.timing.tickMs * 2, ACK_HEARTBEAT_MS),
        );
        this.sendAck();
        return new Promise<string>((resolve, reject) => {
            this.settle = { resolve, reject };
        });
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private currentAck(): AckPacket {
        return {
            contiguous: this.contiguous,
            have: [...this.stored]
                .filter((block) => block >= this.contiguous)
                .slice(0, MAX_ACK_BLOCKS),
        };
    }

    private sendAck(): void {
        this.link.send(encodeAckPacket(this.currentAck())).catch(() => {
            /* the heartbeat repeats it */
        });
    }

    private handleData(data: DataPacket): void {
        if (this.stopped || data.block >= this.blocks) return;
        this.lastData = Date.now();
        if (data.block < this.contiguous || this.stored.has(data.block)) {
            this.sendAck();
            return;
        }
        if (this.working.has(data.block)) return;
        let parts = this.partial.get(data.block);
        if (!parts) {
            if (this.partial.size >= MAX_PARTIAL_BLOCKS) return;
            parts = new Array(data.parts);
            this.partial.set(data.block, parts);
        }
        if (parts.length !== data.parts) return;
        parts[data.part] = data;
        for (let i = 0; i < parts.length; i++) if (!parts[i]) return;
        this.partial.delete(data.block);
        this.working.add(data.block);
        void this.store(data.block, parts as DataPacket[]);
    }

    private async store(block: number, parts: DataPacket[]): Promise<void> {
        try {
            const length = parts.reduce((n, p) => n + p.payload.length, 0);
            // Exact, so a forged block count can't make us allocate more.
            if (length !== sealedLength(this.size, block)) throw new Error();
            const sealed = new Uint8Array(length);
            let offset = 0;
            for (const part of parts) {
                sealed.set(part.payload, offset);
                offset += part.payload.length;
            }
            const plain = await openBlock(
                this.key,
                this.transferId,
                this.size,
                block,
                sealed,
            );
            await this.hashes.add(block, plain);
            await this.write(block, plain);
        } catch (err) {
            this.working.delete(block);
            if (err instanceof TransferError) {
                this.settle?.reject(err);
            } else if (++this.badBlocks >= MAX_BAD_BLOCKS) {
                this.settle?.reject(new TransferError("corrupt"));
            }
            return;
        }
        this.working.delete(block);
        this.stored.add(block);
        this.storedBytes += blockLength(this.size, block);
        while (this.stored.has(this.contiguous)) this.contiguous++;
        for (const held of this.stored)
            if (held < this.contiguous) this.stored.delete(held);
        this.onProgress(this.storedBytes);
        this.sendAck();
        if (this.contiguous === this.blocks)
            this.settle?.resolve(await this.hashes.root());
    }

    private async write(
        block: number,
        plain: Uint8Array<ArrayBuffer>,
    ): Promise<void> {
        try {
            await this.sink.write(block * BLOCK_SIZE, plain);
        } catch (err) {
            console.warn("[file-transfer] write failed", err);
            throw new TransferError(
                isStorageFullError(err) ? "storage-full" : "write-failed",
            );
        }
    }
}
