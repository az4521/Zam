import { ClientEvent, type MatrixClient } from "matrix-js-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createSignalling,
    resetSeqStoreForTests,
    type SignallingMessage,
} from "./signalling";
import {
    SIGNALLING_TYPES,
    buildSignalling,
    type SignallingCommon,
    type SignallingPayload,
} from "./protocol";

const ROOM = "!r:x";
const SLOT = "m.call#ROOM";
const OWN = { userId: "@me:x", deviceId: "MEDEV", memberId: "@me:x:MEDEV" };
const CANDIDATE: SignallingPayload = {
    type: "candidates",
    candidates: [{ candidate: "candidate:1 1 udp 1 10.0.0.1 9 typ host" }],
};

type Handler = (payload: unknown) => void;

/**
 * A stand-in for the client: it keeps the ReceivedToDeviceMessage handler so a
 * test can deliver events, and records what `send` encrypts and queues.
 */
function fakeClient(
    opts: { delayFirstEncryptMs?: number; emptyBatch?: boolean } = {},
) {
    const handlers = new Map<string, Handler>();
    const queued: {
        eventType: string;
        batch: {
            userId: string;
            deviceId: string;
            payload: Record<string, unknown>;
        }[];
    }[] = [];
    let encryptCalls = 0;
    const encryptToDeviceMessages = vi.fn(
        async (
            eventType: string,
            targets: { userId: string; deviceId: string }[],
            content: Record<string, unknown>,
        ) => {
            const call = encryptCalls++;
            if (call === 0 && opts.delayFirstEncryptMs) {
                await new Promise((r) =>
                    setTimeout(r, opts.delayFirstEncryptMs),
                );
            }
            return {
                eventType: "m.room.encrypted",
                batch: opts.emptyBatch
                    ? []
                    : targets.map((t) => ({ ...t, payload: content })),
            };
        },
    );
    const client = {
        on: vi.fn((name: string, h: Handler) => {
            handlers.set(name, h);
        }),
        off: vi.fn((name: string, h: Handler) => {
            if (handlers.get(name) === h) handlers.delete(name);
        }),
        getCrypto: () => ({ encryptToDeviceMessages }),
        queueToDevice: vi.fn(async (batch: (typeof queued)[number]) => {
            queued.push(batch);
        }),
    };
    return {
        client: client as unknown as MatrixClient,
        raw: client,
        encryptToDeviceMessages,
        queued,
        /** The handler registered for ReceivedToDeviceMessage, if still registered. */
        handler: () => handlers.get(ClientEvent.ReceivedToDeviceMessage),
        deliver(payload: unknown) {
            handlers.get(ClientEvent.ReceivedToDeviceMessage)?.(payload);
        },
    };
}

/** Builds what a peer's device sends us, as the to-device event the SDK hands over. */
function wire(
    peer: { userId: string; deviceId: string; memberId: string },
    payload: SignallingPayload,
    over: Partial<SignallingCommon> = {},
    senderDevice: string | undefined = peer.deviceId,
) {
    const common: SignallingCommon = {
        room_id: ROOM,
        slot_id: SLOT,
        member_id: peer.memberId,
        claimed_device_id: peer.deviceId,
        target_member_id: OWN.memberId,
        connection_id: "conn-1",
        seq: 0,
        ...over,
    };
    const { eventType, content } = buildSignalling(common, payload);
    return {
        message: { type: eventType, content },
        encryptionInfo: {
            sender: peer.userId,
            senderDevice,
            senderCurve25519KeyBase64: "curve-key",
        },
    };
}

const PEER = {
    userId: "@alice:x",
    deviceId: "ADEV",
    memberId: "@alice:x:ADEV",
};

