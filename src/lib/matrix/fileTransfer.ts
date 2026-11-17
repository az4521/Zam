// Direct file transfer: what goes through Matrix, and the link between devices.
//
//   1. The sender posts a `file_offer` room event. Other clients ignore the type,
//      and the sender starts hashing the file in the background.
//   2. A receiver who accepts sends the sender's device a request over Olm,
//      naming its own LiveKit room if it has one.
//   3. The sender, once hashing is done, accepts over Olm: a new key for this
//      request, the hash key and root, and the transport. Either a LiveKit
//      room pair (the sender's room and the receiver's, each on its owner's
//      SFU), or a WebRTC data channel whose SDP travels in the accept.
//   4. Sealed blocks cross that link (fileTransferEngine.ts). The receiver
//      checks each one against the hash tree before it is written.
//   5. The receiver says `done` over Olm, with the root it checked, once the
//      file has its final name.
//
// Like a call's media, each end publishes only on its own homeserver's SFU and
// listens on the other's: an SFU need not let another server's users publish
// (MSC4576). Neither side sees the other's address when the transfer goes
// through an SFU. A direct data channel shows each device's address to the
// other, so each is asked first, unless relaying through TURN is wanted.
//
// Every to-device message names the transfer and the offer's event id. A
// message about another offer, or from another device, is ignored.

import {
    ClientEvent,
    RoomEvent,
    type MatrixClient,
    type MatrixEvent,
} from "matrix-js-sdk";
import { isUserBlocked } from "$lib/stores/ignoredUsers.svelte";
import { holdPageAlive } from "$lib/stores/pageKeepAlive";
import { settingsState } from "$lib/stores/settings.svelte";
import {
    markAcceptedOn,
    markOffered,
    putTransfer,
    resetFileTransfers,
    unmarkOffered,
    updateTransfer,
    type TransferFailure,
    type TransferPhase,
} from "$lib/stores/fileTransfers.svelte";
import {
    FILE_ACCEPT_TYPE,
    FILE_ACCEPTED_TYPE,
    FILE_ACK_TYPE,
    FILE_ANSWER_TYPE,
    FILE_CANCEL_TYPE,
    FILE_CANDIDATES_TYPE,
    FILE_DATA_TOPIC,
    FILE_DONE_TYPE,
    FILE_OFFER_EVENT,
    FILE_PREPARING_TYPE,
    FILE_REFUSE_TYPE,
    FILE_REQUEST_TYPE,
    OFFER_LIFETIME_MS,
    base64UrlToBytes,
    buildFileOffer,
    bytesToBase64Url,
    deriveMacKey,
    generateTransferKey,
    importHashKey,
    importTransferKey,
    parseAckContent,
    randomToken,
    transferIdentity,
    transferRoomAlias,
    type AckPacket,
    type FileOffer,
} from "$lib/utils/fileTransfer";
import { withRandomFileName } from "$lib/utils/randomFileName";
import {
    requestRefusal,
    type RefusalReason,
} from "$lib/utils/fileTransferRules";
import { macLink } from "$lib/utils/fileTransferMacLink";
import { hashFile, type FileHashes } from "$lib/utils/fileTransferHash";
import { isValidSdp } from "$lib/utils/fileTransferDirect";
import { deviceAllowed, type ReceivedToDevice } from "./keyBackfill";
import {
    BlockReceiver,
    BlockSender,
    DEFAULT_TIMING,
    TransferError,
    type TransferLink,
    type TransferTiming,
} from "./fileTransferEngine";
import {
    openReceiverDirect,
    openSenderDirect,
    type DirectLink,
} from "./fileTransferDirect";
import {
    SaveUnsupportedError,
    StorageFullError,
    cleanOldScratch,
    holdAppForTransfer,
    openSaveSink,
} from "./fileTransferSink";
import {
    callIceConfig,
    homeserverTurn,
    joinHiddenSfuRoom,
    ownSfuTarget,
    sfuAdvertisedBy,
} from "./livekitCall";
import { hasTurnRelay, meshConsentServers } from "./call/fullMesh/meshPolicy";
import { requestMeshConsent } from "$lib/stores/meshConsent.svelte";

/** How long a request waits for an accept, a refuse or a preparing. */
const ANSWER_TIMEOUT_MS = 30_000;
/** A preparing extends that wait to this long from its arrival. */
const PREPARING_TIMEOUT_MS = 60_000;
/** While the sender is busy, a preparing goes out this often. */
const PREPARING_INTERVAL_MS = 45_000;
/** How long the sender waits for the receiver's direct answer, which may wait
 *  for the receiver's user to answer a dialog. */
const DIRECT_ANSWER_TIMEOUT_MS = 120_000;
/** How long the sender waits for the receiver's verdict on the hash, counted
 *  from the end of the run. */
const VERDICT_TIMEOUT_MS = 120_000;
/** A direct data channel is reliable and ordered: a block that is only queued
 *  isn't lost, so it is resent only after a long silence. */
const DIRECT_TIMING: TransferTiming = {
    ...DEFAULT_TIMING,
    resendMs: 60_000,
    slowResendMs: 60_000,
};
/** One file, sent to this many devices at once. */
const MAX_RECEIVERS = 3;
const REJOIN_ATTEMPTS = 10;
const REJOIN_DELAY_MS = 3_000;
const PROGRESS_INTERVAL_MS = 250;
/** Candidate batches kept for a session whose listener isn't ready yet. */
const MAX_PENDING_CANDIDATES = 64;

