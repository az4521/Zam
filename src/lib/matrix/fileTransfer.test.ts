import type { MatrixEvent } from "matrix-js-sdk";
import { ClientEvent, RoomEvent } from "matrix-js-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    FILE_ACCEPT_TYPE,
    FILE_ACCEPTED_TYPE,
    FILE_ANSWER_TYPE,
    FILE_CANCEL_TYPE,
    FILE_CANDIDATES_TYPE,
    FILE_DONE_TYPE,
    FILE_OFFER_EVENT,
    FILE_PREPARING_TYPE,
    FILE_REFUSE_TYPE,
    FILE_REQUEST_TYPE,
    parseFileOffer,
} from "$lib/utils/fileTransfer";

// Two sessions need two copies of the module: it holds one client at a time.
// These stand in for the homeserver's to-device relay, the SFU and the
// WebRTC data channel between two devices.
type ToDeviceListener = (payload: unknown) => void;

interface FakeDevice {
    userId: string;
    deviceId: string;
    listener: ToDeviceListener | null;
}

const SENDER = "@alice:x:A";
const RECEIVER = "@bob:x:B";

const devices = new Map<string, FakeDevice>();
/** The devices each user has, for the crypto API's device list. */
const accounts = new Map<string, string[]>();
/** Devices of this user that are cross-signed. */
const crossSigned = new Set<string>();
const rooms = new Map<string, Map<string, FakeRoom>>();
/** Who made each room: the only one the SFU lets publish in it (MSC4576). */
const owners = new Map<string, string>();
const joined: { identity: string; alias: string }[] = [];
/** Publishes the SFU dropped: someone else's room. */
let foreignPublishes = 0;
/** Every to-device message sent, as the sending client saw it. */
const sent: {
    type: string;
    from: string;
    to: string;
    content: Record<string, unknown>;
    /** The receiver's count of finished files when this was sent. */
    finished: number;
}[] = [];
let dropTo: ((type: string) => boolean) | null = null;
/** Changes a message on its way to the device that receives it. */
let tamper:
    | ((
          type: string,
          content: Record<string, unknown>,
      ) => Record<string, unknown>)
    | null = null;
/** Identities whose homeserver has no SFU. */
const sfuless = new Set<string>();
/** Users whose named SFU their homeserver doesn't advertise. */
const rogueSfu = new Set<string>();
/** Identities that say no when asked to connect directly. */
const declines = new Set<string>();
const consentAsked: { identity: string; fileTransfer: boolean }[] = [];
/** Direct data channels, by side and identity, and their relay setting. */
const directLog: { side: string; identity: string; relayOnly: boolean }[] = [];
/** The SDP of each end, so the other can find it. */
const directEnds = new Map<string, FakeDirectEnd>();
/** Candidates each end was handed, with the identity of that end. */
const directCandidates: { at: string; value: unknown }[] = [];
let directSeq = 0;
/** The real timers, kept for waits that must not follow the fake clock. */
const realSetTimeout = globalThis.setTimeout;
/** Each client's teardown, run after its test. */
const detachers: (() => void)[] = [];
/** The identity of every LiveKit publish, as the publisher saw it. */
const publishers: string[] = [];
/** Rooms whose events are encrypted. */
const encryptedRooms = new Set<string>();
/** Delay of each direct-link packet, in fake time. Zero: next tick. */
const directLink = { delayMs: 0 };
/** Packets each direct link sent, by the sending identity. */
const directPackets: { from: string; packet: Uint8Array }[] = [];
/** Delay of each to-device message type, in fake time. */
let deliveryDelay: ((type: string) => number) | null = null;

interface FakeDirectEnd {
    identity: string;
    handler: (packet: Uint8Array) => void;
    onFailed: () => void;
    peer: FakeDirectEnd | null;
    closed: boolean;
}

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
            publishers.push(this.identity);
            if (owners.get(this.alias) !== this.identity) {
                foreignPublishes++;
                return;
            }
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

