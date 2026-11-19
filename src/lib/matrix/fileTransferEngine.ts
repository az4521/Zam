// The two ends of a transfer, over any packet link (the real one is a LiveKit
// data channel, see fileTransfer.ts). The link may lose packets and may go
// away for a while; both ends carry on from what the receiver has on disk.
import {
    BLOCK_SIZE,
    MAX_ACK_BLOCKS,
    blockCount,
    blockLeaf,
    blockLength,
    decodePacket,
    encodeAckPacket,
    encodeDataPackets,
    encodeLeavesPackets,
    isStorageFullError,
    leafListMatches,
    openBlock,
    sealBlock,
    sealedLength,
    type AckPacket,
    type DataPacket,
    type LeavesPacket,
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

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

/**
 * When the sender sends the leaf list.
 *
 * The receiver checks no block until it holds the whole leaf list, and it
 * acknowledges nothing it cannot check. So when data goes unacknowledged the
 * sender cannot tell a lost data packet from a lost leaf list, and the
 * resend timer alone would never repair the second. The rule: until a block
 * sent as data has been acknowledged, every resend-timer timeout (the moment
 * the timer would resend data) sends the whole leaf list first. Once an
 * acknowledgement covers such a block, the receiver provably holds the leaf
 * list, and it is never sent again.
 */
class LeafListGate {
    private pending = true;
    private confirmed = false;

    /** The leaf list should go out before anything else. */
    get due(): boolean {
        return this.pending;
    }

    /** The leaf list is going out. A timeout meanwhile asks for it again. */
    beginSend(): void {
        this.pending = false;
    }

    /** The resend timer would resend data: send the leaf list first. */
    request(): void {
        if (!this.confirmed) this.pending = true;
    }

    /** An acknowledgement covers a block that was sent as data. */
    confirm(): void {
        this.confirmed = true;
        this.pending = false;
    }
}

interface InFlight {
    packets: Uint8Array<ArrayBuffer>[];
    sentAt: number;
}

export class BlockSender {
    private readonly blocks: number;
    private readonly leafPackets: Uint8Array<ArrayBuffer>[];
    private readonly leafGate = new LeafListGate();
    private readonly inFlight = new Map<number, InFlight>();
    private readonly resend = new Set<number>();
    /** Blocks the receiver holds, as its acknowledgements have said so: all
     *  below `heldBelow`, and those in `heldAhead` (not yet reached). */
    private heldBelow = 0;
    private readonly heldAhead = new Set<number>();
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
        // Computed before the transfer, from the file and the hash key.
        leaves: Uint8Array[],
        private readonly timing = DEFAULT_TIMING,
    ) {
        this.blocks = blockCount(file.size);
        if (leaves.length !== this.blocks)
            throw new Error("leaf count does not match the file");
        this.leafPackets = encodeLeavesPackets(leaves);
        link.onPacket((packet) => {
            const decoded = decodePacket(packet);
            if (decoded?.kind === "ack") this.handleAck(decoded.ack);
        });
    }

    /** Sends everything. Resolves once all of it is on the receiver's disk.
     *  Nothing moves until the receiver says it's there. */
    async run(): Promise<void> {
        // The stall clock starts now: the receiver may take a long time to
        // arrive, and nothing is owed to it before this.
        this.lastProgress = Date.now();
        await new Promise<void>((resolve, reject) => {
            this.settle = { resolve, reject };
            this.timer = setInterval(() => this.tick(), this.timing.tickMs);
        }).finally(() => this.stop());
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
        this.noteHeld(ack);
        const have = new Set(ack.have);
        let progressed = false;
        for (const block of [...this.inFlight.keys()]) {
            if (block >= ack.contiguous && !have.has(block)) continue;
            this.inFlight.delete(block);
            this.resend.delete(block);
            this.acked++;
            progressed = true;
            this.leafGate.confirm();
        }
        if (this.skipHeld() > 0) progressed = true;
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

    private noteHeld(ack: AckPacket): void {
        this.heldBelow = Math.max(this.heldBelow, ack.contiguous);
        for (const block of ack.have)
            if (block >= this.nextBlock) this.heldAhead.add(block);
    }

    /** Steps past blocks the receiver already holds (a resume): they are
     *  never sent. Returns how many were skipped. */
    private skipHeld(): number {
        let skipped = 0;
        while (
            this.nextBlock < this.blocks &&
            (this.nextBlock < this.heldBelow ||
                this.heldAhead.has(this.nextBlock))
        ) {
            this.heldAhead.delete(this.nextBlock);
            this.nextBlock++;
            this.acked++;
            skipped++;
        }
        return skipped;
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
            this.leafGate.request();
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

    private async transmitLeaves(): Promise<void> {
        this.leafGate.beginSend();
        try {
            for (const packet of this.leafPackets) {
                if (this.stopped) return;
                await this.link.send(packet);
            }
        } catch (err) {
            this.leafGate.request();
            throw err;
        }
    }

    // One at a time, so packets of two blocks never interleave and a slow link
    // holds everything up rather than filling memory.
    private async pump(): Promise<void> {
        if (this.pumping || !this.receiverReady) return;
        this.pumping = true;
        try {
            while (!this.stopped) {
                if (this.leafGate.due) {
                    await this.transmitLeaves();
                    continue;
                }
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
    private readonly partial = new Map<number, (DataPacket | undefined)[]>();
    private readonly stored = new Set<number>();
    private readonly working = new Set<number>();
    /** The leaf list as collected so far; whole once it has `blocks` leaves. */
    private leaves: Uint8Array[] = [];
    private leavesChecking = false;
    private leavesVerified = false;
    /** Data that came while the leaf list was being checked, taken once it
     *  passes. The sender sends it right behind the list, and over a direct
     *  link it resends only after a minute of silence, so dropping it stalled
     *  every direct transfer whose list took a moment to check. */
    private early: DataPacket[] = [];
    private earlyBytes = 0;
    private contiguous = 0;
    private storedBytes = 0;
    private badBlocks = 0;
    private lastData = Date.now();
    private stopped = false;
    /** The run has resolved or rejected: nothing more is written. */
    private settled = false;
    /** The run has failed: nothing more is acked either. */
    private failed = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private settle: {
        resolve: () => void;
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
        private readonly hashKey: CryptoKey,
        // From the accept: the leaf list must rebuild this.
        private readonly root: Uint8Array,
        private readonly timing = DEFAULT_TIMING,
    ) {
        this.blocks = blockCount(size);
        link.onPacket((packet) => {
            const decoded = decodePacket(packet);
            if (decoded?.kind === "data") this.handleData(decoded.data);
            else if (decoded?.kind === "leaves")
                void this.handleLeaves(decoded.leaves);
        });
    }

    /** Resolves once every block is on disk. Keeps answering until stopped,
     *  in case the last acknowledgement was lost. */
    run(): Promise<void> {
        // The stall clock starts now, not when the object was built.
        this.lastData = Date.now();
        let lastSlowAck = 0;
        this.timer = setInterval(
            () => {
                const now = Date.now();
                if (now - this.lastData >= this.timing.stallMs) {
                    this.rejectRun(new TransferError("stalled"));
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
        return new Promise<void>((resolve, reject) => {
            this.settle = { resolve, reject };
        });
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** Past stop() or a settled run, the receiver writes and acks nothing. */
    private closed(): boolean {
        return this.stopped || this.settled;
    }

    private resolveRun(): void {
        if (this.settled) return;
        this.settled = true;
        this.settle?.resolve();
    }

    private rejectRun(err: TransferError): void {
        if (this.settled) return;
        this.settled = true;
        this.failed = true;
        this.settle?.reject(err);
    }

    private currentAck(): AckPacket {
        return {
            contiguous: this.contiguous,
            have: [...this.stored]
                .filter((block) => block >= this.contiguous)
                .slice(0, MAX_ACK_BLOCKS),
        };
    }

    /** After a successful finish the receiver keeps acknowledging until it is
     *  stopped: the sender learns the last block arrived only from an ack. */
    private sendAck(): void {
        if (this.stopped || this.failed) return;
        this.link.send(encodeAckPacket(this.currentAck())).catch(() => {
            /* the heartbeat repeats it */
        });
    }

    /** Collects the leaf list in order, and checks it against the root once it
     *  is whole. A packet out of step is dropped: the sender resends from 0. */
    private async handleLeaves(packet: LeavesPacket): Promise<void> {
        if (this.stopped || this.leavesVerified || this.leavesChecking) return;
        if (packet.first === 0) this.leaves = [];
        else if (packet.first !== this.leaves.length) return;
        if (this.leaves.length + packet.leaves.length > this.blocks) {
            // More leaves than this file has: start over from 0 later.
            this.leaves = [];
            return;
        }
        this.leaves.push(...packet.leaves);
        if (this.leaves.length < this.blocks) return;
        this.leavesChecking = true;
        const ok = await leafListMatches(this.leaves, this.size, this.root);
        if (this.stopped) return;
        if (!ok) {
            this.early = [];
            this.rejectRun(new TransferError("corrupt"));
            return;
        }
        this.leavesVerified = true;
        this.leavesChecking = false;
        const early = this.early;
        this.early = [];
        this.earlyBytes = 0;
        for (const data of early) this.handleData(data);
    }

    private handleData(data: DataPacket): void {
        if (this.closed() || data.block >= this.blocks) return;
        // Nothing can be checked before the leaf list, so nothing is taken
        // before it: not assembled, not acknowledged, not counted as a bad
        // block. While the whole list is being checked, data is kept for it,
        // up to what assembling could hold anyway.
        if (!this.leavesVerified) {
            const limit = MAX_PARTIAL_BLOCKS * sealedLength(this.size, 0);
            if (
                this.leavesChecking &&
                this.earlyBytes + data.payload.length <= limit
            ) {
                this.early.push(data);
                this.earlyBytes += data.payload.length;
            }
            return;
        }
        this.lastData = Date.now();
        if (data.block < this.contiguous || this.stored.has(data.block)) {
            this.sendAck();
            return;
        }
        if (this.working.has(data.block)) return;
        let parts = this.partial.get(data.block);
        if (!parts && this.partial.size >= MAX_PARTIAL_BLOCKS) return;
        // A part count that differs from the assembly's, or a part that differs
        // from the one held at its index, means the block is being resent under
        // a new sealing. Two sealings can't be combined (the spec's rule), so
        // the old parts are dropped and the new attempt starts from this part.
        if (!parts || parts.length !== data.parts) {
            parts = new Array(data.parts);
            this.partial.set(data.block, parts);
        }
        const held = parts[data.part];
        if (held) {
            // A byte-identical duplicate changes nothing.
            if (sameBytes(held.payload, data.payload)) return;
            parts = new Array(data.parts);
            this.partial.set(data.block, parts);
        }
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
            const leaf = this.leaves[block];
            const computed = await blockLeaf(this.hashKey, block, plain);
            if (!leaf || !sameBytes(computed, leaf)) throw new Error();
            // Stopped or settled while the block was being opened: no write.
            if (this.closed()) {
                this.working.delete(block);
                return;
            }
            await this.write(block, plain);
        } catch (err) {
            this.working.delete(block);
            if (err instanceof TransferError) {
                this.rejectRun(err);
            } else if (++this.badBlocks >= MAX_BAD_BLOCKS) {
                this.rejectRun(new TransferError("corrupt"));
            }
            return;
        }
        this.working.delete(block);
        if (this.closed()) return;
        this.stored.add(block);
        this.storedBytes += blockLength(this.size, block);
        while (this.stored.has(this.contiguous)) this.contiguous++;
        for (const held of this.stored)
            if (held < this.contiguous) this.stored.delete(held);
        this.onProgress(this.storedBytes);
        this.sendAck();
        if (this.contiguous === this.blocks) this.resolveRun();
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