interface Outgoing {
    file: File;
    offer: FileOffer;
    roomId: string;
    eventId: string;
    /** Aborted when the offer is withdrawn, which also stops the hash. */
    abort: AbortController;
    /** The file's hash, started once the offer is posted. */
    hashing: Promise<FileHashes> | null;
    hashes: FileHashes | null;
}

/** One sender and receiver pair, from either end. */
interface Session {
    viewId: string;
    transferId: string;
    /** The event id of the offer this transfer is for. */
    eventId: string;
    peer: { userId: string; deviceId: string };
    abort: AbortController;
    /** Messages from the peer, until something asks for them. */
    inbox: Map<string, Record<string, unknown>>;
    waiters: Map<string, (content: Record<string, unknown>) => void>;
    /** The receiver's acknowledgements, however they arrived. */
    onAck: ((ack: AckPacket) => void) | null;
    /** Accept, refuse and preparing, while the request is open. */
    onMessage:
        ((type: string, content: Record<string, unknown>) => void) | null;
    /** Candidates of a direct data channel, once something can take them. */
    onCandidates: ((value: unknown) => void) | null;
    pendingCandidates: unknown[];
    /** The bulk of the transfer is over (the sender's run has settled, or the
     *  receiver's has resolved). From here a lost link no longer aborts it:
     *  only the peer's done is still awaited. */
    runOver: boolean;
    /** The reason the peer's cancel carried, once it has sent one. */
    peerCancel: string | null;
}

interface SfuRoomTarget {
    serviceUrl: string;
    alias: string;
}

interface TransferRooms extends TransferLink {
    /** The room we publish in, on our own SFU. */
    joinOwn(target: SfuRoomTarget): Promise<void>;
    /** The peer's room, to hear what it publishes there. */
    joinPeer(target: SfuRoomTarget): Promise<void>;
    close(): void;
}

type SenderDirect = Awaited<ReturnType<typeof openSenderDirect>>;
type ReceiverDirect = Awaited<ReturnType<typeof openReceiverDirect>>;

class TransferFailed extends Error {
    constructor(readonly failure: TransferFailure) {
        super(failure);
        this.name = "TransferFailed";
    }
}

class TransferCancelled extends Error {}

let client: MatrixClient | null = null;
/** Whose offers `outgoing` holds. */
let offeredBy: string | null = null;
const outgoing = new Map<string, Outgoing>();
const sessions = new Map<string, Session>();
/** Requests being checked, before their session is registered. Claimed
 *  synchronously, so a second request from the same device waits here. */
const requesting = new Set<string>();
/** Accepts being set up, before their session is registered. */
const accepting = new Set<string>();

function sessionKey(transferId: string, userId: string, deviceId: string) {
    return `${transferId}|${userId}|${deviceId}`;
}

function liveCrypto() {
    const crypto = client?.getCrypto();
    if (!client || !crypto) throw new TransferFailed("connection");
    return { client, crypto };
}

async function sendToDevice(
    type: string,
    device: { userId: string; deviceId: string },
    content: Record<string, unknown>,
): Promise<void> {
    const { client, crypto } = liveCrypto();
    const batch = await crypto.encryptToDeviceMessages(type, [device], content);
    // No Olm session means the message would go nowhere, silently.
    if (batch.batch.length === 0) throw new TransferFailed("connection");
    await client.queueToDevice(batch);
}

/** A to-device message about the session's transfer and offer. */
function sendTo(
    session: Session,
    type: string,
    content: Record<string, unknown> = {},
): Promise<void> {
    return sendToDevice(type, session.peer, {
        transfer_id: session.transferId,
        event_id: session.eventId,
        ...content,
    });
}

/**
 * The next message of `type` from the peer. Without a timeout it waits as long
 * as it takes, and whoever races it sets the deadline.
 */
function expectMessage(
    session: Session,
    type: string,
    timeoutMs?: number,
): Promise<Record<string, unknown>> {
    const early = session.inbox.get(type);
    if (early) return Promise.resolve(early);
    return new Promise((resolve, reject) => {
        const timer =
            timeoutMs === undefined
                ? null
                : setTimeout(() => {
                      session.waiters.delete(type);
                      reject(new TransferFailed("offline"));
                  }, timeoutMs);
        session.waiters.set(type, (content) => {
            if (timer) clearTimeout(timer);
            resolve(content);
        });
    });
}

/** Rejects with "offline" if `work` hasn't settled within `ms`. */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new TransferFailed("offline")),
            ms,
        );
        work.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

/**
 * A link that fails while the bytes are still moving ends the transfer. Once
 * they have all moved, only the peer's done is left, so a lost link doesn't.
 */
function linkLost(session: Session): void {
    if (!session.runOver) session.abort.abort(new TransferFailed("connection"));
}

/** Rejects as soon as the session is cancelled. */
function whenAborted(session: Session): Promise<never> {
    return new Promise((_, reject) => {
        const signal = session.abort.signal;
        const fail = () =>
            reject(
                signal.reason instanceof TransferFailed
                    ? signal.reason
                    : new TransferCancelled(),
            );
        if (signal.aborted) fail();
        else signal.addEventListener("abort", fail, { once: true });
    });
}

function untilAborted<T>(session: Session, work: Promise<T>): Promise<T> {
    return Promise.race([work, whenAborted(session)]);
}

/**
 * Runs `work` while the other end is kept waiting: a preparing goes out now,
 * and again every 45 seconds until `work` settles.
 */
async function whilePreparing<T>(
    session: Session,
    work: Promise<T>,
): Promise<T> {
    const prepare = () => sendTo(session, FILE_PREPARING_TYPE).catch(() => {});
    void prepare();
    const timer = setInterval(() => void prepare(), PREPARING_INTERVAL_MS);
    try {
        return await untilAborted(session, work);
    } finally {
        clearInterval(timer);
    }
}

