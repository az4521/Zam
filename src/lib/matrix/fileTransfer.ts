// Direct file transfer: what goes through Matrix, and the LiveKit room.
//
//   1. The sender posts a `file_offer` room event. Other clients ignore the type.
//   2. A receiver who accepts sends the sender's device a request over Olm.
//   3. The sender joins a new LiveKit room and replies, over Olm, with its name
//      and a new key. Nothing about this room reaches the Matrix room, so it
//      is a call only LiveKit knows about, with one sender and one receiver.
//   4. Sealed blocks cross it (fileTransferEngine.ts), the receiver saying what
//      it has on disk as it goes.
//   5. The sender gives the file's hash over Olm, and the receiver checks it
//      before the file takes its final name.
//
// Neither side sees the other's address: both only connect to the sender's SFU.

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
    FILE_ACK_TYPE,
    FILE_CANCEL_TYPE,
    FILE_DATA_TOPIC,
    FILE_DONE_TYPE,
    FILE_FINISH_TYPE,
    FILE_OFFER_EVENT,
    FILE_REFUSE_TYPE,
    FILE_REQUEST_TYPE,
    OFFER_LIFETIME_MS,
    base64UrlToBytes,
    buildFileOffer,
    bytesToBase64Url,
    generateTransferKey,
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
import { deviceAllowed, type ReceivedToDevice } from "./keyBackfill";
import {
    BlockReceiver,
    BlockSender,
    TransferError,
    type TransferLink,
} from "./fileTransferEngine";
import {
    SaveUnsupportedError,
    StorageFullError,
    cleanOldScratch,
    holdAppForTransfer,
    openSaveSink,
} from "./fileTransferSink";
import { joinHiddenSfuRoom, ownSfuTarget } from "./livekitCall";

/** How long an accepted offer waits for the sender's device to answer. */
const ANSWER_TIMEOUT_MS = 30_000;
/** How long the sender waits for the receiver's verdict on the hash. */
const VERDICT_TIMEOUT_MS = 120_000;
/** One file, sent to this many devices at once. */
const MAX_RECEIVERS = 3;
const REJOIN_ATTEMPTS = 10;
const REJOIN_DELAY_MS = 3_000;
const PROGRESS_INTERVAL_MS = 250;

interface Outgoing {
    file: File;
    offer: FileOffer;
    roomId: string;
    eventId: string;
}

/** One sender and receiver pair, from either end. */
interface Session {
    viewId: string;
    peer: { userId: string; deviceId: string };
    abort: AbortController;
    /** Messages from the peer, until something asks for them. */
    inbox: Map<string, Record<string, unknown>>;
    waiters: Map<string, (content: Record<string, unknown>) => void>;
    onAck: ((ack: AckPacket) => void) | null;
}

interface ClosableLink extends TransferLink {
    close(): void;
}

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

function expectMessage(
    session: Session,
    type: string,
    timeoutMs: number,
): Promise<Record<string, unknown>> {
    const early = session.inbox.get(type);
    if (early) return Promise.resolve(early);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            session.waiters.delete(type);
            reject(new TransferFailed("offline"));
        }, timeoutMs);
        session.waiters.set(type, (content) => {
            clearTimeout(timer);
            resolve(content);
        });
    });
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
    if (err instanceof TransferError) return err.reason;
    return "connection";
}

async function openLink(
    target: { serviceUrl: string; alias: string },
    peerIdentity: string,
    session: Session,
): Promise<ClosableLink> {
    let handler: (packet: Uint8Array) => void = () => {};
    let closed = false;
    let current: Awaited<ReturnType<typeof joinHiddenSfuRoom>>["room"] | null =
        null;

    async function join(): Promise<void> {
        const { room, lk } = await joinHiddenSfuRoom(target);
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
            if (current !== room) return;
            current = null;
            if (!closed) void rejoin();
        });
        if (closed) {
            void room.disconnect();
            return;
        }
        current = room;
    }

    // LiveKit gets through short drops itself. This is for a longer one, past
    // what it can resume. Both ends then carry on from what's on disk.
    async function rejoin(): Promise<void> {
        for (let attempt = 0; attempt < REJOIN_ATTEMPTS && !closed; attempt++) {
            await new Promise((r) => setTimeout(r, REJOIN_DELAY_MS));
            if (closed) return;
            try {
                await join();
                return;
            } catch (err) {
                console.warn("[file-transfer] rejoin failed", err);
            }
        }
        session.abort.abort(new TransferFailed("connection"));
    }

    await join();
    return {
        send: async (packet) => {
            if (!current) throw new Error("link down");
            await current.localParticipant.publishData(packet, {
                reliable: true,
                topic: FILE_DATA_TOPIC,
                destinationIdentities: [peerIdentity],
            });
        },
        onPacket: (h) => (handler = h),
        close: () => {
            closed = true;
            const room = current;
            current = null;
            void room?.disconnect();
        },
    };
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
): Session {
    const session: Session = {
        viewId,
        peer,
        abort: new AbortController(),
        inbox: new Map(),
        waiters: new Map(),
        onAck: null,
    };
    sessions.set(sessionKey(transferId, peer.userId, peer.deviceId), session);
    return session;
}