/** One session's SFU connections, as `identity`. */
function fakeLivekit(identity: string) {
    return {
        callIceConfig: async () => ({ iceServers: [] }),
        homeserverTurn: async () => null,
        sfuAdvertisedBy: async (userId: string) => !rogueSfu.has(userId),
        ownSfuTarget: async (alias: string) =>
            sfuless.has(identity)
                ? null
                : { serviceUrl: "https://sfu.example", alias },
        joinHiddenSfuRoom: async (target: { alias: string }) => {
            if (!rooms.has(target.alias)) {
                rooms.set(target.alias, new Map());
                owners.set(target.alias, identity);
            }
            const room = new FakeRoom(target.alias, identity);
            rooms.get(target.alias)!.set(identity, room);
            joined.push({ identity, alias: target.alias });
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
    };
}

/** One session's data channels, as `identity`. Both ends link as they open. */
function fakeDirect(identity: string) {
    const linkOf = (end: FakeDirectEnd) => ({
        send: async (packet: Uint8Array) => {
            const peer = end.peer;
            if (end.closed || !peer || peer.closed)
                throw new Error("link down");
            directPackets.push({ from: identity, packet });
            const deliver = () => peer.handler(packet);
            if (directLink.delayMs > 0) setTimeout(deliver, directLink.delayMs);
            else queueMicrotask(deliver);
        },
        onPacket: (h: (packet: Uint8Array) => void) => {
            end.handler = h;
        },
        close: () => {
            if (end.closed) return;
            end.closed = true;
            // The other end learns of it, as a channel closing tells it.
            const peer = end.peer;
            if (peer && !peer.closed) setTimeout(() => peer.onFailed(), 0);
        },
    });
    return {
        openSenderDirect: async (opts: {
            relayOnly: boolean;
            sendCandidates: (list: unknown[]) => void;
            onFailed: () => void;
        }) => {
            const id = ++directSeq;
            const offerSdp = `v=0\r\no=sender-${id}\r\n`;
            const end: FakeDirectEnd = {
                identity,
                handler: () => {},
                onFailed: opts.onFailed,
                peer: null,
                closed: false,
            };
            directEnds.set(offerSdp, end);
            directLog.push({
                side: "sender",
                identity,
                relayOnly: opts.relayOnly,
            });
            // Found before the other end has anything: held until the accept is out.
            opts.sendCandidates([
                {
                    candidate: `candidate:sender-${id}`,
                    sdpMid: "0",
                    sdpMLineIndex: 0,
                },
            ]);
            return {
                link: linkOf(end),
                offerSdp,
                acceptAnswer: async (sdp: string) => {
                    const other = directEnds.get(sdp);
                    if (!other) throw new Error("no such answer");
                    end.peer = other;
                },
                addCandidates: async (value: unknown) => {
                    directCandidates.push({ at: identity, value });
                },
            };
        },
        openReceiverDirect: async (opts: {
            relayOnly: boolean;
            offerSdp: string;
            sendCandidates: (list: unknown[]) => void;
            onFailed: () => void;
        }) => {
            const offerEnd = directEnds.get(opts.offerSdp);
            if (!offerEnd) throw new Error("no such offer");
            const id = ++directSeq;
            const answerSdp = `v=0\r\no=receiver-${id}\r\n`;
            const end: FakeDirectEnd = {
                identity,
                handler: () => {},
                onFailed: opts.onFailed,
                peer: offerEnd,
                closed: false,
            };
            offerEnd.peer = end;
            directEnds.set(answerSdp, end);
            directLog.push({
                side: "receiver",
                identity,
                relayOnly: opts.relayOnly,
            });
            opts.sendCandidates([
                {
                    candidate: `candidate:receiver-${id}`,
                    sdpMid: "0",
                    sdpMLineIndex: 0,
                },
            ]);
            return {
                link: linkOf(end),
                answerSdp,
                addCandidates: async (value: unknown) => {
                    directCandidates.push({ at: identity, value });
                },
            };
        },
    };
}

/** Hashing can be held open by a test, and a root can be spoiled. */
const hashGate = vi.hoisted(() => ({
    wait: null as Promise<void> | null,
    corruptRoot: false,
}));

vi.mock("$lib/utils/fileTransferHash", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("$lib/utils/fileTransferHash")>();
    return {
        ...actual,
        hashFile: async (
            file: Blob,
            opts?: Parameters<typeof actual.hashFile>[1],
        ) => {
            if (hashGate.wait) await hashGate.wait;
            const out = await actual.hashFile(file, opts);
            if (hashGate.corruptRoot) out.root[0] ^= 1;
            return out;
        },
    };
});

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
    accounts.set(userId, [...(accounts.get(userId) ?? []), deviceId]);
    const events: { type: string; content: unknown; roomId: string }[] = [];
    const redacted: string[] = [];
    let redactionListener: ToDeviceListener = () => {};
    return {
        events,
        redacted,
        getUserId: () => userId,
        getDeviceId: () => deviceId,
        getRoom: (roomId: string) => ({
            getMember: (id: string) => ({
                membership: memberships[id] ?? "join",
            }),
            hasEncryptionStateEvent: () => encryptedRooms.has(roomId),
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
                sent.push({
                    type: batch.eventType,
                    from: `${userId}:${deviceId}`,
                    to: `${to}|${dev}`,
                    content: payload,
                    finished: sink.finished,
                });
                if (dropTo?.(batch.eventType)) continue;
                const delivered = tamper
                    ? tamper(batch.eventType, payload)
                    : payload;
                const deliver = () =>
                    devices.get(`${to}|${dev}`)?.listener?.({
                        message: { type: batch.eventType, content: delivered },
                        encryptionInfo: {
                            sender: userId,
                            senderDevice: deviceId,
                            senderCurve25519KeyBase64: "k",
                        },
                    });
                const later = deliveryDelay?.(batch.eventType) ?? 0;
                if (later > 0) setTimeout(deliver, later);
                else queueMicrotask(deliver);
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
            getDeviceVerificationStatus: async (
                _userId: string,
                id: string,
            ) => ({ crossSigningVerified: crossSigned.has(id) }),
            getUserDeviceInfo: async (userIds: string[]) =>
                new Map(
                    userIds.map((id) => [
                        id,
                        new Map(
                            (accounts.get(id) ?? []).map((d) => [
                                d,
                                { getIdentityKey: () => `key-${d}` },
                            ]),
                        ),
                    ]),
                ),
        }),
    };
}

