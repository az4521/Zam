import { beforeAll, describe, expect, it, vi } from "vitest";
import type { TransferLink } from "$lib/matrix/fileTransferEngine";
import { deriveMacKey, openPacket, sealPacket } from "$lib/utils/fileTransfer";
import { macLink } from "$lib/utils/fileTransferMacLink";

let macKey: CryptoKey;

beforeAll(async () => {
    const raw = new Uint8Array(32).fill(7) as Uint8Array<ArrayBuffer>;
    macKey = await deriveMacKey(raw);
});

/** An in-memory inner link. With a peer, sends arrive there at once; without
 *  one, the test delivers wires by hand. */
class FakeLink implements TransferLink {
    peer: FakeLink | null = null;
    down = false;
    readonly sent: Uint8Array<ArrayBuffer>[] = [];
    private handler: ((packet: Uint8Array) => void) | null = null;

    send(packet: Uint8Array<ArrayBuffer>): Promise<void> {
        if (this.down) return Promise.reject(new Error("link down"));
        this.sent.push(packet);
        this.peer?.receive(packet);
        return Promise.resolve();
    }

    onPacket(handler: (packet: Uint8Array) => void): void {
        this.handler = handler;
    }

    receive(packet: Uint8Array): void {
        this.handler?.(packet);
    }
}

function pair(): { a: FakeLink; b: FakeLink } {
    const a = new FakeLink();
    const b = new FakeLink();
    a.peer = b;
    b.peer = a;
    return { a, b };
}

function collect(link: TransferLink): Uint8Array[] {
    const got: Uint8Array[] = [];
    link.onPacket((p) => got.push(new Uint8Array(p)));
    return got;
}

function bytes(...values: number[]): Uint8Array<ArrayBuffer> {
    return new Uint8Array(values);
}