function endSession(
    session: Session,
    transferId: string,
    phase: TransferPhase,
    failure: TransferFailure | null,
): void {
    const { userId, deviceId } = session.peer;
    sessions.delete(sessionKey(transferId, userId, deviceId));
    updateTransfer(session.viewId, { phase, failure, rate: 0 });
}

async function serveRequest(
    transferId: string,
    offered: Outgoing,
    session: Session,
): Promise<void> {
    const { peer } = session;
    const release = holdWhileTransferring();
    let link: ClosableLink | null = null;
    let sender: BlockSender | null = null;
    try {
        const alias = transferRoomAlias(offered.roomId, randomToken());
        const target = await ownSfuTarget(alias);
        if (!target) throw new TransferFailed("no-sfu");
        const { key, raw } = await generateTransferKey();
        link = await openLink(
            target,
            transferIdentity(peer.userId, peer.deviceId),
            session,
        );
        const progress = trackProgress(session.viewId);
        sender = new BlockSender(offered.file, key, transferId, link, progress);
        const running = sender;
        session.onAck = (ack) => running.handleSlowAck(ack);
        await sendToDevice(FILE_ACCEPT_TYPE, peer, {
            transfer_id: transferId,
            key: bytesToBase64Url(raw),
            service_url: target.serviceUrl,
            alias,
        });
        const root = await untilAborted(session, running.run());
        updateTransfer(session.viewId, {
            phase: "verifying",
            bytes: offered.file.size,
        });
        await sendToDevice(FILE_FINISH_TYPE, peer, {
            transfer_id: transferId,
            root,
        });
        const verdict = await untilAborted(
            session,
            expectMessage(session, FILE_DONE_TYPE, VERDICT_TIMEOUT_MS),
        );
        if (verdict.ok !== true) throw new TransferFailed("hash-mismatch");
        endSession(session, transferId, "done", null);
    } catch (err) {
        if (err instanceof TransferCancelled) {
            endSession(session, transferId, "cancelled", null);
        } else {
            console.warn("[file-transfer] send failed", err);
            endSession(session, transferId, "failed", failureOf(err));
            void sendToDevice(FILE_CANCEL_TYPE, peer, {
                transfer_id: transferId,
            }).catch(() => {});
        }
    } finally {
        sender?.stop();
        link?.close();
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
    const peer = { userId: requester, deviceId };
    if (sessions.has(sessionKey(transferId, requester, deviceId))) return;
    const offered = outgoing.get(transferId);
    const room = offered ? client.getRoom(offered.roomId) : null;
    const status = await crypto.getDeviceVerificationStatus(
        requester,
        deviceId,
    );
    const refusal: RefusalReason | null = requestRefusal({
        known: !!offered,
        expired: !!offered && offered.offer.expiresTs < Date.now(),
        requesterBlocked: isUserBlocked(requester),
        requesterJoined: room?.getMember(requester)?.membership === "join",
        deviceAllowed: deviceAllowed(crypto, client.getUserId() ?? "", status),
        receivers: [...sessions.keys()].filter((k) =>
            k.startsWith(`${transferId}|`),
        ).length,
        maxReceivers: MAX_RECEIVERS,
    });
    if (refusal) {
        console.info(`[file-transfer] refused ${transferId}: ${refusal}`);
        await sendToDevice(FILE_REFUSE_TYPE, peer, {
            transfer_id: transferId,
            reason: refusal,
        });
        return;
    }
    const viewId = `${transferId}|${requester}|${deviceId}`;
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
        transferId,
        offered!,
        startSession(viewId, transferId, peer),
    );
}