const memberships: Record<string, string> = {};

async function session(userId: string, deviceId: string) {
    vi.resetModules();
    const identity = `${userId}:${deviceId}`;
    vi.doMock("./livekitCall", () => fakeLivekit(identity));
    vi.doMock("./fileTransferDirect", () => fakeDirect(identity));
    vi.doMock("$lib/stores/meshConsent.svelte", () => ({
        requestMeshConsent: async (request: { fileTransfer?: boolean }) => {
            consentAsked.push({
                identity,
                fileTransfer: !!request.fileTransfer,
            });
            return declines.has(identity) ? "cancel" : "allow";
        },
    }));
    const transfer = await import("./fileTransfer");
    const store = await import("$lib/stores/fileTransfers.svelte");
    const client = fakeClient(userId, deviceId);
    // Torn down after the test, so nothing it started sends into the next one.
    detachers.push(transfer.attachFileTransfer(client as never));
    return { transfer, store, client };
}

type Session = Awaited<ReturnType<typeof session>>;

/** The offer `alice` posted, as a receiver reads it. */
function offerIn(alice: Session) {
    const offer = parseFileOffer(alice.client.events[0].content);
    if (!offer) throw new Error("no offer");
    return offer;
}

/** `bob` accepts the offer `alice` posted. */
function acceptIn(bob: Session, alice: Session) {
    return bob.transfer.acceptOffer(
        "!r:x",
        "$offer",
        "@alice:x",
        offerIn(alice),
    );
}

async function until(check: () => boolean) {
    await vi.waitFor(
        () => {
            if (!check()) throw new Error("not yet");
        },
        { timeout: 4000, interval: 5 },
    );
}

/** The rooms `identity` joined. */
function joinedBy(identity: string) {
    return joined.filter((j) => j.identity === identity).map((j) => j.alias);
}

/** Both ends are in both of this test's rooms and blocks are landing. A send from the
 *  test before can still be finishing, so the sink alone doesn't show it. */
async function untilTransferring() {
    await until(() => joined.length === 4);
    sink.written.clear();
    await until(() => sink.written.size > 0);
}

/** Runs fake time until `p` settles. Stepped: under load the setup can
 *  outlast one big advance, and then only real time is left. Each step also
 *  gives the real crypto in the transfer some real time to finish, so a
 *  step can't run out a deadline the transfer hasn't reached yet. */
async function settleWithTimers<T>(p: Promise<T>): Promise<T> {
    let settled = false;
    void p.then(
        () => (settled = true),
        () => (settled = true),
    );
    while (!settled) {
        await vi.advanceTimersByTimeAsync(1_000);
        await new Promise((r) => realSetTimeout(r, 20));
    }
    return p;
}

