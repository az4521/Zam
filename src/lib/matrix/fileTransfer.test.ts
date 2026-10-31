import { ClientEvent, RoomEvent } from "matrix-js-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    FILE_OFFER_EVENT,
    FILE_REFUSE_TYPE,
    parseFileOffer,
} from "$lib/utils/fileTransfer";

// Two sessions need two copies of the module: it holds one client at a time.
// These stand in for the homeserver's to-device relay and the SFU.
type ToDeviceListener = (payload: unknown) => void;

interface FakeDevice {
    userId: string;
    deviceId: string;
    listener: ToDeviceListener | null;
}

const devices = new Map<string, FakeDevice>();
const rooms = new Map<string, Map<string, FakeRoom>>();
const joined: string[] = [];
const sent: { type: string; to: string }[] = [];
let dropTo: ((type: string) => boolean) | null = null;
let memberships: Record<string, string> = {};
const SENDER = "@alice:x:A";
const RECEIVER = "@bob:x:B";

class FakeRoom {
    private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
    constructor(
        readonly alias: string,
        readonly identity: string,
    ) {}
    on(name: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
    }
    emit(name: string, ...args: unknown[]) {
        for (const h of this.handlers.get(name) ?? []) h(...args);
    }
    localParticipant = {
        publishData: async (
            data: Uint8Array,
            options: { topic: string; destinationIdentities: string[] },
        ) => {
            const members = rooms.get(this.alias)!;
            for (const id of options.destinationIdentities) {
                queueMicrotask(() =>
                    members
                        .get(id)
                        ?.emit(
                            "dataReceived",
                            data,
                            { identity: this.identity },
                            0,
                            options.topic,
                        ),
                );
            }
        },
    };
    async disconnect() {
        rooms.get(this.alias)?.delete(this.identity);
    }
}

vi.mock("./livekitCall", () => ({
    ownSfuTarget: async (alias: string) => ({
        serviceUrl: "https://sfu.example",
        alias,
    }),
    joinHiddenSfuRoom: async (target: { alias: string }) => {
        if (!rooms.has(target.alias)) rooms.set(target.alias, new Map());
        // The sender makes the room, then tells the receiver its name.
        const identity = rooms.get(target.alias)!.size ? RECEIVER : SENDER;
        const room = new FakeRoom(target.alias, identity);
        rooms.get(target.alias)!.set(identity, room);
        joined.push(target.alias);
        return {
            room,
            lk: {
                RoomEvent: {
                    DataReceived: "dataReceived",
                    Disconnected: "disconnected",
                },
            },
        };
    },
}));

const sink = vi.hoisted(() => ({
    written: new Map<number, Uint8Array>(),
    finished: 0,
    aborted: 0,
    backedOut: false,
}));

vi.mock("./fileTransferSink", () => ({
    SaveUnsupportedError: class extends Error {},
    StorageFullError: class extends Error {},
    cleanOldScratch: async () => {},
    holdAppForTransfer: () => () => {},
    openSaveSink: async () =>
        sink.backedOut
            ? null
            : {
                  write: async (position: number, data: Uint8Array) => {
                      sink.written.set(position, data);
                  },
                  finish: async () => {
                      sink.finished++;
                  },
                  abort: async () => {
                      sink.aborted++;
                  },
              },
}));

vi.mock("./keyBackfill", () => ({ deviceAllowed: () => true }));
vi.mock("$lib/stores/ignoredUsers.svelte", () => ({
    isUserBlocked: (userId: string) => userId === "@blocked:x",
}));

