import { describe, expect, it } from "vitest";
import {
    BLOCK_SIZE,
    decodePacket,
    generateTransferKey,
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

async function transfer(
    size: number,
    links: ReturnType<typeof linkPair>,
    sink: TransferSink = new MemorySink(size),
) {
    const { key } = await generateTransferKey();
    const file = fileOf(size);
    const sender = new BlockSender(
        new Blob([file]),
        key,
        "t",
        links.sender,
        () => {},
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
        FAST,
    );
    const receiving = receiver.run();
    const sending = sender.run();
    try {
        const [sentRoot, receivedRoot] = await Promise.all([
            sending,
            receiving,
        ]);
        return { file, sentRoot, receivedRoot };
    } finally {
        sender.stop();
        receiver.stop();
    }
}

describe("a transfer", () => {
    it.each([
        ["empty", 0],
        ["under a block", 1000],
        ["exactly a block", BLOCK_SIZE],
        ["several blocks", 3 * BLOCK_SIZE + 17],
    ])("delivers a file that is %s", async (_label, size) => {
        const sink = new MemorySink(size);
        const { file, sentRoot, receivedRoot } = await transfer(
            size,
            linkPair(),
            sink,
        );
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
        expect(receivedRoot).toBe(sentRoot);
    });

    it("recovers from lost data packets", async () => {
        let n = 0;
        const size = 6 * BLOCK_SIZE;
        const sink = new MemorySink(size);
        const { file, sentRoot, receivedRoot } = await transfer(
            size,
            linkPair((p) => (++n % 97 === 0 ? null : p)),
            sink,
        );
        expect(Buffer.compare(sink.bytes, file)).toBe(0);
        expect(receivedRoot).toBe(sentRoot);
    });

    it("recovers from lost acknowledgements", async () => {
        let n = 0;
        const size = 4 * BLOCK_SIZE;
        const { sentRoot, receivedRoot } = await transfer(
            size,
            linkPair(undefined, (p) => (++n % 3 === 0 ? null : p)),
        );
        expect(receivedRoot).toBe(sentRoot);
    });

    it("recovers when the last block's packet is lost", async () => {
        let dropped = false;
        const size = BLOCK_SIZE + 10;
        const { sentRoot, receivedRoot } = await transfer(
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
        );
        expect(dropped).toBe(true);
        expect(receivedRoot).toBe(sentRoot);
    });

    it("runs on to-device acknowledgements when the link has none", async () => {
        const size = 2 * BLOCK_SIZE;
        const { sentRoot, receivedRoot } = await transfer(
            size,
            linkPair(undefined, () => null),
        );
        expect(receivedRoot).toBe(sentRoot);
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
            { ...FAST, stallMs: 40 },
        );
        await expect(sender.run()).rejects.toThrow(TransferError);
    });
});

describe("a dishonest SFU", () => {
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
        await new Promise((r) => setTimeout(r, 200));
        // The starting window, with no acknowledgement to widen it.
        expect(highest).toBe(3);
        release();
        await running;
        expect(highest).toBe(39);
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
        const sender = new BlockSender(
            new Blob([fileOf(size)]),
            key,
            "t",
            links.sender,
            () => {},
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
