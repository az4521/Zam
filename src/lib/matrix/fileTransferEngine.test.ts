import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIRECT_MAX_BUFFERED } from "$lib/utils/fileTransferDirect";
import { openSenderDirect } from "./fileTransferDirect";
import {
    BLOCK_SIZE,
    LEAF_BYTES,
    blockCount,
    blockLeaf,
    blockLength,
    decodePacket,
    encodeAckPacket,
    encodeDataPackets,
    encodeLeavesPackets,
    generateTransferKey,
    importHashKey,
    sealBlock,
    sealedLength,
    treeRoot,
    type AckPacket,
} from "$lib/utils/fileTransfer";
import {
    BlockReceiver,
    BlockSender,
    TransferError,
    type TransferLink,
    type TransferSink,
    type TransferTiming,
} from "./fileTransferEngine";

const FAST: TransferTiming = {
    tickMs: 5,
    resendMs: 30,
    slowResendMs: 60,
    stallMs: 1_500,
};

type Tamper = (
    packet: Uint8Array<ArrayBuffer>,
) => Uint8Array<ArrayBuffer> | null;

/** Two connected link ends, each direction with its own misbehaviour. */
function linkPair(
    toReceiver: Tamper = (p) => p,
    toSender: Tamper = (p) => p,
): { sender: TransferLink; receiver: TransferLink } {
    let onSender = (_: Uint8Array): void => {};
    let onReceiver = (_: Uint8Array): void => {};
    const deliver = (
        packet: Uint8Array<ArrayBuffer>,
        tamper: Tamper,
        to: () => (p: Uint8Array) => void,
    ) => {
        const out = tamper(packet);
        if (out) queueMicrotask(() => to()(out));
    };
    return {
        sender: {
            send: async (p) => deliver(p, toReceiver, () => onReceiver),
            onPacket: (h) => (onSender = h),
        },
        receiver: {
            send: async (p) => deliver(p, toSender, () => onSender),
            onPacket: (h) => (onReceiver = h),
        },
    };
}

class MemorySink implements TransferSink {
    bytes: Uint8Array<ArrayBuffer>;
    constructor(size: number) {
        this.bytes = new Uint8Array(size);
    }
    async write(position: number, data: Uint8Array<ArrayBuffer>) {
        this.bytes.set(data, position);
    }
}

function fileOf(size: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 4099) bytes[i] = (i * 31) & 0xff;
    return bytes;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function until(cond: () => boolean, ms = 2_000): Promise<void> {
    const end = Date.now() + ms;
    while (!cond()) {
        if (Date.now() > end) throw new Error("timed out");
        await sleep(2);
    }
}

/** The hash key both ends share in these tests. */
function hashKey(): Promise<CryptoKey> {
    return importHashKey(new Uint8Array(32).fill(9));
}