function fakeClient(userId: string, deviceId: string) {
    const device: FakeDevice = { userId, deviceId, listener: null };
    devices.set(`${userId}|${deviceId}`, device);
    const events: { type: string; content: unknown; roomId: string }[] = [];
    const redacted: string[] = [];
    let redactionListener: ToDeviceListener = () => {};
    return {
        events,
        redacted,
        getUserId: () => userId,
        getDeviceId: () => deviceId,
        getRoom: () => ({
            getMember: (id: string) => ({
                membership: memberships[id] ?? "join",
            }),
        }),
        on(name: string, listener: ToDeviceListener) {
            if (name === ClientEvent.ReceivedToDeviceMessage)
                device.listener = listener;
            if (name === RoomEvent.Redaction) redactionListener = listener;
        },
        /** An offer deleted some other way than Withdraw. */
        redact(eventId: string) {
            redactionListener({ getAssociatedId: () => eventId });
        },
        off() {
            device.listener = null;
        },
        async sendEvent(roomId: string, type: string, content: unknown) {
            events.push({ type, content, roomId });
            return { event_id: "$offer" };
        },
        async redactEvent(_roomId: string, eventId: string) {
            redacted.push(eventId);
        },
        async queueToDevice(batch: {
            eventType: string;
            batch: {
                userId: string;
                deviceId: string;
                payload: Record<string, unknown>;
            }[];
        }) {
            for (const { userId: to, deviceId: dev, payload } of batch.batch) {
                sent.push({ type: batch.eventType, to });
                if (dropTo?.(batch.eventType)) continue;
                queueMicrotask(() =>
                    devices.get(`${to}|${dev}`)?.listener?.({
                        message: { type: batch.eventType, content: payload },
                        encryptionInfo: {
                            sender: userId,
                            senderDevice: deviceId,
                            senderCurve25519KeyBase64: "k",
                        },
                    }),
                );
            }
        },
        getCrypto: () => ({
            encryptToDeviceMessages: async (
                eventType: string,
                targets: { userId: string; deviceId: string }[],
                payload: unknown,
            ) => ({
                eventType,
                batch: targets.map((t) => ({ ...t, payload })),
            }),
            getDeviceVerificationStatus: async () => ({}),
        }),
    };
}

async function session(userId: string, deviceId: string) {
    vi.resetModules();
    const transfer = await import("./fileTransfer");
    const store = await import("$lib/stores/fileTransfers.svelte");
    const client = fakeClient(userId, deviceId);
    transfer.attachFileTransfer(client as never);
    return { transfer, store, client };
}

function offerIn(alice: Awaited<ReturnType<typeof session>>) {
    const offer = parseFileOffer(alice.client.events[0].content);
    if (!offer) throw new Error("no offer");
    return offer;
}

async function until(check: () => boolean) {
    await vi.waitFor(
        () => {
            if (!check()) throw new Error("not yet");
        },
        { timeout: 4000, interval: 5 },
    );
}

/** Both ends are in this test's room and blocks are landing. A send from the
 *  test before can still be finishing, so the sink alone doesn't show it. */
async function untilTransferring() {
    await until(() => joined.length === 2);
    sink.written.clear();
    await until(() => sink.written.size > 0);
}

function fileOf(size: number): File {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 509) bytes[i] = i & 0xff;
    return new File([bytes], "movie.mkv", { type: "video/x-matroska" });
}