function onToDevice(payload: ReceivedToDevice): void {
    // Only Olm-encrypted messages: the plaintext ones carry no proof of who
    // sent them, and these name a key.
    const info = payload.encryptionInfo;
    if (!info?.senderDevice) return;
    const { type, content } = payload.message;
    const transferId = content.transfer_id;
    if (typeof transferId !== "string") return;
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
    if (type === FILE_CANCEL_TYPE) {
        session.abort.abort();
    } else if (type === FILE_ACK_TYPE) {
        const ack = parseAckContent(content);
        if (ack) session.onAck?.(ack);
    } else if (
        type === FILE_ACCEPT_TYPE ||
        type === FILE_REFUSE_TYPE ||
        type === FILE_FINISH_TYPE ||
        type === FILE_DONE_TYPE
    ) {
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
    };
    // Registered before the send: a fast Accept can beat the send's response.
    const entry: Outgoing = { file, offer, roomId, eventId: "" };
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
        outgoing.delete(offer.transferId);
        unmarkOffered(offer.transferId);
        throw err;
    }
}

/** Stop offering a file, and stop every send of it. */
function endOffer(transferId: string): void {
    outgoing.delete(transferId);
    unmarkOffered(transferId);
    for (const [key, session] of sessions) {
        if (!key.startsWith(`${transferId}|`)) continue;
        session.abort.abort();
        void sendToDevice(FILE_CANCEL_TYPE, session.peer, {
            transfer_id: transferId,
        }).catch(() => {});
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
        if (session.viewId !== viewId) continue;
        session.abort.abort();
        void sendToDevice(FILE_CANCEL_TYPE, session.peer, {
            transfer_id: transferId,
        }).catch(() => {});
    }
}

async function receiveFile(
    offer: FileOffer,
    roomId: string,
    session: Session,
    sink: NonNullable<Awaited<ReturnType<typeof openSaveSink>>>,
): Promise<void> {
    const { peer } = session;
    const transferId = offer.transferId;
    const release = holdWhileTransferring();
    let link: ClosableLink | null = null;
    let receiver: BlockReceiver | null = null;
    try {
        await sendToDevice(FILE_REQUEST_TYPE, peer, {
            transfer_id: transferId,
            room_id: roomId,
        });
        const refused = expectMessage(
            session,
            FILE_REFUSE_TYPE,
            ANSWER_TIMEOUT_MS,
        ).then(() => {
            throw new TransferFailed("refused");
        });
        const answer = await untilAborted(
            session,
            Promise.race([
                refused,
                expectMessage(session, FILE_ACCEPT_TYPE, ANSWER_TIMEOUT_MS),
            ]),
        );
        refused.catch(() => {});
        if (
            typeof answer.key !== "string" ||
            typeof answer.alias !== "string" ||
            typeof answer.service_url !== "string" ||
            !answer.service_url.startsWith("https://")
        )
            throw new TransferFailed("connection");
        const key = await importTransferKey(base64UrlToBytes(answer.key));
        link = await openLink(
            { serviceUrl: answer.service_url, alias: answer.alias },
            transferIdentity(peer.userId, peer.deviceId),
            session,
        );
        updateTransfer(session.viewId, { phase: "transferring" });
        receiver = new BlockReceiver(
            offer.size,
            key,
            transferId,
            link,
            sink,
            trackProgress(session.viewId),
            (ack) =>
                void sendToDevice(FILE_ACK_TYPE, peer, {
                    transfer_id: transferId,
                    contiguous: ack.contiguous,
                    have: ack.have,
                }).catch(() => {}),
        );
        const root = await untilAborted(session, receiver.run());
        updateTransfer(session.viewId, {
            phase: "verifying",
            bytes: offer.size,
        });
        const finish = await untilAborted(
            session,
            expectMessage(session, FILE_FINISH_TYPE, VERDICT_TIMEOUT_MS),
        );
        const ok = finish.root === root;
        await sendToDevice(FILE_DONE_TYPE, peer, {
            transfer_id: transferId,
            ok,
        }).catch(() => {});
        if (!ok) throw new TransferFailed("hash-mismatch");
        await sink.finish();
        endSession(session, transferId, "done", null);
    } catch (err) {
        await sink.abort();
        if (err instanceof TransferCancelled) {
            endSession(session, transferId, "cancelled", null);
        } else {
            console.warn("[file-transfer] receive failed", err);
            endSession(session, transferId, "failed", failureOf(err));
        }
    } finally {
        receiver?.stop();
        link?.close();
        release();
    }
}

/** Accept an offer. Run this from the click: it opens the save dialog. */
export async function acceptOffer(
    roomId: string,
    senderUserId: string,
    offer: FileOffer,
): Promise<void> {
    const peer = { userId: senderUserId, deviceId: offer.senderDevice };
    const viewId = sessionKey(offer.transferId, peer.userId, peer.deviceId);
    if (sessions.has(viewId)) return;
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
        startSession(viewId, offer.transferId, peer),
        sink,
    );
}