/**
 * Holds what it is given until `open()`. A candidate the other end gets before
 * its accept or answer can't be used yet, so it waits for that message.
 */
function holdUntilSent<T>(send: (value: T) => void) {
    let open = false;
    const held: T[] = [];
    return {
        send: (value: T) => {
            if (open) send(value);
            else held.push(value);
        },
        open: () => {
            open = true;
            for (const value of held.splice(0)) send(value);
        },
    };
}

/** Hands candidates to `handle`, including any that came before it was set. */
function listenForCandidates(
    session: Session,
    handle: (value: unknown) => void,
): void {
    session.onCandidates = handle;
    for (const value of session.pendingCandidates.splice(0)) handle(value);
}

/**
 * The receiver's answer to a request: an accept, a refuse, or (meanwhile) a
 * preparing, which pushes the deadline back. Set before the request is sent,
 * so nothing that arrives can get in ahead of it.
 */
function awaitVerdict(session: Session): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const finish = () => {
            session.onMessage = null;
            if (timer) clearTimeout(timer);
            timer = null;
        };
        const arm = (ms: number) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                finish();
                reject(new TransferFailed("offline"));
            }, ms);
        };
        session.onMessage = (type, content) => {
            if (type === FILE_PREPARING_TYPE) {
                arm(PREPARING_TIMEOUT_MS);
                updateTransfer(session.viewId, { phase: "preparing" });
            } else if (type === FILE_ACCEPT_TYPE) {
                finish();
                resolve(content);
            } else if (type === FILE_REFUSE_TYPE) {
                finish();
                reject(new TransferFailed("refused"));
            }
        };
        session.abort.signal.addEventListener("abort", finish, { once: true });
        arm(ANSWER_TIMEOUT_MS);
    });
}

function trackProgress(viewId: string) {
    let lastAt = Date.now();
    let lastBytes = 0;
    let rate = 0;
    return (bytes: number) => {
        const now = Date.now();
        const elapsed = now - lastAt;
        if (elapsed < PROGRESS_INTERVAL_MS) return;
        rate = rate * 0.6 + ((bytes - lastBytes) / elapsed) * 1000 * 0.4;
        lastAt = now;
        lastBytes = bytes;
        updateTransfer(viewId, { bytes, rate });
    };
}

function failureOf(err: unknown): TransferFailure {
    if (err instanceof TransferFailed) return err.failure;
    if (err instanceof TransferError)
        return err.reason === "corrupt" ? "hash-mismatch" : err.reason;
    return "connection";
}

/** The reason a cancel carries to the other end. */
function cancelReason(err: unknown): string {
    const failure = failureOf(err);
    return failure === "hash-mismatch" || failure === "storage-full"
        ? failure
        : "failed";
}

/**
 * How the receiver shows a cancel that the sender sent: null for a plain
 * cancel, otherwise the failure. Unknown reasons count as "failed".
 */
function peerCancelFailure(
    reason: string,
    relayOnly: boolean,
): TransferFailure | null {
    switch (reason) {
        case "canceled":
            return null;
        case "declined":
        case "unknown-offer":
        case "expired":
        case "blocked":
        case "not-joined":
        case "device-not-allowed":
        case "busy":
            return "refused";
        case "hash-mismatch":
            return "hash-mismatch";
        case "storage-full":
            return "storage-full";
        default:
            return relayOnly ? "no-relay" : "connection";
    }
}

/** A 256-bit value as unpadded base64url, or null. */
function keyBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
        return null;
    return base64UrlToBytes(value);
}

function openLink(peerIdentity: string, session: Session): TransferRooms {
    type LkRoom = Awaited<ReturnType<typeof joinHiddenSfuRoom>>["room"];
    let handler: (packet: Uint8Array) => void = () => {};
    let closed = false;
    let ownJoined = false;
    const current: Record<"own" | "peer", LkRoom | null> = {
        own: null,
        peer: null,
    };

    async function join(
        target: SfuRoomTarget,
        slot: "own" | "peer",
    ): Promise<void> {
        const { room, lk } = await joinHiddenSfuRoom(target);
        // Heard in either room: an older receiver publishes in the sender's.
        room.on(
            lk.RoomEvent.DataReceived,
            (payload, participant, _kind, topic) => {
                if (
                    topic === FILE_DATA_TOPIC &&
                    participant?.identity === peerIdentity
                )
                    handler(payload);
            },
        );
        room.on(lk.RoomEvent.Disconnected, () => {
            if (current[slot] !== room) return;
            current[slot] = null;
            if (!closed) void rejoin(target, slot);
        });
        if (closed) {
            void room.disconnect();
            return;
        }
        current[slot] = room;
    }

    // LiveKit gets through short drops itself. This is for a longer one, past
    // what it can resume. Both ends then carry on from what's on disk.
    async function rejoin(
        target: SfuRoomTarget,
        slot: "own" | "peer",
    ): Promise<void> {
        for (let attempt = 0; attempt < REJOIN_ATTEMPTS && !closed; attempt++) {
            await new Promise((r) => setTimeout(r, REJOIN_DELAY_MS));
            if (closed) return;
            try {
                await join(target, slot);
                return;
            } catch (err) {
                console.warn("[file-transfer] rejoin failed", err);
            }
        }
        linkLost(session);
    }

    return {
        joinOwn: async (target) => {
            await join(target, "own");
            ownJoined = true;
        },
        joinPeer: (target) => join(target, "peer"),
        send: async (packet) => {
            // Without a room of our own we publish nowhere: the sender's room may
            // not let us publish in it, and the acknowledgements go as to-device
            // messages instead. Resolving without sending keeps the engine going.
            if (!ownJoined) return;
            const room = current.own;
            if (!room) throw new Error("link down");
            await room.localParticipant.publishData(packet, {
                reliable: true,
                topic: FILE_DATA_TOPIC,
                destinationIdentities: [peerIdentity],
            });
        },
        onPacket: (h) => (handler = h),
        close: () => {
            closed = true;
            for (const slot of ["own", "peer"] as const) {
                const room = current[slot];
                current[slot] = null;
                void room?.disconnect();
            }
        },
    };
}