/** The leaf list an honest sender computes for these bytes. */
async function leavesFor(
    bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array[]> {
    const key = await hashKey();
    const leaves: Uint8Array[] = [];
    for (let i = 0; i < blockCount(bytes.length); i++) {
        const start = i * BLOCK_SIZE;
        const plain = bytes.slice(start, start + blockLength(bytes.length, i));
        leaves.push(await blockLeaf(key, i, plain));
    }
    return leaves;
}

function randomLeaves(count: number): Uint8Array[] {
    return Array.from({ length: count }, () =>
        crypto.getRandomValues(new Uint8Array(LEAF_BYTES)),
    );
}

async function dataPackets(
    key: CryptoKey,
    size: number,
    index: number,
    plain: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>[]> {
    return encodeDataPackets(
        index,
        await sealBlock(key, "t", size, index, plain),
    );
}

async function transfer(
    size: number,
    links: ReturnType<typeof linkPair>,
    sink: TransferSink = new MemorySink(size),
    options: { leaves?: Uint8Array[] } = {},
) {
    const { key } = await generateTransferKey();
    const file = fileOf(size);
    const sender = new BlockSender(
        new Blob([file]),
        key,
        "t",
        links.sender,
        () => {},
        options.leaves ?? (await leavesFor(file)),
        FAST,
    );
    const receiver = new BlockReceiver(
        size,
        key,
        "t",
        links.receiver,
        sink,
        () => {},
        (ack) => sender.handleSlowAck(ack),
        await hashKey(),
        await treeRoot(await leavesFor(file)),
        FAST,
    );
    const receiving = receiver.run();
    const sending = sender.run();
    try {
        await Promise.all([sending, receiving]);
        return { file };
    } finally {
        sender.stop();
        receiver.stop();
    }
}

/** A receiver driven packet by packet, with no sender behind it. */
async function manualReceiver(
    size: number,
    root: Uint8Array,
    timing: TransferTiming = FAST,
    sink?: TransferSink,
) {
    const { key } = await generateTransferKey();
    const acks: AckPacket[] = [];
    const writes: number[] = [];
    const failures: unknown[] = [];
    let onPacket: (p: Uint8Array) => void = () => {};
    const link: TransferLink = {
        send: async (p) => {
            const d = decodePacket(p);
            if (d?.kind === "ack") acks.push(d.ack);
        },
        onPacket: (h) => (onPacket = h),
    };
    const recordingSink: TransferSink = {
        async write(position) {
            writes.push(position);
        },
    };
    const receiver = new BlockReceiver(
        size,
        key,
        "t",
        link,
        sink ?? recordingSink,
        () => {},
        () => {},
        await hashKey(),
        root,
        timing,
    );
    const done = receiver.run();
    done.catch((e) => failures.push(e));
    return {
        key,
        acks,
        writes,
        failures,
        done,
        deliver: (packets: Uint8Array[]) => packets.forEach(onPacket),
        stop: () => receiver.stop(),
    };
}

describe("a transfer", () => {
    it.each([
        ["empty", 0],
        ["under a block", 1000],
        ["exactly a block", BLOCK_SIZE],
        ["several blocks", 3 * BLOCK_SIZE + 17],
    ])("delivers a file that is %s", async (_label, size) => {
        const sink = new MemorySink(size);
        const { file } = await transfer(size, linkPair(), sink);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("lands a multi-block file byte-identical", async () => {
        const size = 3 * BLOCK_SIZE + 7;
        const sink = new MemorySink(size);
        const { file } = await transfer(size, linkPair(), sink);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("recovers from lost data packets", async () => {
        let n = 0;
        const size = 6 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair((p) => (++n % 97 === 0 ? null : p)),
            sink,
        );
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("recovers from lost acknowledgements", async () => {
        let n = 0;
        const size = 4 * BLOCK_SIZE;
        const { file } = await transfer(
            size,
            linkPair(undefined, (p) => (++n % 3 === 0 ? null : p)),
        );
        expect(file.length).toBe(size);
    });

    it("recovers when the last block's packet is lost", async () => {
        let dropped = false;
        const size = BLOCK_SIZE + 10;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair((p) => {
                const d = decodePacket(p);
                if (
                    !dropped &&
                    d?.kind === "data" &&
                    d.data.block === 1 &&
                    d.data.part === 0
                ) {
                    dropped = true;
                    return null;
                }
                return p;
            }),
            sink,
        );
        expect(dropped).toBe(true);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("runs on to-device acknowledgements when the link has none", async () => {
        const size = 2 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair(undefined, () => null),
            sink,
        );
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("rewrites nothing for duplicated packets", async () => {
        const writes: number[] = [];
        const size = 2 * BLOCK_SIZE;
        const sink: TransferSink = {
            async write(position) {
                writes.push(position);
            },
        };
        let late: Uint8Array<ArrayBuffer> | null = null;
        const links = linkPair((p) => {
            late ??= p;
            return p;
        });
        const original = links.sender.send;
        links.sender.send = async (p) => {
            await original(p);
            if (late) await original(late);
        };
        await transfer(size, links, sink);
        expect(writes.filter((w) => w === 0)).toHaveLength(1);
    });

    it("sends nothing until the receiver is there", async () => {
        const { key } = await generateTransferKey();
        const links = linkPair();
        let packets = 0;
        const send = links.sender.send;
        links.sender.send = (p) => {
            packets++;
            return send(p);
        };
        const sender = new BlockSender(
            new Blob([fileOf(100)]),
            key,
            "t",
            links.sender,
            () => {},
            await leavesFor(fileOf(100)),
            FAST,
        );
        const sending = sender.run();
        await new Promise((r) => setTimeout(r, 60));
        sender.stop();
        expect(packets).toBe(0);
        void sending.catch(() => {});
    });

    it("gives up when the receiver never appears", async () => {
        const { key } = await generateTransferKey();
        const sender = new BlockSender(
            new Blob([fileOf(100)]),
            key,
            "t",
            linkPair().sender,
            () => {},
            await leavesFor(fileOf(100)),
            { ...FAST, stallMs: 40 },
        );
        await expect(sender.run()).rejects.toThrow(TransferError);
    });
});

describe("the leaf list", () => {
    it("resends the leaf list when its first packet is dropped", async () => {
        const size = 3 * BLOCK_SIZE + 7;
        const dropped = new Set<number>();
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair((p) => {
                const d = decodePacket(p);
                if (d?.kind === "leaves" && !dropped.has(d.leaves.first)) {
                    dropped.add(d.leaves.first);
                    return null;
                }
                return p;
            }),
            sink,
        );
        expect(dropped.size).toBe(1);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("ignores leaves after a gap until the resend from 0", async () => {
        const size = 1000 * BLOCK_SIZE;
        const plain0 = new Uint8Array(BLOCK_SIZE).fill(3);
        const leaves = randomLeaves(1000);
        leaves[0] = await blockLeaf(await hashKey(), 0, plain0);
        const [head, gapped, tail] = encodeLeavesPackets(leaves);
        const rx = await manualReceiver(size, await treeRoot(leaves));
        rx.deliver([tail]); // after a gap: ignored
        rx.deliver([head]); // resend from 0 starts over
        rx.deliver([gapped]);
        rx.deliver([tail]); // whole list again
        const data = await dataPackets(rx.key, size, 0, plain0);
        // The list is checked asynchronously: deliver until it is accepted.
        for (let i = 0; i < 200 && rx.writes.length === 0; i++) {
            rx.deliver(data);
            await sleep(10);
        }
        expect(rx.writes).toEqual([0]);
        expect(rx.failures).toEqual([]);
        rx.stop();
    });

    it("rejects a leaf list for other content as corrupt, writing nothing", async () => {
        const size = 2 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const written: number[] = [];
        const recording: TransferSink = {
            async write(position, data) {
                written.push(position);
                await sink.write(position, data);
            },
        };
        const wrong = await leavesFor(new Uint8Array(size).fill(7));
        await expect(
            transfer(size, linkPair(), recording, { leaves: wrong }),
        ).rejects.toMatchObject({ reason: "corrupt" });
        expect(written).toEqual([]);
    });

    it("does not resend the leaf list once data is acknowledged", async () => {
        const size = 6 * BLOCK_SIZE;
        let leafPackets = 0;
        let dropped = false;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair((p) => {
                const d = decodePacket(p);
                if (d?.kind === "leaves") leafPackets++;
                if (
                    !dropped &&
                    d?.kind === "data" &&
                    d.data.block === 4 &&
                    d.data.part === 0
                ) {
                    dropped = true;
                    return null;
                }
                return p;
            }),
            sink,
        );
        expect(dropped).toBe(true);
        expect(leafPackets).toBe(1);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });
});

describe("tampering", () => {
    it("resends a block whose packet was tampered with once", async () => {
        let flipped = false;
        const size = 3 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair((p) => {
                const d = decodePacket(p);
                if (!flipped && d?.kind === "data" && d.data.block === 1) {
                    flipped = true;
                    const out = p.slice();
                    out[out.length - 1] ^= 1;
                    return out;
                }
                return p;
            }),
            sink,
        );
        expect(flipped).toBe(true);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("ignores data before the leaf list, without counting it bad", async () => {
        const size = 2 * BLOCK_SIZE;
        const file = fileOf(size);
        const leaves = await leavesFor(file);
        const rx = await manualReceiver(size, await treeRoot(leaves));
        // More than MAX_BAD_BLOCKS: if these counted, the run would fail.
        const bogus = encodeDataPackets(
            0,
            new Uint8Array(sealedLength(size, 0)),
        );
        for (let i = 0; i < 20; i++) rx.deliver(bogus);
        await sleep(30);
        expect(rx.writes).toEqual([]);
        expect(
            rx.acks.every((a) => a.contiguous === 0 && a.have.length === 0),
        ).toBe(true);
        rx.deliver(encodeLeavesPackets(leaves));
        for (let i = 0; i < 2; i++)
            rx.deliver(
                await dataPackets(
                    rx.key,
                    size,
                    i,
                    file.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE),
                ),
            );
        await expect(rx.done).resolves.toBeUndefined();
        expect(rx.failures).toEqual([]);
        expect([...rx.writes].sort((a, b) => a - b)).toEqual([0, BLOCK_SIZE]);
        rx.stop();
    });

    it("skips the blocks a resuming receiver already holds", async () => {
        const size = 4 * BLOCK_SIZE;
        const file = fileOf(size);
        const { key } = await generateTransferKey();
        const sent: Uint8Array<ArrayBuffer>[] = [];
        let onPacket: (p: Uint8Array) => void = () => {};
        const sender = new BlockSender(
            new Blob([file]),
            key,
            "t",
            {
                send: async (p) => {
                    sent.push(p);
                },
                onPacket: (h) => (onPacket = h),
            },
            () => {},
            await leavesFor(file),
            FAST,
        );
        const running = sender.run();
        // The first acknowledgement: blocks 0 and 1 are held.
        onPacket(encodeAckPacket({ contiguous: 2, have: [] }));
        const dataBlocks = () =>
            new Set(
                sent.flatMap((p) => {
                    const d = decodePacket(p);
                    return d?.kind === "data" ? [d.data.block] : [];
                }),
            );
        await until(() => dataBlocks().has(3));
        onPacket(encodeAckPacket({ contiguous: 4, have: [] }));
        await running;
        expect([...dataBlocks()].sort()).toEqual([2, 3]);
        const firstLeaves = sent.findIndex(
            (p) => decodePacket(p)?.kind === "leaves",
        );
        const firstData = sent.findIndex(
            (p) => decodePacket(p)?.kind === "data",
        );
        expect(firstLeaves).toBeGreaterThanOrEqual(0);
        expect(firstLeaves).toBeLessThan(firstData);
    });

    it("can't get an altered block written", async () => {
        const written: number[] = [];
        const size = 2 * BLOCK_SIZE;
        const sink: TransferSink = {
            async write(position) {
                written.push(position);
            },
        };
        await expect(
            transfer(
                size,
                linkPair((p) => {
                    const out = p.slice();
                    if (decodePacket(out)?.kind === "data")
                        out[out.length - 1] ^= 1;
                    return out;
                }),
                sink,
            ),
        ).rejects.toMatchObject({ reason: "corrupt" });
        expect(written).toEqual([]);
    });

    it("can't pass one block off as another", async () => {
        const size = 3 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const swapped = linkPair((p) => {
            const out = p.slice();
            if (decodePacket(out)?.kind === "data" && out[4] === 1) out[4] = 2;
            else if (decodePacket(out)?.kind === "data" && out[4] === 2)
                out[4] = 1;
            return out;
        });
        await expect(transfer(size, swapped, sink)).rejects.toMatchObject({
            reason: "corrupt",
        });
    });

    it("can't crash the receiver with a block past the end", async () => {
        const size = BLOCK_SIZE;
        const links = linkPair((p) => {
            const out = p.slice();
            if (decodePacket(out)?.kind === "data") out[1] = 0xff;
            return out;
        });
        await expect(transfer(size, links)).rejects.toMatchObject({
            reason: "stalled",
        });
    });
});

describe("the receiver's disk", () => {
    it.each([
        ["a browser quota", new DOMException("full", "QuotaExceededError")],
        [
            "the Android disk",
            Object.assign(new Error(), { code: "STORAGE_FULL" }),
        ],
    ])("says so when %s runs out", async (_label, failure) => {
        const sink: TransferSink = { write: () => Promise.reject(failure) };
        await expect(
            transfer(BLOCK_SIZE, linkPair(), sink),
        ).rejects.toMatchObject({ reason: "storage-full" });
    });

    it("fails the transfer when a write fails", async () => {
        const sink: TransferSink = {
            write: () => Promise.reject(new Error("disk full")),
        };
        await expect(
            transfer(BLOCK_SIZE, linkPair(), sink),
        ).rejects.toMatchObject({ reason: "write-failed" });
    });

    it("holds the sender back: nothing beyond the window is sent", async () => {
        let release = (): void => {};
        const gate = new Promise<void>((r) => (release = r));
        let highest = -1;
        const size = 40 * BLOCK_SIZE;
        const sink: TransferSink = { write: () => gate };
        const running = transfer(
            size,
            linkPair((p) => {
                const d = decodePacket(p);
                if (d?.kind === "data")
                    highest = Math.max(highest, d.data.block);
                return p;
            }),
            sink,
        );
        // The leaf list of a 40 MiB file takes a while to hash before the
        // first packet goes out, so wait for the window to fill first.
        await until(() => highest >= 3);
        await sleep(150);
        // The starting window, with no acknowledgement to widen it.
        expect(highest).toBe(3);
        release();
        await running;
        expect(highest).toBe(39);
    });
});

describe("the stall clock", () => {
    it("starts when the transfer runs, not when its objects are built", async () => {
        const size = 2 * BLOCK_SIZE;
        const file = fileOf(size);
        const { key } = await generateTransferKey();
        const links = linkPair();
        const timing = { ...FAST, stallMs: 80 };
        const sink = new MemorySink(size);
        const sender = new BlockSender(
            new Blob([file]),
            key,
            "t",
            links.sender,
            () => {},
            await leavesFor(file),
            timing,
        );
        const receiver = new BlockReceiver(
            size,
            key,
            "t",
            links.receiver,
            sink,
            () => {},
            () => {},
            await hashKey(),
            await treeRoot(await leavesFor(file)),
            timing,
        );
        // Both ends sit idle far past the stall limit before the other side
        // is there: neither may report a stall.
        await sleep(200);
        try {
            await Promise.all([receiver.run(), sender.run()]);
            expect(Buffer.compare(sink.bytes, file)).toBe(0);
        } finally {
            sender.stop();
            receiver.stop();
        }
    });
});

describe("a receiver that has stopped or settled", () => {
    it("keeps acknowledging after it completes, until stopped", async () => {
        // The sender learns that the last block arrived only from an
        // acknowledgement; losing the first one must not leave it waiting.
        const size = 2 * BLOCK_SIZE;
        let dropped = false;
        const sink = new MemorySink(size);
        const { file } = await transfer(
            size,
            linkPair(undefined, (p) => {
                const d = decodePacket(p);
                if (
                    !dropped &&
                    d?.kind === "ack" &&
                    d.ack.contiguous === blockCount(size)
                ) {
                    dropped = true;
                    return null;
                }
                return p;
            }),
            sink,
        );
        expect(dropped).toBe(true);
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
    });

    it("writes nothing and acks nothing once stopped mid-block", async () => {
        const size = BLOCK_SIZE;
        const file = fileOf(size);
        const leaves = await leavesFor(file);
        const r = await manualReceiver(size, await treeRoot(leaves));
        r.deliver(encodeLeavesPackets(leaves));
        await sleep(50);
        const packets = await dataPackets(r.key, size, 0, file);
        // Read in the same step as the delivery: the heartbeat runs between
        // awaits. The block is being opened when stop() lands.
        const acksBefore = r.acks.length;
        r.deliver(packets);
        r.stop();
        await sleep(80);
        expect(r.writes).toEqual([]);
        expect(r.acks.length).toBe(acksBefore);
    });

    it("writes nothing and acks nothing after its run has failed", async () => {
        const size = BLOCK_SIZE;
        const file = fileOf(size);
        const leaves = await leavesFor(file);
        const r = await manualReceiver(size, await treeRoot(leaves), {
            ...FAST,
            stallMs: 200,
        });
        r.deliver(encodeLeavesPackets(leaves));
        await sleep(30);
        // No data arrives, so the run stalls and settles as failed.
        await until(() => r.failures.length > 0, 2_000);
        const packets = await dataPackets(r.key, size, 0, file);
        const writesBefore = r.writes.length;
        const acksBefore = r.acks.length;
        r.deliver(packets);
        await sleep(80);
        expect(r.writes.length).toBe(writesBefore);
        expect(r.acks.length).toBe(acksBefore);
        r.stop();
    });
});

describe("acknowledgement shape", () => {
    it("reports blocks past a gap", async () => {
        const { key } = await generateTransferKey();
        const acks: AckPacket[] = [];
        const links = linkPair(
            (p) => {
                const d = decodePacket(p);
                return d?.kind === "data" && d.data.block === 0 ? null : p;
            },
            (p) => {
                const d = decodePacket(p);
                if (d?.kind === "ack") acks.push(d.ack);
                return p;
            },
        );
        const size = 3 * BLOCK_SIZE;
        const file = fileOf(size);
        const sender = new BlockSender(
            new Blob([file]),
            key,
            "t",
            links.sender,
            () => {},
            await leavesFor(file),
            { ...FAST, stallMs: 300 },
        );
        const receiver = new BlockReceiver(
            size,
            key,
            "t",
            links.receiver,
            new MemorySink(size),
            () => {},
            () => {},
            await hashKey(),
            await treeRoot(await leavesFor(file)),
            { ...FAST, stallMs: 300 },
        );
        void receiver.run().catch(() => {});
        await sender.run().catch(() => {});
        receiver.stop();
        expect(acks.some((a) => a.contiguous === 0 && a.have.includes(1))).toBe(
            true,
        );
    });
});

/** A data channel that, like Chrome, throws once its queue passes 16 MiB and
 *  reports bufferedamountlow only when told to. */
class FakeChannel {
    readyState = "open";
    bufferedAmount = 0;
    bufferedAmountLowThreshold = 0;
    binaryType = "";
    onmessage: unknown = null;
    onclose: unknown = null;
    readonly sentIds: number[] = [];
    /** Sends that went in while the queue was already over the limit. */
    overLimitSends = 0;
    throwNext: Error | null = null;
    private readonly listeners = new Map<string, Set<() => void>>();

    addEventListener(type: string, fn: () => void): void {
        let set = this.listeners.get(type);
        if (!set) this.listeners.set(type, (set = new Set()));
        set.add(fn);
    }

    removeEventListener(type: string, fn: () => void): void {
        this.listeners.get(type)?.delete(fn);
    }

    emit(type: string): void {
        for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
    }

    send(data: Uint8Array): void {
        if (this.throwNext) {
            const err = this.throwNext;
            this.throwNext = null;
            throw err;
        }
        if (this.bufferedAmount > 16 * 1024 * 1024)
            throw new Error("RTCDataChannel send queue is full");
        if (this.bufferedAmount > DIRECT_MAX_BUFFERED) this.overLimitSends++;
        this.sentIds.push(data[0]);
        this.bufferedAmount += data.length;
    }

    close(): void {
        this.readyState = "closed";
    }
}

class FakePeer {
    static last: FakePeer | null = null;
    static async generateCertificate() {
        return {};
    }
    localDescription = { sdp: "v=0\r\n" };
    onicecandidate: unknown = null;
    onconnectionstatechange: unknown = null;
    ondatachannel: unknown = null;
    channel: FakeChannel | null = null;

    constructor(readonly config: RTCConfiguration) {
        FakePeer.last = this;
    }

    createDataChannel(): FakeChannel {
        this.channel = new FakeChannel();
        return this.channel;
    }

    async createOffer() {
        return { type: "offer", sdp: "v=0\r\n" };
    }

    async setLocalDescription(): Promise<void> {}

    async addIceCandidate(): Promise<void> {}

    close(): void {}
}

describe("the direct link's send queue", () => {
    beforeEach(() => {
        FakePeer.last = null;
        vi.stubGlobal("RTCPeerConnection", FakePeer);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function openLink() {
        const { link } = await openSenderDirect({
            rtcConfig: {},
            relayOnly: false,
            sendCandidates: () => {},
            onFailed: () => {},
        });
        const channel = FakePeer.last?.channel;
        if (!channel) throw new Error("no channel");
        return { link, channel };
    }

    function packet(id: number): Uint8Array<ArrayBuffer> {
        const bytes = new Uint8Array(1024 * 1024);
        bytes[0] = id;
        return bytes;
    }

    /** Lets the queue make progress: each drain event, then a macrotask. */
    async function pumpUntil(channel: FakeChannel, count: number) {
        for (let i = 0; i < 100 && channel.sentIds.length < count; i++) {
            channel.bufferedAmount = 0;
            channel.emit("bufferedamountlow");
            await new Promise((r) => setTimeout(r, 0));
        }
    }

    it("sends in call order and never past the queue limit", async () => {
        const { link, channel } = await openLink();
        channel.bufferedAmount = DIRECT_MAX_BUFFERED + 1;
        const sends = Array.from({ length: 10 }, (_, id) =>
            link.send(packet(id)),
        );
        // Nothing goes in while the queue is over the limit.
        await new Promise((r) => setTimeout(r, 0));
        expect(channel.sentIds).toEqual([]);
        await pumpUntil(channel, 10);
        await Promise.all(sends);
        expect(channel.sentIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(channel.overLimitSends).toBe(0);
    });

    it("rejects a send that throws, and carries on with the rest", async () => {
        const { link, channel } = await openLink();
        const boom = new Error("RTCDataChannel send queue is full");
        channel.throwNext = boom;
        await expect(link.send(packet(1))).rejects.toBe(boom);
        await link.send(packet(2));
        expect(channel.sentIds).toEqual([2]);
    });

    it("fails sends queued behind a closed channel", async () => {
        const { link, channel } = await openLink();
        channel.bufferedAmount = DIRECT_MAX_BUFFERED + 1;
        const queued = link.send(packet(1));
        channel.readyState = "closed";
        channel.emit("close");
        await expect(queued).rejects.toThrow("link down");
    });
});