/** Waits in real time, for something the transfer does with real crypto. */
async function untilReal(check: () => boolean) {
    for (let i = 0; i < 1_000 && !check(); i++)
        await new Promise((r) => realSetTimeout(r, 10));
    if (!check()) throw new Error("never happened");
}

/** Moves fake time on, a step at a time, until `check` holds. */
async function advanceUntil(check: () => boolean) {
    for (let i = 0; i < 2_000 && !check(); i++) {
        await vi.advanceTimersByTimeAsync(500);
        await new Promise((r) => realSetTimeout(r, 20));
    }
    if (!check()) throw new Error("never happened");
}

/** The phase of `who`'s transfer view in one direction, if there is one. */
function phaseOf(who: Session, direction: "send" | "receive") {
    return who.store.fileTransfersState.views.find(
        (v) => v.direction === direction,
    )?.phase;
}

/** A request from `bob`'s device, as Olm would deliver it to `alice`'s. */
function requestToAlice(transferId: string, roomId = "!r:x") {
    devices.get("@alice:x|A")!.listener!({
        message: {
            type: FILE_REQUEST_TYPE,
            content: {
                transfer_id: transferId,
                event_id: "$offer",
                room_id: roomId,
            },
        },
        encryptionInfo: { sender: "@bob:x", senderDevice: "B" },
    });
}

/** A cancel from `alice`'s device, as Olm would deliver it to `bob`'s. */
function cancelToBob(transferId: string, reason: string) {
    devices.get("@bob:x|B")!.listener!({
        message: {
            type: FILE_CANCEL_TYPE,
            content: {
                transfer_id: transferId,
                event_id: "$offer",
                reason,
            },
        },
        encryptionInfo: { sender: "@alice:x", senderDevice: "A" },
    });
}

function fileOf(size: number): File {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 509) bytes[i] = i & 0xff;
    return new File([bytes], "movie.mkv", { type: "video/x-matroska" });
}

/** The first message of `type` that `from` sent. */
function sentBy(from: string, type: string) {
    return sent.find((m) => m.from === from && m.type === type);
}

beforeEach(() => {
    devices.clear();
    accounts.clear();
    crossSigned.clear();
    rooms.clear();
    owners.clear();
    sfuless.clear();
    rogueSfu.clear();
    declines.clear();
    consentAsked.length = 0;
    directLog.length = 0;
    directEnds.clear();
    directCandidates.length = 0;
    joined.length = 0;
    foreignPublishes = 0;
    sent.length = 0;
    dropTo = null;
    tamper = null;
    for (const key of Object.keys(memberships)) delete memberships[key];
    hashGate.wait = null;
    hashGate.corruptRoot = false;
    sink.written.clear();
    sink.finished = 0;
    sink.aborted = 0;
    sink.backedOut = false;
    publishers.length = 0;
    encryptedRooms.clear();
    directLink.delayMs = 0;
    directPackets.length = 0;
    deliveryDelay = null;
});