/** The room a to-device message names, if it names one at all. */
function namedRoom(content: Record<string, unknown>): SfuRoomTarget | null {
    const { service_url: serviceUrl, alias } = content;
    if (
        typeof serviceUrl !== "string" ||
        typeof alias !== "string" ||
        !serviceUrl.startsWith("https://")
    )
        return null;
    return { serviceUrl, alias };
}

/**
 * The peer's room, if it's on an SFU their homeserver advertises. Joining
 * hands that server our OpenID token and our address, so a peer can't send
 * us to any server they like.
 */
async function trustedPeerRoom(
    peerUserId: string,
    content: Record<string, unknown>,
): Promise<SfuRoomTarget | null> {
    const room = namedRoom(content);
    if (!room) return null;
    if (await sfuAdvertisedBy(peerUserId, room.serviceUrl)) return room;
    console.warn(
        `[file-transfer] ${peerUserId} named an SFU their homeserver doesn't advertise`,
    );
    return null;
}

/**
 * Whether the user lets this device connect straight to the peer's, which
 * shows each its other's IP address unless it goes through a TURN relay. Throws "no-relay"
 * when relaying is asked for and the homeserver has no TURN server.
 */
async function allowDirectLink(): Promise<boolean> {
    const answer = await requestMeshConsent({
        joining: true,
        publishing: true,
        fileTransfer: true,
        ...meshConsentServers(await homeserverTurn()),
    });
    if (answer !== "allow") return false;
    if (!(await callIceConfig())) throw new TransferFailed("no-relay");
    return true;
}

/**
 * The ICE setup of a direct link. When relay-only is wanted, the homeserver's
 * TURN server must exist: nothing else keeps each device's address from the
 * other. The data channel itself is forced to relay in fileTransferDirect.
 */
async function directIceConfig(relayOnly: boolean): Promise<RTCConfiguration> {
    if (relayOnly && !hasTurnRelay(await homeserverTurn()))
        throw new TransferFailed("no-relay");
    const config = await callIceConfig();
    if (!config) throw new TransferFailed("no-relay");
    return config;
}

/** Keeps the page, and on Android the whole app, going. */
function holdWhileTransferring(): () => void {
    const releasePage = holdPageAlive();
    const releaseApp = holdAppForTransfer();
    return () => {
        releasePage();
        releaseApp();
    };
}

function startSession(
    viewId: string,
    transferId: string,
    peer: { userId: string; deviceId: string },
    eventId: string,
): Session {
    const session: Session = {
        viewId,
        transferId,
        eventId,
        peer,
        abort: new AbortController(),
        inbox: new Map(),
        waiters: new Map(),
        onAck: null,
        onMessage: null,
        onCandidates: null,
        pendingCandidates: [],
        runOver: false,
        peerCancel: null,
    };
    sessions.set(sessionKey(transferId, peer.userId, peer.deviceId), session);
    return session;
}

function endSession(
    session: Session,
    phase: TransferPhase,
    failure: TransferFailure | null,
): void {
    const { userId, deviceId } = session.peer;
    sessions.delete(sessionKey(session.transferId, userId, deviceId));
    updateTransfer(session.viewId, { phase, failure, rate: 0 });
}

