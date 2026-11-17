// The direct link of a file transfer, version 2: one WebRTC data channel
// between the two devices, with its SDP and candidates carried in Olm-encrypted
// to-device messages (wired by the transfer code, not here). The DTLS
// fingerprints in those SDPs authenticate the channel, so packets on it need
// no MAC of their own.
//
// Both ends are relay-only: a host or reflexive candidate would show the other
// device's address, which the user never agreed to share on this path.

import { FILE_DATA_TOPIC } from "$lib/utils/fileTransfer";
import {
    DIRECT_LOW_WATER,
    DIRECT_MAX_BUFFERED,
    isRelayCandidate,
    isValidSdp,
    parseCandidates,
    stripCandidateLines,
} from "$lib/utils/fileTransferDirect";
import type { TransferLink } from "./fileTransferEngine";

export interface DirectLink extends TransferLink {
    close(): void;
}

/** Candidates found within this window go out in one message. */
const CANDIDATE_BATCH_MS = 100;

interface DirectOpts {
    rtcConfig: RTCConfiguration;
    relayOnly: boolean;
    sendCandidates: (candidates: RTCIceCandidateInit[]) => void;
    onFailed: () => void;
}

export async function openSenderDirect(opts: DirectOpts): Promise<{
    link: DirectLink;
    offerSdp: string;
    acceptAnswer(sdp: string): Promise<void>;
    addCandidates(value: unknown): Promise<void>;
}> {
    const pc = await newConnection(opts.rtcConfig, opts.relayOnly);
    const conn = wire(pc, opts);
    try {
        // Created before the offer, so the offer describes the channel.
        conn.attach(pc.createDataChannel(FILE_DATA_TOPIC, { ordered: true }));
        await pc.setLocalDescription(await pc.createOffer());
    } catch (err) {
        conn.close();
        throw err;
    }
    return {
        link: conn.link,
        offerSdp: localSdp(pc),
        acceptAnswer: async (sdp) => {
            if (conn.isClosed()) throw new Error("link closed");
            if (!isValidSdp(sdp, "answer")) throw new Error("bad answer");
            await pc.setRemoteDescription({ type: "answer", sdp });
            conn.remoteReady();
        },
        addCandidates: conn.addCandidates,
    };
}

export async function openReceiverDirect(
    opts: DirectOpts & { offerSdp: string },
): Promise<{
    link: DirectLink;
    answerSdp: string;
    addCandidates(value: unknown): Promise<void>;
}> {
    if (!isValidSdp(opts.offerSdp, "offer")) throw new Error("bad offer");
    const pc = await newConnection(opts.rtcConfig, opts.relayOnly);
    const conn = wire(pc, opts);
    // The sender's channel arrives as a remote event; take ours by label only.
    pc.ondatachannel = (event) => {
        if (event.channel.label === FILE_DATA_TOPIC) conn.attach(event.channel);
    };
    try {
        await pc.setRemoteDescription({ type: "offer", sdp: opts.offerSdp });
        conn.remoteReady();
        await pc.setLocalDescription(await pc.createAnswer());
    } catch (err) {
        conn.close();
        throw err;
    }
    return {
        link: conn.link,
        answerSdp: localSdp(pc),
        addCandidates: conn.addCandidates,
    };
}

/** A connection with a certificate of its own, so no DTLS identity is reused
 *  between transfers. */
async function newConnection(
    rtcConfig: RTCConfiguration,
    relayOnly: boolean,
): Promise<RTCPeerConnection> {
    const certificate = await RTCPeerConnection.generateCertificate({
        name: "ECDSA",
        namedCurve: "P-256",
    } as AlgorithmIdentifier);
    const config: RTCConfiguration = {
        ...rtcConfig,
        certificates: [certificate],
    };
    if (relayOnly) config.iceTransportPolicy = "relay";
    return new RTCPeerConnection(config);
}

function localSdp(pc: RTCPeerConnection): string {
    const description = pc.localDescription;
    if (!description) throw new Error("no local description");
    return stripCandidateLines(description.sdp);
}

/** Everything that is the same for both ends: candidate trickle, remote
 *  candidates waiting for the remote description, the channel and its
 *  failure reporting. */