afterEach(() => {
    vi.useRealTimers();
    for (const detach of detachers.splice(0)) detach();
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
        // The first test pays for loading the modules.
    }, 20_000);

    it("moves a file and checks it, with nothing posted but the offer", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        const size = 2 * 1024 * 1024 + 5;
        await alice.transfer.offerFile("!r:x", fileOf(size));
        await acceptIn(bob, alice);
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
        // Each end publishes in its own room only, and listens in the other's.
        const [own, peer] = joinedBy(RECEIVER);
        expect(own).toMatch(/^zam-transfer-/);
        expect(owners.get(own)).toBe(RECEIVER);
        expect(owners.get(peer)).toBe(SENDER);
        expect(joinedBy(SENDER)).toEqual([peer, own]);
        expect(foreignPublishes).toBe(0);
    });

    it("acknowledges over to-device messages when the receiver has no SFU", async () => {
        const alice = await session("@alice:x", "A");
        sfuless.add(RECEIVER);
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = acceptIn(bob, alice);
        await settleWithTimers(accepting);
        vi.useRealTimers();
        expect(joinedBy(RECEIVER)).toEqual(joinedBy(SENDER));
        // Its acknowledgements go as to-device messages, never into the sender's room.
        expect(publishers).not.toContain(RECEIVER);
        expect(sent.some((m) => m.type.endsWith(".ack"))).toBe(true);
        expect(sink.finished).toBe(1);
    });

    it("won't join a receiver's SFU their homeserver doesn't advertise", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        rogueSfu.add("@bob:x");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = acceptIn(bob, alice);
        await settleWithTimers(accepting);
        vi.useRealTimers();
        const [bobsRoom, alicesRoom] = joinedBy(RECEIVER);
        expect(joinedBy(SENDER)).toEqual([alicesRoom]);
        expect(joinedBy(SENDER)).not.toContain(bobsRoom);
        expect(sent.some((m) => m.type.endsWith(".ack"))).toBe(true);
        expect(sink.finished).toBe(1);
    });

    it("won't join a sender's SFU their homeserver doesn't advertise", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        rogueSfu.add("@alice:x");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        await until(() =>
            bob.store.fileTransfersState.views.some(
                (v) => v.phase === "failed",
            ),
        );
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "connection",
        });
        expect(joinedBy(RECEIVER).some((a) => owners.get(a) === SENDER)).toBe(
            false,
        );
        expect(sink.finished).toBe(0);
    });

    it("connects the two devices when the sender has no SFU", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        const size = 2 * 1024 * 1024 + 5;
        await alice.transfer.offerFile("!r:x", fileOf(size));
        await acceptIn(bob, alice);
        expect(sink.finished).toBe(1);
        expect(sink.written.size).toBe(3);
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "done",
            ),
        );
        // Both are asked, as the page about IP addresses, before connecting.
        expect(consentAsked).toEqual([
            { identity: SENDER, fileTransfer: true },
            { identity: RECEIVER, fileTransfer: true },
        ]);
        expect(directLog.map((d) => d.side)).toEqual(["sender", "receiver"]);
        expect(directLog.every((d) => !d.relayOnly)).toBe(true);
        // No room anywhere: not even the receiver's.
        expect(joinedBy(SENDER)).toEqual([]);
    });

    it("sends nothing when the sender won't connect directly", async () => {
        sfuless.add(SENDER);
        declines.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        expect(sink.finished).toBe(0);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "refused",
        });
        // The request was taken on, so it ends with a cancel, not a refuse.
        expect(sentBy(SENDER, FILE_CANCEL_TYPE)?.content.reason).toBe(
            "declined",
        );
        expect(sentBy(SENDER, FILE_REFUSE_TYPE)).toBeUndefined();
        expect(directLog).toEqual([]);
    });

    it("sends nothing when the receiver won't connect directly", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        // Only the sender agrees.
        declines.add(RECEIVER);
        await acceptIn(bob, alice);
        expect(sink.finished).toBe(0);
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "cancelled",
        });
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "cancelled",
            ),
        );
    });

    it("discards the file when the final hash doesn't match", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        // The sender's root is wrong, so the leaves can't rebuild it.
        hashGate.corruptRoot = true;
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        expect(sink.finished).toBe(0);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "hash-mismatch",
        });
        expect(sentBy(RECEIVER, FILE_CANCEL_TYPE)?.content.reason).toBe(
            "hash-mismatch",
        );
    });

    it("refuses someone who has left the room", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        memberships["@bob:x"] = "leave";
        await acceptIn(bob, alice);
        expect(sent.some((m) => m.type === FILE_REFUSE_TYPE)).toBe(true);
        expect(joinedBy(SENDER)).toEqual([]);
        expect(sink.aborted).toBe(1);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("does nothing when the save dialog is dismissed", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        sink.backedOut = true;
        await acceptIn(bob, alice);
        expect(sent).toEqual([]);
        expect(bob.store.fileTransfersState.views).toEqual([]);
    });

    it("refuses a request for an offer it never made", async () => {
        await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await bob.transfer.acceptOffer("!r:x", "$made-up", "@alice:x", {
            transferId: "made-up",
            name: "x",
            size: 1,
            mimetype: "text/plain",
            senderDevice: "A",
            expiresTs: Date.now() + 1000,
            relayOnly: false,
        });
        expect(joinedBy(SENDER)).toEqual([]);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("refuses a request that names another event for the same transfer", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        await bob.transfer.acceptOffer(
            "!r:x",
            "$other",
            "@alice:x",
            offerIn(alice),
        );
        expect(sentBy(SENDER, FILE_REFUSE_TYPE)?.content).toMatchObject({
            reason: "unknown-offer",
            event_id: "$other",
        });
        expect(joinedBy(SENDER)).toEqual([]);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });

    it("gives up when the sender's device doesn't answer", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        const offer = { ...offerIn(alice), senderDevice: "OTHER" };
        dropTo = (type) => type.endsWith(".request");
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "$offer",
            "@alice:x",
            offer,
        );
        await vi.advanceTimersByTimeAsync(31_000);
        await accepting;
        vi.useRealTimers();
        expect(bob.store.fileTransfersState.views[0].failure).toBe("offline");
        expect(joinedBy(SENDER)).toEqual([]);
    });

    it("keeps the receiver waiting while the sender hashes the file", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        let release!: () => void;
        hashGate.wait = new Promise<void>((resolve) => (release = resolve));
        await alice.transfer.offerFile("!r:x", fileOf(10));
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = acceptIn(bob, alice);
        // The preparing has to arrive before the first 30 seconds run out.
        await untilReal(() => !!sentBy(SENDER, FILE_PREPARING_TYPE));
        // Past the 30 seconds an answer is normally given.
        await vi.advanceTimersByTimeAsync(31_000);
        expect(sentBy(SENDER, FILE_PREPARING_TYPE)).toBeDefined();
        expect(sentBy(SENDER, FILE_PREPARING_TYPE)?.content).toMatchObject({
            event_id: "$offer",
        });
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "preparing",
            failure: null,
        });
        hashGate.wait = null;
        release();
        await settleWithTimers(accepting);
        vi.useRealTimers();
        expect(sink.finished).toBe(1);
        expect(bob.store.fileTransfersState.views[0].phase).toBe("done");
    });

    it("sends the root with done, once the file has its name", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        const accept = sentBy(SENDER, FILE_ACCEPT_TYPE)!;
        const done = sentBy(RECEIVER, FILE_DONE_TYPE)!;
        expect(done.content).toMatchObject({ event_id: "$offer" });
        expect(done.content.root).toBe(accept.content.root);
        expect(done.finished).toBe(1);
    });

    it("cancels when the sender answers without relaying a relay-only request", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        tamper = (type, content) =>
            type === FILE_ACCEPT_TYPE
                ? { ...content, relay_only: false }
                : content;
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await bob.transfer.acceptOffer("!r:x", "$offer", "@alice:x", {
            ...offerIn(alice),
            relayOnly: true,
        });
        expect(sentBy(RECEIVER, FILE_CANCEL_TYPE)?.content.reason).toBe(
            "failed",
        );
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "connection",
        });
        expect(sink.finished).toBe(0);
        await until(() =>
            alice.store.fileTransfersState.views.some(
                (v) => v.phase === "cancelled",
            ),
        );
    });

    it("answers a direct request, and holds candidates until the accept", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        const accept = sentBy(SENDER, FILE_ACCEPT_TYPE)!;
        expect(accept.content.sdp).toEqual(expect.stringMatching(/^v=0/));
        expect(accept.content.alias).toBeUndefined();
        const answer = sentBy(RECEIVER, FILE_ANSWER_TYPE)!;
        expect(answer.content.sdp).toEqual(expect.stringMatching(/^v=0/));
        const fromAlice = sent.filter(
            (m) => m.from === SENDER && m.type === FILE_CANDIDATES_TYPE,
        );
        expect(fromAlice.length).toBeGreaterThan(0);
        for (const candidates of fromAlice)
            expect(sent.indexOf(candidates)).toBeGreaterThan(
                sent.indexOf(accept),
            );
        // Each end took the other's candidates.
        expect(
            directCandidates.some(
                (c) =>
                    c.at === SENDER &&
                    JSON.stringify(c.value).includes("receiver-"),
            ),
        ).toBe(true);
        expect(
            directCandidates.some(
                (c) =>
                    c.at === RECEIVER &&
                    JSON.stringify(c.value).includes("sender-"),
            ),
        ).toBe(true);
        expect(sink.finished).toBe(1);
    });

    it("tells our other cross-signed devices which one accepted", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        const bobOther = await session("@bob:x", "B2");
        crossSigned.add("B2");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        await acceptIn(bob, alice);
        await until(() => bobOther.store.acceptedOnDevice("$offer") === "B");
        const accepted = sentBy(RECEIVER, FILE_ACCEPTED_TYPE);
        expect(accepted?.to).toBe("@bob:x|B2");
        expect(accepted?.content).toMatchObject({
            event_id: "$offer",
            device_id: "B",
        });
        expect(bob.store.acceptedOnDevice("$offer")).toBeNull();
    });

    it("trusts an unencrypted offer and one from its named device only", async () => {
        const alice = await session("@alice:x", "A");
        const plain = {
            isEncrypted: () => false,
            getRoomId: () => "!r:x",
        } as unknown as MatrixEvent;
        expect(await alice.transfer.offerFromSenderDevice(plain)).toBe(true);
        const encrypted = (device: string) =>
            ({
                isEncrypted: () => true,
                getSender: () => "@alice:x",
                getSenderKey: () => "key-A",
                getContent: () => ({ sender_device: device }),
            }) as unknown as MatrixEvent;
        expect(await alice.transfer.offerFromSenderDevice(encrypted("A"))).toBe(
            true,
        );
        expect(await alice.transfer.offerFromSenderDevice(encrypted("Z"))).toBe(
            false,
        );
    });

    it("ignores an offer of another version", () => {
        expect(
            parseFileOffer({
                version: 1,
                transfer_id: "t",
                name: "x.txt",
                size: 1,
                mimetype: "text/plain",
                sender_device: "A",
                expires_ts: Date.now() + 1000,
            }),
        ).toBeNull();
    });

    it("stops both ends when the sender withdraws", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(40 * 1024 * 1024));
        const accepting = acceptIn(bob, alice);
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
        const accepting = acceptIn(bob, alice);
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
        await acceptIn(bob, alice);
        expect(joinedBy(SENDER)).toEqual([]);
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
        const accepting = acceptIn(bob, alice);
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

    it("gives the receiver's done two minutes from the end of the run, not its start", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        // Acknowledgements take 50 s each way, so the run outlasts two minutes.
        directLink.delayMs = 50_000;
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await alice.transfer.offerFile("!r:x", fileOf(4 * 1024 * 1024 + 5));
        const accepting = acceptIn(bob, alice);
        await advanceUntil(() =>
            ["done", "failed"].includes(phaseOf(alice, "send") ?? ""),
        );
        await accepting;
        vi.useRealTimers();
        directLink.delayMs = 0;
        expect(phaseOf(alice, "send")).toBe("done");
        expect(sink.finished).toBe(1);
    }, 60_000);

    it("resends direct blocks only after a long silence", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        directLink.delayMs = 50_000;
        vi.useFakeTimers({ shouldAdvanceTime: true });
        await alice.transfer.offerFile("!r:x", fileOf(4 * 1024 * 1024 + 5));
        const accepting = acceptIn(bob, alice);
        await advanceUntil(() =>
            ["done", "failed"].includes(phaseOf(alice, "send") ?? ""),
        );
        await accepting;
        vi.useRealTimers();
        directLink.delayMs = 0;
        expect(sink.finished).toBe(1);
        // Data packets are type 1; a packet is named by its block and part.
        const data = directPackets.filter(
            (p) => p.from === SENDER && p.packet[0] === 1,
        );
        const unique = new Set(
            data.map((p) => Array.from(p.packet.slice(1, 7)).join(",")),
        );
        expect(unique.size).toBeGreaterThan(0);
        // With the default three-second resend, the same blocks went out many
        // times over; here only a few are resent at all.
        expect(data.length).toBeLessThan(2 * unique.size);
    }, 60_000);

    it("doesn't end the transfer when the receiver's direct link closes after the data has landed", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        // The receiver closes its link when it sends done, which arrives later.
        deliveryDelay = (type) => (type === FILE_DONE_TYPE ? 1_000 : 0);
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const accepting = acceptIn(bob, alice);
        await advanceUntil(() =>
            ["done", "failed"].includes(phaseOf(alice, "send") ?? ""),
        );
        await accepting;
        vi.useRealTimers();
        deliveryDelay = null;
        expect(sentBy(RECEIVER, FILE_DONE_TYPE)).toBeDefined();
        expect(phaseOf(alice, "send")).toBe("done");
    });

    it("serves one request from a device at a time", async () => {
        const alice = await session("@alice:x", "A");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        const transferId = offerIn(alice).transferId;
        // Two requests from the same device, before the first is checked.
        requestToAlice(transferId);
        requestToAlice(transferId);
        await until(() => !!sentBy(SENDER, FILE_ACCEPT_TYPE));
        await alice.transfer.withdrawOffer(transferId);
        expect(
            sent.filter(
                (m) => m.from === SENDER && m.type === FILE_ACCEPT_TYPE,
            ),
        ).toHaveLength(1);
    });

    it("doesn't serve a request whose offer is withdrawn while it waits", async () => {
        const alice = await session("@alice:x", "A");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        const transferId = offerIn(alice).transferId;
        requestToAlice(transferId);
        await alice.transfer.withdrawOffer(transferId);
        await until(() => !!sentBy(SENDER, FILE_REFUSE_TYPE));
        expect(sentBy(SENDER, FILE_REFUSE_TYPE)?.content.reason).toBe(
            "expired",
        );
        expect(sentBy(SENDER, FILE_ACCEPT_TYPE)).toBeUndefined();
        expect(sink.finished).toBe(0);
    });

    it("sends one request for a double accept", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        const offer = offerIn(alice);
        await Promise.all([
            bob.transfer.acceptOffer("!r:x", "$offer", "@alice:x", offer),
            bob.transfer.acceptOffer("!r:x", "$offer", "@alice:x", offer),
        ]);
        expect(
            sent.filter(
                (m) => m.from === RECEIVER && m.type === FILE_REQUEST_TYPE,
            ),
        ).toHaveLength(1);
        expect(sink.finished).toBe(1);
    });

    it("refuses an unencrypted offer in an encrypted room", async () => {
        const alice = await session("@alice:x", "A");
        encryptedRooms.add("!enc:x");
        const plain = (roomId: string) =>
            ({
                isEncrypted: () => false,
                getRoomId: () => roomId,
            }) as unknown as MatrixEvent;
        expect(
            await alice.transfer.offerFromSenderDevice(plain("!enc:x")),
        ).toBe(false);
        expect(await alice.transfer.offerFromSenderDevice(plain("!r:x"))).toBe(
            true,
        );
    });

    it("uses the direct link when the accept names an SFU the sender's homeserver doesn't advertise", async () => {
        sfuless.add(SENDER);
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        // Named by user id, as the homeserver's advertisement is.
        rogueSfu.add("@alice:x");
        // The accept also names a room, on a server nobody advertises.
        tamper = (type, content) =>
            type === FILE_ACCEPT_TYPE
                ? {
                      ...content,
                      alias: "zam-transfer-rogue",
                      service_url: "https://evil.example",
                  }
                : content;
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        await acceptIn(bob, alice);
        expect(sink.finished).toBe(1);
        expect(directLog.map((d) => d.side)).toEqual(["sender", "receiver"]);
    });

    it("ends a relayed request that the sender cancels as failed with no-relay", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        const transferId = offerIn(alice).transferId;
        // The request goes nowhere, so the sender's cancel is what answers it.
        dropTo = (type) => type === FILE_REQUEST_TYPE;
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "$offer",
            "@alice:x",
            { ...offerIn(alice), relayOnly: true },
        );
        await until(() => !!sentBy(RECEIVER, FILE_REQUEST_TYPE));
        cancelToBob(transferId, "failed");
        await accepting;
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "no-relay",
        });
        expect(sentBy(RECEIVER, FILE_CANCEL_TYPE)).toBeUndefined();
        expect(sink.aborted).toBe(1);
    });

    it("shows a sender's failed cancel as a connection failure without relay", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(1000));
        const transferId = offerIn(alice).transferId;
        dropTo = (type) => type === FILE_REQUEST_TYPE;
        const accepting = bob.transfer.acceptOffer(
            "!r:x",
            "$offer",
            "@alice:x",
            offerIn(alice),
        );
        await until(() => !!sentBy(RECEIVER, FILE_REQUEST_TYPE));
        cancelToBob(transferId, "failed");
        await accepting;
        expect(bob.store.fileTransfersState.views[0]).toMatchObject({
            phase: "failed",
            failure: "connection",
        });
    });

    it("refuses a request for a room other than the offer's", async () => {
        const alice = await session("@alice:x", "A");
        const bob = await session("@bob:x", "B");
        await alice.transfer.offerFile("!r:x", fileOf(10));
        await bob.transfer.acceptOffer(
            "!other:x",
            "$offer",
            "@alice:x",
            offerIn(alice),
        );
        expect(sentBy(SENDER, FILE_REFUSE_TYPE)?.content).toMatchObject({
            reason: "unknown-offer",
            event_id: "$offer",
        });
        expect(joinedBy(SENDER)).toEqual([]);
        expect(bob.store.fileTransfersState.views[0].failure).toBe("refused");
    });
});