async function serveRequest(
    offered: Outgoing,
    session: Session,
    requestContent: Record<string, unknown>,
): Promise<void> {
    const { peer, transferId } = session;
    const release = holdWhileTransferring();
    const relayOnly =
        offered.offer.relayOnly || requestContent.relay_only === true;
    const receiverRoom = trustedPeerRoom(peer.userId, requestContent).catch(
        () => null,
    );
    // The receiver can't use our candidates before it has our accept.
    const candidates = holdUntilSent((list: RTCIceCandidateInit[]) => {
        void sendTo(session, FILE_CANDIDATES_TYPE, { candidates: list }).catch(
            () => {},
        );
    });
    let rooms: TransferRooms | null = null;
    let direct: SenderDirect | null = null;
    let sender: BlockSender | null = null;
    try {
        // Hashed before the first accept, which the file's root is part of.
        const hashes =
            offered.hashes ?? (await whilePreparing(session, offered.hashing!));
        const rootText = bytesToBase64Url(hashes.root);
        const { key, raw } = await generateTransferKey();
        const accept: Record<string, unknown> = {
            key: bytesToBase64Url(raw),
            hash_key: bytesToBase64Url(hashes.hashKeyRaw),
            root: rootText,
            relay_only: relayOnly,
        };
        const alias = transferRoomAlias(randomToken());
        const target = await ownSfuTarget(alias);
        let engine: TransferLink;
        if (target) {
            rooms = openLink(
                transferIdentity(peer.userId, peer.deviceId),
                session,
            );
            await rooms.joinOwn(target);
            // Without it, acknowledgements still come over to-device messages.
            const peerRoom = await receiverRoom;
            if (peerRoom)
                await rooms
                    .joinPeer(peerRoom)
                    .catch((err) =>
                        console.warn("[file-transfer] receiver's room", err),
                    );
            accept.service_url = target.serviceUrl;
            accept.alias = alias;
            engine = macLink(rooms, await deriveMacKey(raw), 1);
        } else {
            // No SFU of ours: connect to the receiver's device instead. A relayed
            // one that no TURN server can carry isn't worth asking the user about.
            if (relayOnly && !hasTurnRelay(await homeserverTurn()))
                throw new TransferFailed("no-relay");
            // The request was taken on, so it ends with a cancel, not a refuse.
            if (!(await whilePreparing(session, allowDirectLink()))) {
                await sendTo(session, FILE_CANCEL_TYPE, { reason: "declined" });
                throw new TransferCancelled();
            }
            const opened = await openSenderDirect({
                rtcConfig: await directIceConfig(relayOnly),
                relayOnly,
                sendCandidates: candidates.send,
                onFailed: () => linkLost(session),
            });
            direct = opened;
            accept.sdp = opened.offerSdp;
            listenForCandidates(
                session,
                (value) => void opened.addCandidates(value),
            );
            engine = opened.link;
        }
        const progress = trackProgress(session.viewId);
        // Registered before the accept goes out: the answer may come straight back.
        const answer = direct
            ? expectMessage(session, FILE_ANSWER_TYPE, DIRECT_ANSWER_TIMEOUT_MS)
            : null;
        answer?.catch(() => {});
        sender = new BlockSender(
            offered.file,
            key,
            transferId,
            engine,
            progress,
            hashes.leaves,
            direct ? DIRECT_TIMING : DEFAULT_TIMING,
        );
        const running = sender;
        session.onAck = (ack) => running.handleSlowAck(ack);
        // The offer may have been withdrawn while the hash, the consent or the
        // connection were being set up. Nothing is accepted after that.
        if (
            outgoing.get(transferId) !== offered ||
            offered.abort.signal.aborted
        )
            throw new TransferCancelled();
        await sendTo(session, FILE_ACCEPT_TYPE, accept);
        candidates.open();
        if (answer && direct) {
            const reply = await untilAborted(session, answer);
            if (!isValidSdp(reply.sdp, "answer"))
                throw new TransferFailed("connection");
            await direct.acceptAnswer(reply.sdp);
        }
        // Only the receiver's done says the file is delivered. Its last
        // acknowledgement can be lost once it has closed its end, so the run
        // ending is not the signal to wait for on its own: the done may come
        // first. Either one ends the run. The done's own two minutes start
        // only then, so a long run doesn't use them up.
        const done = expectMessage(session, FILE_DONE_TYPE);
        await untilAborted(session, Promise.race([running.run(), done]));
        session.runOver = true;
        updateTransfer(session.viewId, {
            phase: "verifying",
            bytes: offered.file.size,
        });
        const finished = await untilAborted(
            session,
            within(done, VERDICT_TIMEOUT_MS),
        );
        if (finished.root !== rootText)
            throw new TransferFailed("hash-mismatch");
        endSession(session, "done", null);
    } catch (err) {
        if (err instanceof TransferCancelled) {
            endSession(session, "cancelled", null);
        } else {
            console.warn("[file-transfer] send failed", err);
            endSession(session, "failed", failureOf(err));
            void sendTo(session, FILE_CANCEL_TYPE, {
                reason: cancelReason(err),
            }).catch(() => {});
        }
    } finally {
        sender?.stop();
        rooms?.close();
        direct?.link.close();
        release();
    }
}

async function handleRequest(
    payload: ReceivedToDevice,
    transferId: string,
): Promise<void> {
    const { client, crypto } = liveCrypto();
    const requester = payload.encryptionInfo!.sender;
    const deviceId = payload.encryptionInfo!.senderDevice;
    if (!deviceId) return;
    const content = payload.message.content;
    const peer = { userId: requester, deviceId };
    const key = sessionKey(transferId, requester, deviceId);
    // Claimed before the first await: a second request from this device, which
    // arrives meanwhile, finds it and does nothing.
    if (sessions.has(key) || requesting.has(key)) return;
    requesting.add(key);
    try {
        const offered = outgoing.get(transferId);
        // The request names the offer's event and room as well: a transfer id
        // alone isn't enough.
        const known =
            !!offered &&
            offered.eventId !== "" &&
            content.event_id === offered.eventId &&
            content.room_id === offered.roomId;
        const room = offered ? client.getRoom(offered.roomId) : null;
        const status = await crypto.getDeviceVerificationStatus(
            requester,
            deviceId,
        );
        // Withdrawn while the device was being checked: it counts as expired.
        const withdrawn =
            !!offered &&
            (outgoing.get(transferId) !== offered ||
                offered.abort.signal.aborted);
        const refusal: RefusalReason | null = requestRefusal({
            known,
            expired:
                !!offered &&
                (offered.offer.expiresTs < Date.now() || withdrawn),
            requesterBlocked: isUserBlocked(requester),
            requesterJoined: room?.getMember(requester)?.membership === "join",
            deviceAllowed: deviceAllowed(
                crypto,
                client.getUserId() ?? "",
                status,
            ),
            receivers: [...sessions.keys()].filter((k) =>
                k.startsWith(`${transferId}|`),
            ).length,
            maxReceivers: MAX_RECEIVERS,
        });
        if (refusal) {
            console.info(`[file-transfer] refused ${transferId}: ${refusal}`);
            await sendToDevice(FILE_REFUSE_TYPE, peer, {
                transfer_id: transferId,
                event_id: content.event_id,
                reason: refusal,
            });
            return;
        }
        const viewId = key;
        putTransfer({
            id: viewId,
            transferId,
            direction: "send",
            peerUserId: requester,
            phase: "transferring",
            bytes: 0,
            total: offered!.file.size,
            rate: 0,
            failure: null,
        });
        void serveRequest(
            offered!,
            startSession(viewId, transferId, peer, offered!.eventId),
            content,
        );
    } finally {
        requesting.delete(key);
    }
}