describe("macLink", () => {
    it("round trips packets in both directions", async () => {
        const { a, b } = pair();
        const sender = macLink(a, macKey, 1);
        const receiver = macLink(b, macKey, 2);
        const atReceiver = collect(receiver);
        const atSender = collect(sender);

        await sender.send(bytes(1, 2, 3));
        await vi.waitFor(() => expect(atReceiver).toHaveLength(1));
        expect(atReceiver[0]).toEqual(bytes(1, 2, 3));

        await receiver.send(bytes(9));
        await vi.waitFor(() => expect(atSender).toHaveLength(1));
        expect(atSender[0]).toEqual(bytes(9));
    });

    it("drops a packet with a flipped byte", async () => {
        // No peer: the test delivers wires by hand, so the original is not
        // delivered before the tampered copy.
        const a = new FakeLink();
        const sender = macLink(a, macKey, 1);
        const b = new FakeLink();
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        await sender.send(bytes(10, 20, 30));
        const wire = new Uint8Array(a.sent[0]);
        wire[1] ^= 0x40;
        b.receive(wire);
        await new Promise((r) => setTimeout(r, 0));
        expect(got).toHaveLength(0);

        // The untouched packet still goes through: the flip did not use up seq 0.
        b.receive(a.sent[0]);
        await vi.waitFor(() => expect(got).toHaveLength(1));
        expect(got[0]).toEqual(bytes(10, 20, 30));
    });

    it("delivers a replayed packet once", async () => {
        const { a, b } = pair();
        const sender = macLink(a, macKey, 1);
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        await sender.send(bytes(5));
        b.receive(a.sent[0]);
        b.receive(a.sent[0]);
        await vi.waitFor(() => expect(got).toHaveLength(1));
        await new Promise((r) => setTimeout(r, 0));
        expect(got).toHaveLength(1);
    });

    it("accepts a gap in sequence numbers", async () => {
        const a = new FakeLink();
        const sender = macLink(a, macKey, 1);
        for (let i = 0; i < 6; i++) await sender.send(bytes(i));

        const b = new FakeLink();
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        b.receive(a.sent[0]);
        b.receive(a.sent[5]);
        await vi.waitFor(() => expect(got).toHaveLength(2));
        expect(got[0]).toEqual(bytes(0));
        expect(got[1]).toEqual(bytes(5));
    });

    it("drops an older sequence number after a newer one", async () => {
        const a = new FakeLink();
        const sender = macLink(a, macKey, 1);
        for (let i = 0; i < 4; i++) await sender.send(bytes(i));

        const b = new FakeLink();
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        b.receive(a.sent[3]);
        b.receive(a.sent[1]);
        await vi.waitFor(() => expect(got).toHaveLength(1));
        await new Promise((r) => setTimeout(r, 0));
        expect(got).toEqual([bytes(3)]);
    });

    it("drops a packet sealed with the wrong direction", async () => {
        const b = new FakeLink();
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);

        // Receiver-to-receiver: direction 2 is not what a receiver accepts.
        b.receive(await sealPacket(macKey, 2, 0, bytes(1)));
        await new Promise((r) => setTimeout(r, 0));
        expect(got).toHaveLength(0);

        // The right direction for this end's peer goes through.
        b.receive(await sealPacket(macKey, 1, 0, bytes(2)));
        await vi.waitFor(() => expect(got).toHaveLength(1));
        expect(got[0]).toEqual(bytes(2));
    });

    it("preserves arrival order for many back-to-back packets", async () => {
        const { a, b } = pair();
        const sender = macLink(a, macKey, 1);
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        const count = 60;
        const sends: Promise<void>[] = [];
        for (let i = 0; i < count; i++)
            sends.push(sender.send(bytes(i & 0xff, i >> 8)));
        await Promise.all(sends);
        await vi.waitFor(() => expect(got).toHaveLength(count));
        for (let i = 0; i < count; i++)
            expect(got[i]).toEqual(bytes(i & 0xff, i >> 8));
    });

    it("keeps numbering past a send the inner link rejected", async () => {
        const a = new FakeLink();
        const sender = macLink(a, macKey, 1);
        a.down = true;
        await expect(sender.send(bytes(1))).rejects.toThrow("link down");
        a.down = false;
        await sender.send(bytes(2));

        // Only one wire went out, and it carries sequence number 1.
        expect(a.sent).toHaveLength(1);
        const opened = await openPacket(macKey, 1, a.sent[0]);
        expect(opened?.seq).toBe(1);
        expect(opened?.packet).toEqual(bytes(2));
    });

    it("reaches the inner link in call order when sends overlap", async () => {
        // The inner link takes a random time per send, so only the queue keeps
        // the order: without it, sealing could finish out of order.
        class JitterLink extends FakeLink {
            override async send(
                packet: Uint8Array<ArrayBuffer>,
            ): Promise<void> {
                await new Promise((r) => setTimeout(r, Math.random() * 3));
                return super.send(packet);
            }
        }
        const a = new JitterLink();
        const b = new FakeLink();
        a.peer = b;
        b.peer = a;
        const sender = macLink(a, macKey, 1);
        const receiver = macLink(b, macKey, 2);
        const got = collect(receiver);
        const count = 40;
        const sends: Promise<void>[] = [];
        for (let i = 0; i < count; i++)
            sends.push(sender.send(bytes(i & 0xff, i >> 8)));
        await Promise.all(sends);
        await vi.waitFor(() => expect(got).toHaveLength(count));
        for (let i = 0; i < count; i++)
            expect(got[i]).toEqual(bytes(i & 0xff, i >> 8));
    });

    it("settles each overlapping send with its own result", async () => {
        // Only the first inner send fails; the second is already queued behind it.
        class FailFirstLink extends FakeLink {
            private calls = 0;
            override send(packet: Uint8Array<ArrayBuffer>): Promise<void> {
                if (this.calls++ === 0)
                    return Promise.reject(new Error("link down"));
                return super.send(packet);
            }
        }
        const a = new FailFirstLink();
        const sender = macLink(a, macKey, 1);
        const failing = sender.send(bytes(1));
        const ok = sender.send(bytes(2));
        await expect(failing).rejects.toThrow("link down");
        await expect(ok).resolves.toBeUndefined();
        expect(a.sent).toHaveLength(1);
    });

    it("hands packets to the handler registered last", async () => {
        const { a, b } = pair();
        const sender = macLink(a, macKey, 1);
        const receiver = macLink(b, macKey, 2);
        const first = collect(receiver);
        const second = collect(receiver);
        await sender.send(bytes(4));
        await vi.waitFor(() => expect(second).toHaveLength(1));
        expect(first).toHaveLength(0);
    });
});
