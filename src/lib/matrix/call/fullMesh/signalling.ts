/**
 * The to-device half of MSC4575: sending the four signalling messages to one
 * member's device, Olm-encrypted, and receiving them in `seq` order with the
 * checks the MSC lists. A connection's control channel takes over once open
 * (connection.ts); `close` always comes this way.
 */
import { ClientEvent, type MatrixClient } from "matrix-js-sdk";
import type { ReceivedToDevice } from "../../keyBackfill";
import {
    SIGNALLING_TYPES,
    SEQ_GAP_TIMEOUT_MS,
    SEQ_START_WAIT_MS,
    SeqOrderer,
    buildSignalling,
    parseSignalling,
    type SignallingPayload,
} from "./protocol";

/** A call member as signalling knows it. */
export interface MeshPeer {
    userId: string;
    deviceId: string;
    memberId: string;
}

export interface SignallingMessage {
    peer: MeshPeer;
    connectionId: string;
    payload: SignallingPayload;
}

export interface Signalling {
    send(
        peer: MeshPeer,
        connectionId: string,
        payload: SignallingPayload,
    ): void;
    dispose(): void;
}

const OUR_TYPES = new Set(Object.values(SIGNALLING_TYPES));

/** Where the outgoing counts are kept across reloads. */
const SEQ_STORE_KEY = "moe.crafty.full_mesh.seq";
/** A count unused this long is forgotten. */
const SEQ_STORE_TTL_MS = 2 * 24 * 60 * 60 * 1000;

interface SeqRecord {
    /** The next seq to send. */
    next: number;
    /** The peer's membership created_ts this count belongs to, if known. */
    since?: number;
    /** When it was last used. */
    at: number;
}

/**
 * The next `seq` per (own member, target member). The MSC counts across
 * connections, and a receiver drops anything below the seq it expects next
 * (Element Call does), so the count must not start over while the receiver
 * keeps its own: not on a rejoin, not on a reload of ours either, since our
 * member id is the same after one. It does start over when the receiver
 * rejoined, which a legacy membership's created_ts tells: the receiver's
 * count of us starts over too then.
 */
const seqStore = {
    records: null as Map<string, SeqRecord> | null,

    load(): Map<string, SeqRecord> {
        if (this.records) return this.records;
        const records = new Map<string, SeqRecord>();
        try {
            const raw: unknown = JSON.parse(
                localStorage.getItem(SEQ_STORE_KEY) ?? "{}",
            );
            const now = Date.now();
            if (raw && typeof raw === "object")
                for (const [key, r] of Object.entries(raw)) {
                    if (
                        typeof r?.next === "number" &&
                        Number.isSafeInteger(r.next) &&
                        r.next >= 0 &&
                        typeof r.at === "number" &&
                        now - r.at < SEQ_STORE_TTL_MS
                    )
                        records.set(key, {
                            next: r.next,
                            at: r.at,
                            ...(typeof r.since === "number"
                                ? { since: r.since }
                                : {}),
                        });
                }
        } catch {
            // No storage (private window, blocked): counts live for the page.
        }
        this.records = records;
        return records;
    },

    take(key: string, since: number | undefined): number {
        const records = this.load();
        const record = records.get(key);
        const restarted =
            record?.since !== undefined &&
            since !== undefined &&
            record.since !== since;
        const seq = record && !restarted ? record.next : 0;
        records.set(key, {
            next: seq + 1,
            at: Date.now(),
            ...((since ?? record?.since) !== undefined
                ? { since: since ?? record?.since }
                : {}),
        });
        try {
            localStorage.setItem(
                SEQ_STORE_KEY,
                JSON.stringify(Object.fromEntries(records)),
            );
        } catch {
            // As above.
        }
        return seq;
    },
};

/** Tests: forget the counts in memory (a reload), and the stored ones
 *  unless `keepStored`. */
export function resetSeqStoreForTests(keepStored = false): void {
    seqStore.records = null;
    if (keepStored) return;
    try {
        localStorage.removeItem(SEQ_STORE_KEY);
    } catch {
        /* none */
    }
}