beforeEach(() => {
    devices.clear();
    rooms.clear();
    joined.length = 0;
    sent.length = 0;
    dropTo = null;
    memberships = {};
    sink.written.clear();
    sink.finished = 0;
    sink.aborted = 0;
    sink.backedOut = false;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a direct transfer", () => {
    it("posts an offer other clients won't render", async () => {
        const alice = await session("@alice:x", "A");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        expect(alice.client.events[0].type).toBe(FILE_OFFER_EVENT);
        expect(offerIn(alice)).toMatchObject({
            name: "movie.mkv",
            size: 10,
            senderDevice: "A",
        });
        expect(joined).toEqual([]);
    });

    it("moves a file and checks it, with nothing posted but the offer", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        const size = 2 * 1024 * 1024 + 5;
        await alice.transfer.offerFile("!r:x", fileOf(size));
        await bob.transfer.acceptOffer("!r:x", "@alice:x", offerIn(alice));
        expect(sink.finished).toBe(1);
        expect(sink.aborted).toBe(0);
        expect(sink.written.size).toBe(3);
        expect(alice.client.events).toHaveLength(1);
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "done",
            ),
        );
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "done",
            direction: "receive",
            bytes: size,
        });
        expect(new Set(joined).size).toBe(1);
        expect(joined[0]).toMatch(/^!r:x\|zam-transfer-/);
    });

    it("discards the file when the final hash doesn't match", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        // The sender hashes first, so the two ends part ways here.
        let calls = 0;
        const digest = crypto.subtle.digest.bind(crypto.subtle);
        vi.spyOn(crypto.subtle, "digest").mockImplementation(
            async (algorithm, data) => {
                calls++;
                const out = await digest(algorithm, data as BufferSource);
                if (calls === 1) new Uint8Array(out)[0] ^= 1;
                return out;
            },
        );
        await bob.transfer.acceptOffer("!r:x", "@alice:x", offerIn(alice));
        expect(sink.finished).toBe(0);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "hash-mismatch",
        });
    });

    it("refuses someone who has left the room", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        memberships["@bob:x"] = "leave";
        await bob.transfer.acceptOffer("!r:x", "@alice:x", offerIn(alice));
        expect(sent.some((m) => m.type === FILE_REFUSE_TYPE)).toBe(true);
        expect(joined).toEqual([]);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("does nothing when the save dialog is dismissed", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        sink.backedOut = true;
        await bob.transfer.acceptOffer("!r:x", "@alice:x", offerIn(alice));
        expect(sent).toEqual([]);
        expect(bob.store.fileTransfersState.views).toEqual([]);
    });

    it("refuses a request for an offer it never made", async () => {
        await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await bob.transfer.acceptOffer("!r:x", "@alice:x", {
            transferId: "made-up",
            name: "x",
            size: 1,
            mimetype: "text/plain",
            senderDevice: "A",
            expiresTs: Date.now() + 1000,
        });
        expect(joined).toEqual([]);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("gives up when the sender's device doesn't answer", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        const offer = { ...offerIn(alice), senderDevice: "OTHER" };
        dropTo = (type) => type.endsWith(".request");
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = bob.transfer.acceptOffer("!r:x", "@alice:x", offer);
        await vi.advanceTimersByTimeAsync(31_000);
        await accepting;
        vi.useRealTimers();
        expect(bob.store.fileTransfersState.views[0].failure).toBe("offline");
        expect(joined).toEqual([]);
    });

    it("stops both ends when the sender withdraws", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(40 * 1024 * 1024));
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "@alice:x",
            offerIn(alice),
        );
        await untilTransferring();
        await alice.transfer.withdrawOffer(offerIn(alice).transferId);
        await accepting;
        expect(alice.client.redacted).toEqual(["$offer"]);
        expect(sink.finished).toBe(0);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0].phase).toBe("cancelled");
        expect(alice.store.isOffered(offerIn(alice).transferId)).toBe(false);
    });

    it("treats deleting the offer as withdrawing it", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(40 * 1024 * 1024));
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "@alice:x",
            offerIn(alice),
        );
        await untilTransferring();
        alice.client.redact("$offer");
        await accepting;
        expect(sink.finished).toBe(0);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "cancelled",
            failure: null,
        });
        expect(alice.store.isOffered(offerIn(alice).transferId)).toBe(false);
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "cancelled",
            ),
        );
    });

    it("refuses requests once the offer is deleted", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        alice.client.redact("$offer");
        await bob.transfer.acceptOffer("!r:x", "@alice:x", offerIn(alice));
        expect(joined).toEqual([]);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("carries on when some other message is deleted", async () => {
        const alice = await session("@alice:x", "A");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        alice.client.redact("$other");
        expect(alice.store.isOffered(offerIn(alice).transferId)).toBe(true);
    });

    it("lets the receiver cancel", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(40 * 1024 * 1024));
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "@alice:x",
            offerIn(alice),
        );
        await untilTransferring();
        const view = bob.store.fileTransfersState.views[0];
        bob.transfer.cancelTransfer(view.id, view.transferId);
        await accepting;
        expect(bob.store.fileTransfersState.views[0].phase).toBe("cancelled");
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "cancelled",
            ),
        );
    });

    it("keeps offers through a restart of encryption", async () => {
        const alice = await session("@alice:x", "A");
        const detach = alice.transfer.attachFileTransfer(alice.client as never);
        await alice.transfer.offerFile("!r:x", fileOf(10));
        detach();
        alice.transfer.attachFileTransfer(alice.client as never);
        expect(alice.store.fileTransfersState.offered).toHaveLength(1);
    });

    it("forgets offers when another account signs in", async () => {
        const alice = await session("@alice:x", "A");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        alice.transfer.attachFileTransfer(fakeClient("@carol:x", "C") as never);
        expect(alice.store.fileTransfersState.offered).toEqual([]);
    });
});