/** An Olm-authenticated message from another of this user's devices. */
function recordAccepted(
    info: { sender: string; senderDevice?: string },
    content: Record<string, unknown>,
): void {
    if (!client || info.sender !== client.getUserId()) return;
    if (info.senderDevice === client.getDeviceId()) return;
    if (typeof content.event_id !== "string") return;
    if (typeof content.device_id !== "string") return;
    markAcceptedOn(content.event_id, content.device_id);
}

function onToDevice(payload: ReceivedToDevice): void {
    // Only Olm-encrypted messages: the plaintext ones carry no proof of who
    // sent them, and these name a key.
    const info = payload.encryptionInfo;
    if (!info?.senderDevice) return;
    const { type, content } = payload.message;
    const transferId = content.transfer_id;
    if (typeof transferId !== "string") return;
    if (type === FILE_ACCEPTED_TYPE) {
        recordAccepted(info, content);
        return;
    }
    if (type === FILE_REQUEST_TYPE) {
        handleRequest(payload, transferId).catch((err) =>
            console.warn("[file-transfer] request failed", err),
        );
        return;
    }
    // Who Olm says sent it decides the session, so nobody else can speak in it.
    const session = sessions.get(
        sessionKey(transferId, info.sender, info.senderDevice),
    );
    if (!session) return;
    // A message about another offer of the same transfer id is not ours.
    if (content.event_id !== session.eventId) return;
    if (type === FILE_CANCEL_TYPE) {
        // The reason decides how the other end shows it: see receiveFile.
        session.peerCancel =
            typeof content.reason === "string" ? content.reason : "failed";
        session.abort.abort();
    } else if (type === FILE_ACK_TYPE) {
        const ack = parseAckContent(content);
        if (ack) session.onAck?.(ack);
    } else if (type === FILE_CANDIDATES_TYPE) {
        if (session.onCandidates) session.onCandidates(content.candidates);
        else if (session.pendingCandidates.length < MAX_PENDING_CANDIDATES)
            session.pendingCandidates.push(content.candidates);
    } else if (
        type === FILE_ACCEPT_TYPE ||
        type === FILE_REFUSE_TYPE ||
        type === FILE_PREPARING_TYPE
    ) {
        session.onMessage?.(type, content);
    } else if (type === FILE_ANSWER_TYPE || type === FILE_DONE_TYPE) {
        const waiter = session.waiters.get(type);
        if (waiter) {
            session.waiters.delete(type);
            waiter(content);
        } else {
            session.inbox.set(type, content);
        }
    }
}

/** Serve and receive transfers on `newClient`. Returns the teardown. */
export function attachFileTransfer(newClient: MatrixClient): () => void {
    // Encryption restarts under an open offer whenever Android's background
    // release runs, and the offer is still good. Another account's isn't ours.
    if (newClient.getUserId() !== offeredBy) {
        for (const offered of outgoing.values()) offered.abort.abort();
        outgoing.clear();
        resetFileTransfers();
        offeredBy = newClient.getUserId();
    }
    client = newClient;
    cleanOldScratch().catch((err) =>
        console.warn("[file-transfer] couldn't clean up", err),
    );
    newClient.on(
        ClientEvent.ReceivedToDeviceMessage as never,
        onToDevice as never,
    );
    newClient.on(RoomEvent.Redaction as never, onRedaction as never);
    return () => {
        newClient.off(RoomEvent.Redaction as never, onRedaction as never);
        newClient.off(
            ClientEvent.ReceivedToDeviceMessage as never,
            onToDevice as never,
        );
        for (const session of sessions.values()) session.abort.abort();
        sessions.clear();
        if (client === newClient) client = null;
    };
}

/**
 * Hashes the file in the background, once its offer is posted. A failure
 * withdraws the offer: a receiver can't be served without the root.
 */
function startHashing(entry: Outgoing): void {
    const hashing = hashFile(entry.file, { signal: entry.abort.signal });
    entry.hashing = hashing;
    hashing.then(
        (hashes) => {
            entry.hashes = hashes;
        },
        (err) => {
            if (entry.abort.signal.aborted) return;
            console.warn("[file-transfer] couldn't hash the file", err);
            withdrawOffer(entry.offer.transferId).catch((e) =>
                console.warn("[file-transfer] couldn't withdraw", e),
            );
        },
    );
}

/** Post an offer for `file`, which stays open here until someone takes it. */
export async function offerFile(roomId: string, file: File): Promise<void> {
    const { client } = liveCrypto();
    const deviceId = client.getDeviceId();
    if (!deviceId) throw new TransferFailed("connection");
    const named = settingsState.randomizeFileNames
        ? withRandomFileName(file)
        : file;
    const offer: FileOffer = {
        transferId: randomToken(),
        name: named.name,
        size: file.size,
        mimetype: file.type || "application/octet-stream",
        senderDevice: deviceId,
        expiresTs: Date.now() + OFFER_LIFETIME_MS,
        relayOnly: settingsState.meshRelayOnly,
    };
    // Registered before the send: a fast Accept can beat the send's response.
    const entry: Outgoing = {
        file,
        offer,
        roomId,
        eventId: "",
        abort: new AbortController(),
        hashing: null,
        hashes: null,
    };
    outgoing.set(offer.transferId, entry);
    markOffered(offer.transferId);
    try {
        const { event_id } = await client.sendEvent(
            roomId,
            FILE_OFFER_EVENT as never,
            buildFileOffer(offer) as never,
        );
        entry.eventId = event_id;
    } catch (err) {
        entry.abort.abort();
        outgoing.delete(offer.transferId);
        unmarkOffered(offer.transferId);
        throw err;
    }
    // Withdrawn while the send was in flight: nothing to hash for.
    if (outgoing.get(offer.transferId) === entry) startHashing(entry);
}