export function createSignalling(opts: {
    client: MatrixClient;
    roomId: string;
    slotId: string;
    own: MeshPeer;
    onMessage: (message: SignallingMessage) => void;
    /** The created_ts of a member's legacy membership, which changes only
     *  when they rejoin; undefined when not known (or a sticky one). */
    peerSince?: (memberId: string) => number | undefined;
}): Signalling {
    const { client, roomId, slotId, own, onMessage, peerSince } = opts;
    // Sends to one member must reach the to-device queue in seq order, and
    // encryption is async.
    const chains = new Map<string, Promise<void>>();
    const orderers = new Map<string, SeqOrderer<SignallingMessage>>();
    let disposed = false;

    const send: Signalling["send"] = (peer, connectionId, payload) => {
        if (disposed) return;
        // Per device as well, as the receiving side orders them.
        const seqKey = [
            own.memberId,
            own.deviceId,
            peer.memberId,
            peer.deviceId,
        ].join("\n");
        const seq = seqStore.take(seqKey, peerSince?.(peer.memberId));
        const { eventType, content } = buildSignalling(
            {
                room_id: roomId,
                slot_id: slotId,
                member_id: own.memberId,
                claimed_device_id: own.deviceId,
                target_member_id: peer.memberId,
                connection_id: connectionId,
                seq,
            },
            payload,
        );
        const prev = chains.get(peer.memberId) ?? Promise.resolve();
        const next = prev.then(async () => {
            const crypto = client.getCrypto();
            if (!crypto) throw new Error("encryption is not running");
            const device = { userId: peer.userId, deviceId: peer.deviceId };
            const batch = await crypto.encryptToDeviceMessages(
                eventType,
                [device],
                content,
            );
            // No Olm session with that device: the message would go nowhere.
            if (batch.batch.length === 0)
                throw new Error(`no Olm session with ${peer.deviceId}`);
            await client.queueToDevice(batch);
        });
        const settled = next.catch((err) =>
            console.warn("[full-mesh] couldn't send", eventType, err),
        );
        chains.set(peer.memberId, settled);
        void settled.then(() => {
            if (chains.get(peer.memberId) === settled)
                chains.delete(peer.memberId);
        });
    };

    const onToDevice = (received: ReceivedToDevice): void => {
        if (disposed) return;
        const { type, content } = received.message;
        if (!OUR_TYPES.has(type)) return;
        // Cleartext carries no proof of who sent it: the MSC drops it.
        const info = received.encryptionInfo;
        if (!info) return;
        const parsed = parseSignalling(type, content);
        if (!parsed) return;
        const { common, payload } = parsed;
        if (
            common.room_id !== roomId ||
            common.slot_id !== slotId ||
            common.target_member_id !== own.memberId
        )
            return;
        // The Olm sending device is known here, so the claim must match it.
        if (info.senderDevice && info.senderDevice !== common.claimed_device_id)
            return;
        const peer: MeshPeer = {
            userId: info.sender,
            deviceId: common.claimed_device_id,
            memberId: common.member_id,
        };
        // Per device too: another device of the same user claiming the
        // member id must not disturb the real one's order.
        const key = `${peer.userId}\n${peer.deviceId}\n${peer.memberId}`;
        let orderer = orderers.get(key);
        // A seq 0 once the count moved past it is a sender that started
        // counting again (it rejoined or reloaded). Before that it may just
        // come after later ones.
        const restarted = common.seq === 0 && !!orderer?.advanced;
        if (!orderer || restarted) {
            orderer?.dispose();
            orderer = new SeqOrderer(
                (m) => {
                    if (!disposed) onMessage(m);
                },
                SEQ_GAP_TIMEOUT_MS,
                // Their count runs across connections, and our page may be
                // newer than theirs: a fresh orderer can't wait for 0.
                SEQ_START_WAIT_MS,
            );
            orderers.set(key, orderer);
        }
        orderer.push(common.seq, {
            peer,
            connectionId: common.connection_id,
            payload,
        });
    };
    client.on(
        ClientEvent.ReceivedToDeviceMessage as never,
        onToDevice as never,
    );

    return {
        send,
        dispose() {
            disposed = true;
            client.off(
                ClientEvent.ReceivedToDeviceMessage as never,
                onToDevice as never,
            );
            for (const o of orderers.values()) o.dispose();
            orderers.clear();
        },
    };
}