function wire(pc: RTCPeerConnection, opts: DirectOpts) {
    let channel: RTCDataChannel | null = null;
    let handler: (packet: Uint8Array) => void = () => {};
    let closed = false;
    let failed = false;
    let hasRemote = false;
    let queued: RTCIceCandidateInit[] = [];
    let pending: RTCIceCandidateInit[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The tail of the send queue: each send waits for the one before it.
    let sendTail: Promise<void> = Promise.resolve();

    const fail = () => {
        if (closed || failed) return;
        failed = true;
        opts.onFailed();
    };

    const flush = () => {
        timer = null;
        if (closed || pending.length === 0) return;
        const batch = pending;
        pending = [];
        opts.sendCandidates(batch);
    };

    pc.onicecandidate = (event) => {
        const candidate = event.candidate;
        // A null event marks the end of gathering; an empty line has nothing to send.
        if (closed || !candidate || !candidate.candidate) return;
        if (opts.relayOnly && !isRelayCandidate(candidate.candidate)) return;
        pending.push(candidate.toJSON());
        if (timer === null) timer = setTimeout(flush, CANDIDATE_BATCH_MS);
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") fail();
    };

    const addAll = async (list: RTCIceCandidateInit[]) => {
        for (const candidate of list) {
            try {
                await pc.addIceCandidate(candidate);
            } catch {
                // One bad candidate does not stop the others; ICE copes with the gap.
            }
        }
    };

    const attach = (ch: RTCDataChannel) => {
        if (channel || closed) return;
        channel = ch;
        ch.binaryType = "arraybuffer";
        ch.bufferedAmountLowThreshold = DIRECT_LOW_WATER;
        ch.onmessage = (event) => {
            // Control traffic is binary; a string is not ours to parse.
            if (event.data instanceof ArrayBuffer)
                handler(new Uint8Array(event.data));
        };
        ch.onclose = () => fail();
    };

    const sendNow = async (packet: Uint8Array<ArrayBuffer>): Promise<void> => {
        const ch = channel;
        if (closed || !ch || ch.readyState !== "open")
            throw new Error("link down");
        // One bufferedamountlow can wake every waiter at once, so the queue is
        // checked again each time before anything goes into the channel.
        while (ch.bufferedAmount > DIRECT_MAX_BUFFERED) {
            await drained(ch);
            if (closed || ch.readyState !== "open")
                throw new Error("link down");
        }
        try {
            ch.send(packet);
        } catch (err) {
            // Chrome throws when its send queue is full; this send fails, and
            // the queue behind it carries on.
            throw err instanceof Error ? err : new Error("send failed");
        }
    };

    const link: DirectLink = {
        // Sends reach the channel in call order, one at a time. A failed send
        // does not hold up the ones behind it.
        send: (packet) => {
            const run = sendTail.then(() => sendNow(packet));
            sendTail = run.catch(() => {});
            return run;
        },
        onPacket: (h) => {
            handler = h;
        },
        close: () => {
            if (closed) return;
            closed = true;
            if (timer) clearTimeout(timer);
            timer = null;
            pending = [];
            queued = [];
            // Our own close also fires the channel's close event, which is
            // ignored because closed is already set.
            channel?.close();
            pc.close();
        },
    };

    return {
        link,
        attach,
        isClosed: () => closed,
        /** Called once the remote description is set: queued candidates go in. */
        remoteReady: () => {
            hasRemote = true;
            const list = queued;
            queued = [];
            void addAll(list);
        },
        addCandidates: async (value: unknown): Promise<void> => {
            if (closed) return;
            const list = parseCandidates(value, opts.relayOnly);
            if (!hasRemote) {
                queued.push(...list);
                return;
            }
            await addAll(list);
        },
        close: () => link.close(),
    };
}

/** Resolves once the channel's queue has drained, rejects if it closes first. */
function drained(ch: RTCDataChannel): Promise<void> {
    return new Promise((resolve, reject) => {
        const done = (err?: Error) => {
            ch.removeEventListener("bufferedamountlow", onLow);
            ch.removeEventListener("close", onClose);
            if (err) reject(err);
            else resolve();
        };
        const onLow = () => done();
        const onClose = () => done(new Error("link down"));
        ch.addEventListener("bufferedamountlow", onLow);
        ch.addEventListener("close", onClose);
    });
}