/** Stop offering a file, and stop every send of it. */
function endOffer(transferId: string): void {
    outgoing.get(transferId)?.abort.abort();
    outgoing.delete(transferId);
    unmarkOffered(transferId);
    for (const [key, session] of sessions) {
        if (!key.startsWith(`${transferId}|`)) continue;
        session.abort.abort();
        void sendTo(session, FILE_CANCEL_TYPE, { reason: "canceled" }).catch(
            () => {},
        );
    }
}

/** Take back an offer: it goes from the room, and running sends stop. */
export async function withdrawOffer(transferId: string): Promise<void> {
    const offered = outgoing.get(transferId);
    endOffer(transferId);
    if (offered?.eventId)
        await client?.redactEvent(offered.roomId, offered.eventId);
}

// Deleting the offer counts as withdrawing it, whoever or wherever it was
// deleted from: a card nobody can see any more can't be cancelled.
function onRedaction(redaction: MatrixEvent): void {
    const target = redaction.getAssociatedId();
    for (const [transferId, offered] of outgoing)
        if (offered.eventId === target) endOffer(transferId);
}

/** Stop one transfer, from either end. */
export function cancelTransfer(viewId: string, transferId: string): void {
    for (const session of sessions.values()) {
        if (session.viewId !== viewId || session.transferId !== transferId)
            continue;
        session.abort.abort();
        void sendTo(session, FILE_CANCEL_TYPE, { reason: "canceled" }).catch(
            () => {},
        );
    }
}

/**
 * Whether an offer came from the device it names. An encrypted offer must be
 * sent by the device whose Megolm session encrypted it: the event's sender key
 * is that device's curve25519 key. An unencrypted offer has no such proof, so
 * it is taken at its word, unless its room is encrypted: then it is refused.
 */
export async function offerFromSenderDevice(
    event: MatrixEvent,
): Promise<boolean> {
    if (!event.isEncrypted()) {
        const room = client?.getRoom(event.getRoomId() ?? "");
        return !room?.hasEncryptionStateEvent();
    }
    const crypto = client?.getCrypto();
    if (!crypto) return false;
    const sender = event.getSender();
    const senderKey = event.getSenderKey();
    const claimed = event.getContent().sender_device;
    if (!sender || !senderKey || typeof claimed !== "string") return false;
    const device = (await crypto.getUserDeviceInfo([sender]))
        .get(sender)
        ?.get(claimed);
    return device?.getIdentityKey() === senderKey;
}

/**
 * Tells this user's other cross-signed devices that this one accepted. They
 * show it; they keep their own Accept. Best effort.
 */
async function announceAccepted(
    transferId: string,
    eventId: string,
): Promise<void> {
    const { client, crypto } = liveCrypto();
    const me = client.getUserId();
    const own = client.getDeviceId();
    if (!me || !own) return;
    const mine = (await crypto.getUserDeviceInfo([me])).get(me);
    if (!mine) return;
    const targets: { userId: string; deviceId: string }[] = [];
    for (const deviceId of mine.keys()) {
        if (deviceId === own) continue;
        const status = await crypto.getDeviceVerificationStatus(me, deviceId);
        if (status?.crossSigningVerified)
            targets.push({ userId: me, deviceId });
    }
    if (targets.length === 0) return;
    const batch = await crypto.encryptToDeviceMessages(
        FILE_ACCEPTED_TYPE,
        targets,
        { transfer_id: transferId, event_id: eventId, device_id: own },
    );
    if (batch.batch.length > 0) await client.queueToDevice(batch);
}