describe("createSignalling", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        resetSeqStoreForTests();
    });
    afterEach(() => {
        warn.mockRestore();
    });

    describe("send", () => {
        it("encrypts to the target device with the subscribe type and the envelope fields, then queues it", async () => {
            const peer = { ...PEER, memberId: "@alice:x:ADEV-send1" };
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });

            sig.send(peer, "conn-7", { type: "subscribe" });
            await vi.waitFor(() => expect(f.queued).toHaveLength(1));

            expect(f.encryptToDeviceMessages).toHaveBeenCalledTimes(1);
            const [eventType, devices, content] =
                f.encryptToDeviceMessages.mock.calls[0];
            expect(eventType).toBe(SIGNALLING_TYPES.subscribe);
            expect(devices).toEqual([
                { userId: peer.userId, deviceId: peer.deviceId },
            ]);
            expect(content).toEqual({
                room_id: ROOM,
                slot_id: SLOT,
                member_id: OWN.memberId,
                claimed_device_id: OWN.deviceId,
                target_member_id: peer.memberId,
                connection_id: "conn-7",
                seq: 0,
            });
            expect(f.queued[0].batch[0].userId).toBe(peer.userId);
            sig.dispose();
        });

        it("counts seq 0, 1, 2 for consecutive sends to the same peer", async () => {
            const peer = { ...PEER, memberId: "@alice:x:ADEV-seq" };
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });

            sig.send(peer, "c", { type: "subscribe" });
            sig.send(peer, "c", CANDIDATE);
            sig.send(peer, "c", { type: "close" });
            await vi.waitFor(() => expect(f.queued).toHaveLength(3));

            const seqs = f.encryptToDeviceMessages.mock.calls.map(
                (c) => (c[2] as { seq: number }).seq,
            );
            expect(seqs).toEqual([0, 1, 2]);
            sig.dispose();
        });

        it("keeps a separate seq per peer", async () => {
            const peerA = { ...PEER, memberId: "@alice:x:ADEV-sepA" };
            const peerB = { ...PEER, memberId: "@alice:x:ADEV-sepB" };
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });

            sig.send(peerA, "c", { type: "subscribe" });
            sig.send(peerB, "c", { type: "subscribe" });
            sig.send(peerA, "c", CANDIDATE);
            sig.send(peerB, "c", CANDIDATE);
            await vi.waitFor(() => expect(f.queued).toHaveLength(4));

            const seqFor = (memberId: string) =>
                f.encryptToDeviceMessages.mock.calls
                    .filter(
                        (c) =>
                            (c[2] as { target_member_id: string })
                                .target_member_id === memberId,
                    )
                    .map((c) => (c[2] as { seq: number }).seq);
            expect(seqFor(peerA.memberId)).toEqual([0, 1]);
            expect(seqFor(peerB.memberId)).toEqual([0, 1]);
            sig.dispose();
        });

        it("queues messages in send order even when the first encryption resolves last", async () => {
            const peer = { ...PEER, memberId: "@alice:x:ADEV-order" };
            const f = fakeClient({ delayFirstEncryptMs: 30 });
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });

            sig.send(peer, "c", { type: "subscribe" });
            sig.send(peer, "c", CANDIDATE);
            await vi.waitFor(() => expect(f.queued).toHaveLength(2));

            const types = f.queued.map((b) => b.eventType);
            expect(types).toEqual(["m.room.encrypted", "m.room.encrypted"]);
            const seqs = f.queued.map(
                (b) => (b.batch[0].payload as { seq: number }).seq,
            );
            expect(seqs).toEqual([0, 1]);
            sig.dispose();
        });

        it("does not throw when there is no Olm session (empty batch), and warns instead", async () => {
            const peer = { ...PEER, memberId: "@alice:x:ADEV-nosession" };
            const f = fakeClient({ emptyBatch: true });
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });

            expect(() =>
                sig.send(peer, "c", { type: "subscribe" }),
            ).not.toThrow();
            await vi.waitFor(() => expect(warn).toHaveBeenCalled());

            expect(f.raw.queueToDevice).not.toHaveBeenCalled();
            expect(warn.mock.calls[0][0]).toContain("[full-mesh]");
            sig.dispose();
        });

        it("sends nothing after dispose", async () => {
            const peer = { ...PEER, memberId: "@alice:x:ADEV-afterdispose" };
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });
            sig.dispose();
            sig.send(peer, "c", { type: "subscribe" });
            await new Promise((r) => setTimeout(r, 0));
            expect(f.encryptToDeviceMessages).not.toHaveBeenCalled();
            expect(f.raw.queueToDevice).not.toHaveBeenCalled();
        });
    });

    describe("seq across joins and reloads", () => {
        function sender(
            f: ReturnType<typeof fakeClient>,
            peerSince?: () => number | undefined,
        ) {
            return createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
                peerSince,
            });
        }
        const seqs = (f: ReturnType<typeof fakeClient>) =>
            f.encryptToDeviceMessages.mock.calls.map(
                (c) => (c[2] as { seq: number }).seq,
            );

        // A receiver that stays drops anything below the seq it expects
        // (Element Call does), and our member id is the same after a reload.
        it("keeps counting after a reload of ours", async () => {
            const f = fakeClient();
            const before = sender(f);
            before.send(PEER, "c", { type: "subscribe" });
            before.send(PEER, "c", CANDIDATE);
            await vi.waitFor(() => expect(f.queued).toHaveLength(2));
            before.dispose();

            resetSeqStoreForTests(true);
            const after = sender(f);
            after.send(PEER, "c2", { type: "subscribe" });
            await vi.waitFor(() => expect(f.queued).toHaveLength(3));
            expect(seqs(f)).toEqual([0, 1, 2]);
            after.dispose();
        });

        it("starts over at 0 when the peer rejoined (a new created_ts)", async () => {
            const f = fakeClient();
            let since = 1000;
            const sig = sender(f, () => since);
            sig.send(PEER, "c", { type: "subscribe" });
            sig.send(PEER, "c", CANDIDATE);
            since = 2000;
            sig.send(PEER, "c2", { type: "subscribe" });
            sig.send(PEER, "c2", CANDIDATE);
            await vi.waitFor(() => expect(f.queued).toHaveLength(4));
            expect(seqs(f)).toEqual([0, 1, 0, 1]);
            sig.dispose();
        });

        it("keeps counting when the peer's created_ts only becomes known", async () => {
            const f = fakeClient();
            let since: number | undefined;
            const sig = sender(f, () => since);
            sig.send(PEER, "c", { type: "subscribe" });
            since = 1000;
            sig.send(PEER, "c", CANDIDATE);
            since = undefined;
            sig.send(PEER, "c", CANDIDATE);
            await vi.waitFor(() => expect(f.queued).toHaveLength(3));
            expect(seqs(f)).toEqual([0, 1, 2]);
            sig.dispose();
        });

        it("starts over after a reload when the peer rejoined meanwhile", async () => {
            const f = fakeClient();
            const before = sender(f, () => 1000);
            before.send(PEER, "c", { type: "subscribe" });
            await vi.waitFor(() => expect(f.queued).toHaveLength(1));
            before.dispose();

            resetSeqStoreForTests(true);
            const after = sender(f, () => 2000);
            after.send(PEER, "c2", { type: "subscribe" });
            await vi.waitFor(() => expect(f.queued).toHaveLength(2));
            expect(seqs(f)).toEqual([0, 0]);
            after.dispose();
        });
    });

    describe("receiving", () => {
        function setup() {
            const f = fakeClient();
            const received: SignallingMessage[] = [];
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: (m) => received.push(m),
            });
            return { f, received, sig };
        }

        it("delivers a valid message with the peer identity from the envelope and the claim", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, { connection_id: "conn-9" }));

            expect(received).toEqual([
                {
                    peer: {
                        userId: PEER.userId,
                        deviceId: PEER.deviceId,
                        memberId: PEER.memberId,
                    },
                    connectionId: "conn-9",
                    payload: CANDIDATE,
                },
            ]);
            sig.dispose();
        });

        it("drops a message with no encryption info", () => {
            const { f, received, sig } = setup();
            const event = wire(PEER, CANDIDATE);
            f.deliver({ ...event, encryptionInfo: null });
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("drops an event type that is not one of the four", () => {
            const { f, received, sig } = setup();
            const event = wire(PEER, CANDIDATE);
            f.deliver({
                ...event,
                message: {
                    ...event.message,
                    type: "org.matrix.msc4575.rtc.full_mesh.other",
                },
            });
            f.deliver({
                ...event,
                message: { ...event.message, type: "m.room.message" },
            });
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("drops a message for another room", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, { room_id: "!other:x" }));
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("drops a message for another slot", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, { slot_id: "m.call#OTHER" }));
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("drops a message whose target is not us", () => {
            const { f, received, sig } = setup();
            f.deliver(
                wire(PEER, CANDIDATE, { target_member_id: "@carol:x:CDEV" }),
            );
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("drops a message whose Olm sender device differs from the claimed device", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, {}, "SOMEONE-ELSE"));
            expect(received).toHaveLength(0);
            sig.dispose();
        });

        it("delivers when the Olm sender device is unknown", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, {}, undefined));
            expect(received).toHaveLength(1);
            sig.dispose();
        });

        // The first seq 0 can come after later ones: it is not a restart.
        it("delivers in seq order when seq 1 arrives before seq 0", () => {
            const { f, received, sig } = setup();
            const first = {
                type: "candidates",
                candidates: [{ candidate: "c0" }],
            } as SignallingPayload;
            const second = {
                type: "candidates",
                candidates: [{ candidate: "c1" }],
            } as SignallingPayload;
            f.deliver(wire(PEER, second, { seq: 1, connection_id: "conn-o" }));
            expect(received).toHaveLength(0);
            f.deliver(wire(PEER, first, { seq: 0, connection_id: "conn-o" }));

            expect(received.map((m) => m.payload)).toEqual([first, second]);
            sig.dispose();
        });

        it("treats a seq 0 after others as a restarted sender and delivers it", () => {
            const { f, received, sig } = setup();
            f.deliver(wire(PEER, CANDIDATE, { seq: 0 }));
            f.deliver(wire(PEER, CANDIDATE, { seq: 1 }));
            f.deliver(wire(PEER, CANDIDATE, { seq: 2 }));
            expect(received).toHaveLength(3);

            // A reload: the sender's counter starts again at 0.
            f.deliver(
                wire(PEER, CANDIDATE, { seq: 0, connection_id: "conn-2" }),
            );
            expect(received).toHaveLength(4);
            expect(received[3].connectionId).toBe("conn-2");

            f.deliver(
                wire(PEER, CANDIDATE, { seq: 1, connection_id: "conn-2" }),
            );
            expect(received).toHaveLength(5);
            sig.dispose();
        });

        // We reloaded while the sender stayed: our count of them started
        // midway, without a seq 0. When they rejoin, their 0 is a restart.
        it("treats a seq 0 as a restart when the count started midway", () => {
            vi.useFakeTimers();
            try {
                const { f, received, sig } = setup();
                f.deliver(wire(PEER, CANDIDATE, { seq: 7 }));
                vi.advanceTimersByTime(1_000);
                f.deliver(wire(PEER, CANDIDATE, { seq: 8 }));
                expect(received).toHaveLength(2);

                f.deliver(
                    wire(PEER, CANDIDATE, { seq: 0, connection_id: "conn-2" }),
                );
                expect(received).toHaveLength(3);
                expect(received[2].connectionId).toBe("conn-2");
                sig.dispose();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("dispose", () => {
        it("unregisters the to-device handler", () => {
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage: () => {},
            });
            const registered = f.handler();
            expect(registered).toBeDefined();

            sig.dispose();
            expect(f.raw.off).toHaveBeenCalledWith(
                ClientEvent.ReceivedToDeviceMessage,
                registered,
            );
            expect(f.handler()).toBeUndefined();
        });

        it("does not deliver events that still reach the old handler", () => {
            const onMessage = vi.fn();
            const f = fakeClient();
            const sig = createSignalling({
                client: f.client,
                roomId: ROOM,
                slotId: SLOT,
                own: OWN,
                onMessage,
            });
            const stale = f.handler()!;
            sig.dispose();

            stale(wire(PEER, CANDIDATE));
            expect(onMessage).not.toHaveBeenCalled();
        });
    });
});