async function receiveFile(
    offer: FileOffer,
    roomId: string,
    session: Session,
    sink: NonNullable<Awaited<ReturnType<typeof openSaveSink>>>,
): Promise<void> {
    const { peer, transferId } = session;
    const relayOnly = offer.relayOnly || settingsState.meshRelayOnly;
    const release = holdWhileTransferring();
    // The sender can't use our candidates before it has our answer.
    const candidates = holdUntilSent((list: RTCIceCandidateInit[]) => {
        void sendTo(session, FILE_CANDIDATES_TYPE, { candidates: list }).catch(
            () => {},
        );
    });
    let rooms: TransferRooms | null = null;
    let direct: ReceiverDirect | null = null;
    let receiver: BlockReceiver | null = null;
    try {
        rooms = openLink(transferIdentity(peer.userId, peer.deviceId), session);
        // Joined before the sender hears of it: our SFU may only let us make
        // it. With no room of our own, we try publishing in the sender's.
        let ownRoom = await ownSfuTarget(
            transferRoomAlias(randomToken()),
        ).catch(() => null);
        if (ownRoom)
            await rooms.joinOwn(ownRoom).catch((err) => {
                console.warn("[file-transfer] couldn't open our room", err);
                ownRoom = null;
            });
        // Listening before the request goes out, so no reply can slip past.
        const verdict = awaitVerdict(session);
        verdict.catch(() => {});
        await sendTo(session, FILE_REQUEST_TYPE, {
            room_id: roomId,
            ...(relayOnly ? { relay_only: true } : {}),
            ...(ownRoom
                ? { service_url: ownRoom.serviceUrl, alias: ownRoom.alias }
                : {}),
        });
        const accept = await untilAborted(session, verdict);
        const key = keyBytes(accept.key);
        const hashKey = keyBytes(accept.hash_key);
        const root = keyBytes(accept.root);
        if (!key || !hashKey || !root) throw new TransferFailed("connection");
        // We asked for a relayed connection and the sender won't give one.
        if (relayOnly && accept.relay_only !== true)
            throw new TransferFailed("connection");
        const rootText = accept.root as string;
        updateTransfer(session.viewId, { phase: "connecting" });
        const transferKey = await importTransferKey(key);
        const hashKeyCrypto = await importHashKey(hashKey);
        let engine: TransferLink;
        // A room the sender names on an SFU its homeserver doesn't advertise is
        // ignored, and the direct link is used instead if the accept has one.
        const senderRoom =
            accept.alias !== undefined || accept.service_url !== undefined
                ? await untilAborted(
                      session,
                      trustedPeerRoom(peer.userId, accept),
                  )
                : null;
        if (senderRoom) {
            await rooms.joinPeer(senderRoom);
            engine = macLink(rooms, await deriveMacKey(key), 2);
        } else {
            // The sender has no SFU: our room is no use, and the two devices
            // connect to each other if the user lets them.
            if (!isValidSdp(accept.sdp, "offer"))
                throw new TransferFailed("connection");
            const offerSdp = accept.sdp;
            rooms.close();
            rooms = null;
            if (!(await untilAborted(session, allowDirectLink()))) {
                await sendTo(session, FILE_CANCEL_TYPE, {
                    reason: "declined",
                }).catch(() => {});
                throw new TransferCancelled();
            }
            const opened = await openReceiverDirect({
                rtcConfig: await directIceConfig(relayOnly),
                relayOnly,
                offerSdp,
                sendCandidates: candidates.send,
                onFailed: () => linkLost(session),
            });
            direct = opened;
            listenForCandidates(
                session,
                (value) => void opened.addCandidates(value),
            );
            await sendTo(session, FILE_ANSWER_TYPE, { sdp: opened.answerSdp });
            candidates.open();
            engine = opened.link;
        }
        void announceAccepted(transferId, session.eventId).catch((err) =>
            console.warn("[file-transfer] couldn't tell our devices", err),
        );
        updateTransfer(session.viewId, { phase: "transferring" });
        receiver = new BlockReceiver(
            offer.size,
            transferKey,
            transferId,
            engine,
            sink,
            trackProgress(session.viewId),
            (ack) =>
                void sendTo(session, FILE_ACK_TYPE, {
                    contiguous: ack.contiguous,
                    have: ack.have,
                }).catch(() => {}),
            hashKeyCrypto,
            root,
            direct ? DIRECT_TIMING : DEFAULT_TIMING,
        );
        await untilAborted(session, receiver.run());
        session.runOver = true;
        updateTransfer(session.viewId, {
            phase: "verifying",
            bytes: offer.size,
        });
        await sink.finish();
        // Only once the file has its name: the sender shows it delivered on this.
        await sendTo(session, FILE_DONE_TYPE, { root: rootText }).catch((err) =>
            console.warn("[file-transfer] couldn't send done", err),
        );
        endSession(session, "done", null);
    } catch (err) {
        await sink.abort();
        if (session.peerCancel !== null) {
            // The sender ended it, and its reason says how it shows here. Nothing
            // is sent back.
            const failure = peerCancelFailure(session.peerCancel, relayOnly);
            if (failure === null) endSession(session, "cancelled", null);
            else endSession(session, "failed", failure);
        } else if (err instanceof TransferCancelled) {
            endSession(session, "cancelled", null);
        } else {
            console.warn("[file-transfer] receive failed", err);
            // A refusal is the sender's answer already.
            if (!(err instanceof TransferFailed && err.failure === "refused"))
                void sendTo(session, FILE_CANCEL_TYPE, {
                    reason: cancelReason(err),
                }).catch(() => {});
            endSession(session, "failed", failureOf(err));
        }
    } finally {
        receiver?.stop();
        rooms?.close();
        direct?.link.close();
        release();
    }
}

/** Accept an offer. Run this from the click: it opens the save dialog. */
export async function acceptOffer(
    roomId: string,
    eventId: string,
    senderUserId: string,
    offer: FileOffer,
): Promise<void> {
    const peer = { userId: senderUserId, deviceId: offer.senderDevice };
    const viewId = sessionKey(offer.transferId, peer.userId, peer.deviceId);
    // A second Accept while the first is still at its save dialog, or running,
    // does nothing: the save dialog and the request happen once.
    if (sessions.has(viewId) || accepting.has(viewId)) return;
    accepting.add(viewId);
    try {
        const base = {
            id: viewId,
            transferId: offer.transferId,
            direction: "receive" as const,
            peerUserId: senderUserId,
            bytes: 0,
            total: offer.size,
            rate: 0,
        };
        let sink: Awaited<ReturnType<typeof openSaveSink>>;
        try {
            sink = await openSaveSink(offer.name, offer.mimetype, offer.size);
        } catch (err) {
            console.warn("[file-transfer] can't save here", err);
            putTransfer({
                ...base,
                phase: "failed",
                failure:
                    err instanceof SaveUnsupportedError
                        ? "unsupported"
                        : err instanceof StorageFullError
                          ? "storage-full"
                          : "write-failed",
            });
            return;
        }
        if (!sink) return;
        putTransfer({ ...base, phase: "connecting", failure: null });
        await receiveFile(
            offer,
            roomId,
            startSession(viewId, offer.transferId, peer, eventId),
            sink,
        );
    } finally {
        accepting.delete(viewId);
    }
}
