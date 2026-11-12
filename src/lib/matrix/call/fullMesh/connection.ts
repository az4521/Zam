/**
 * One MSC4575 connection: a one-way RTCPeerConnection between a publisher
 * (sends media and data, makes every offer) and a subscriber (receives). The
 * first offer, answer and candidates go as to-device messages
 * (signalling.ts); once the negotiated control channel is open, everything
 * but `close` goes over it.
 */
import type { CallSource } from "../transport";
import type { PluginRemoteTrackLike } from "../../callPluginData";
import {
    CANDIDATE_BATCH_MS,
    CONTROL_CHANNEL_ID,
    CONTROL_CHANNEL_LABEL,
    DATA_PROTOCOL,
    DATA_TRACK_PROTOCOL,
    EC_DATA_PROTOCOL,
    LOSSY_DATA_PROTOCOL,
    decodeDataMessage,
    decodeDataTrackFrame,
    decodeEcDataMessage,
    encodeControlMessage,
    encodeDataMessage,
    encodeDataTrackFrame,
    parseControlMessage,
    type ConsumptionMetadata,
    type ControlMessage,
    type MediaPurpose,
    type SignallingPayload,
    type TrackMetadata,
} from "./protocol";
import type { MeshPeer, Signalling } from "./signalling";
import { MeshRemoteTrack } from "./remoteTrack";

/** A subscriber that gets no offer this long gives up on the attempt. */
const OFFER_TIMEOUT_MS = 20_000;
/** A connection that won't come up in this long has failed. */
const CONNECT_TIMEOUT_MS = 30_000;

/** One local track as the mesh sends it. */
export interface MeshPublication {
    /** Stable for the track's life. */
    readonly id: string;
    readonly kind: "audio" | "video";
    readonly purpose: MediaPurpose;
    /** What to send now; null sends nothing. */
    readonly track: MediaStreamTrack | null;
    readonly muted: boolean;
    /** Tracks that play in sync share one (a=msid). */
    readonly stream: MediaStream;
}

export interface MeshLocalMedia {
    publications(): MeshPublication[];
    /** Tracks came or went, were muted, or their MediaStreamTrack changed. */
    onChange(cb: () => void): () => void;
}

interface ConnectionOptions {
    peer: MeshPeer;
    connectionId: string;
    signalling: Signalling;
    rtcConfig: RTCConfiguration;
    /** The connection is over (closed by either side, or failed). */
    onEnded: (failed: boolean) => void;
}

type MetadataMessage = Extract<
    ControlMessage,
    { type: "track_metadata" | "consumption_metadata" }
>;

/** What both ends of a connection share. */
abstract class MeshConnection {
    readonly peer: MeshPeer;
    readonly connectionId: string;
    readonly pc: RTCPeerConnection;
    protected readonly signalling: Signalling;
    private readonly onEnded: (failed: boolean) => void;
    private control: RTCDataChannel | null = null;
    private switched = false;
    private awaitingAnswer = false;
    private readonly pendingMetadata = new Map<
        MetadataMessage["type"],
        MetadataMessage
    >();
    private queue: Promise<void> = Promise.resolve();
    private candidates: RTCIceCandidateInit[] = [];
    private candidateTimer: ReturnType<typeof setTimeout> | undefined;
    private connectTimer: ReturnType<typeof setTimeout> | undefined;
    closed = false;
    /** Whether ICE ever connected, to tell a dead route from a dropped one. */
    everConnected = false;

    constructor(opts: ConnectionOptions) {
        this.peer = opts.peer;
        this.connectionId = opts.connectionId;
        this.signalling = opts.signalling;
        this.onEnded = opts.onEnded;
        this.pc = new RTCPeerConnection(opts.rtcConfig);
        this.pc.addEventListener("icecandidate", ({ candidate }) => {
            // Null ends gathering: an empty candidate says so on the wire.
            this.candidates.push(
                candidate
                    ? candidate.toJSON()
                    : { candidate: "", sdpMid: null, sdpMLineIndex: null },
            );
            this.candidateTimer ??= setTimeout(
                () => this.flushCandidates(),
                CANDIDATE_BATCH_MS,
            );
        });
        this.pc.addEventListener("connectionstatechange", () => {
            const state = this.pc.connectionState;
            if (state === "connected") {
                this.everConnected = true;
                clearTimeout(this.connectTimer);
            }
            if (state === "failed") this.fail("ice_failed");
        });
        this.connectTimer = setTimeout(() => {
            if (this.pc.connectionState !== "connected")
                this.fail("connect_timeout");
        }, CONNECT_TIMEOUT_MS);
    }

    /** Runs after everything queued before it: SDP and candidates apply in order. */
    protected enqueue(op: () => Promise<void>): void {
        this.queue = this.queue.then(op).catch((err: unknown) => {
            if (this.closed) return;
            console.warn("[full-mesh] signalling step failed", err);
            this.fail("negotiation_failed");
        });
    }

    /** Both sides create it: the publisher before its first offer, the
     *  subscriber once it applied that offer. */
    protected openControlChannel(): void {
        if (this.control) return;
        const channel = this.pc.createDataChannel(CONTROL_CHANNEL_LABEL, {
            negotiated: true,
            id: CONTROL_CHANNEL_ID,
        });
        this.control = channel;
        channel.addEventListener("open", () => this.trySwitch());
        channel.addEventListener("message", ({ data }: MessageEvent) => {
            const message = parseControlMessage(data);
            if (message) this.handle(message);
        });
        // Only ours to close with the connection: anything else is a failure.
        channel.addEventListener("close", () => {
            if (!this.closed) this.fail("control_channel_closed");
        });
    }

    private trySwitch(): void {
        if (
            this.switched ||
            this.awaitingAnswer ||
            this.control?.readyState !== "open"
        )
            return;
        this.switched = true;
        for (const message of this.pendingMetadata.values())
            this.control.send(encodeControlMessage(message));
        this.pendingMetadata.clear();
    }

    /** To the peer: over the control channel once switched, to-device before.
     *  Metadata has no to-device form: the latest waits for the switch. */
    protected send(message: ControlMessage): void {
        if (this.closed) return;
        if (this.switched && this.control?.readyState === "open") {
            this.control.send(encodeControlMessage(message));
            return;
        }
        if (
            message.type === "track_metadata" ||
            message.type === "consumption_metadata"
        ) {
            this.pendingMetadata.set(message.type, message);
            return;
        }
        if (
            message.type === "description" &&
            message.description.type === "offer"
        ) {
            this.awaitingAnswer = true;
            // The offer carries the current track metadata. A copy held from
            // before it may lack its new tracks, and sent at the switch it
            // would overwrite the newer one.
            this.pendingMetadata.delete("track_metadata");
        }
        this.signalling.send(
            this.peer,
            this.connectionId,
            message as SignallingPayload,
        );
    }

    /** The answer to our latest offer arrived: a late to-device offer can no
     *  longer overtake newer channel messages. */
    protected answerReceived(): void {
        this.awaitingAnswer = false;
        this.trySwitch();
    }

    private flushCandidates(): void {
        this.candidateTimer = undefined;
        if (this.candidates.length === 0) return;
        this.send({ type: "candidates", candidates: this.candidates });
        this.candidates = [];
    }

    protected addCandidates(candidates: RTCIceCandidateInit[]): void {
        this.enqueue(async () => {
            for (const candidate of candidates)
                await this.pc.addIceCandidate(candidate).catch(() => {
                    // An outdated or bad candidate isn't fatal.
                });
        });
    }

    /** A message of this connection: to-device or over the channel. */
    receive(payload: SignallingPayload | ControlMessage): void {
        if (this.closed) return;
        if (payload.type === "close") {
            this.close(undefined, false);
            return;
        }
        if (payload.type === "subscribe") return;
        this.handle(payload);
    }

    protected abstract handle(message: ControlMessage): void;

    protected fail(reason: string): void {
        if (this.closed) return;
        console.info(
            `[full-mesh] connection with ${this.peer.memberId} failed: ${reason}`,
        );
        this.end(reason, true, true);
    }

    /** Close, telling the peer unless it closed first. */
    close(reason: string | undefined, notifyPeer: boolean): void {
        this.end(reason, notifyPeer, false);
    }

    private end(
        reason: string | undefined,
        notifyPeer: boolean,
        failed: boolean,
    ): void {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.candidateTimer);
        clearTimeout(this.connectTimer);
        // Always to-device: closing the connection would race a channel message.
        if (notifyPeer)
            this.signalling.send(this.peer, this.connectionId, {
                type: "close",
                ...(reason ? { reason } : {}),
            });
        this.onClosed();
        this.pc.close();
        this.onEnded(failed);
    }

    protected onClosed(): void {}
}

// ── Publisher ──────────────────────────────────────────────────────────────

interface SentTrack {
    transceiver: RTCRtpTransceiver;
    publication: MeshPublication;
    /** What the sender carries now, to skip needless replaceTrack calls;
     *  undefined forces the next apply. */
    sending: MediaStreamTrack | null | undefined;
}

/** Our side of a connection a subscriber asked for. */
export class PublisherConnection extends MeshConnection {
    private readonly sent = new Map<string, SentTrack>();
    private consumption: ConsumptionMetadata = {};
    private readonly data: RTCDataChannel;
    private readonly lossy: RTCDataChannel;
    /** Plugin data tracks: one channel each. */
    private readonly dataTracks = new Map<string, RTCDataChannel>();
    private offerPending = false;
    private renegotiate = false;
    private readonly stopWatching: () => void;
    private lastMetadata = "";

    constructor(
        opts: ConnectionOptions,
        private readonly local: MeshLocalMedia,
        dataTrackNames: Iterable<string>,
    ) {
        super(opts);
        // All before the first offer, which so has the data section.
        this.openControlChannel();
        this.data = this.pc.createDataChannel("data", {
            protocol: DATA_PROTOCOL,
        });
        this.lossy = this.pc.createDataChannel("data-lossy", {
            protocol: LOSSY_DATA_PROTOCOL,
            ordered: false,
            maxRetransmits: 0,
        });
        for (const name of dataTrackNames) this.addDataTrack(name);
        this.stopWatching = local.onChange(() => this.sync());
        this.sync(true);
    }

    /** Bring the transceivers in line with our tracks. */
    private sync(first = false): void {
        if (this.closed) return;
        const publications = this.local.publications();
        const ids = new Set(publications.map((p) => p.id));
        let changed = first;
        for (const [id, entry] of this.sent) {
            if (ids.has(id)) continue;
            this.sent.delete(id);
            void entry.transceiver.sender.replaceTrack(null).catch(() => {});
            if (this.pc.signalingState !== "closed") entry.transceiver.stop();
            changed = true;
        }
        for (const publication of publications) {
            const entry = this.sent.get(publication.id);
            if (entry) {
                entry.publication = publication;
                this.applyTrack(entry);
                continue;
            }
            const transceiver = this.pc.addTransceiver(publication.kind, {
                direction: "sendonly",
                streams: [publication.stream],
            });
            const added: SentTrack = {
                transceiver,
                publication,
                sending: undefined,
            };
            this.sent.set(publication.id, added);
            this.applyTrack(added);
            changed = true;
        }
        if (changed) this.negotiate();
        else this.sendMetadataIfChanged();
    }

    private trackMetadata(): TrackMetadata {
        const metadata: TrackMetadata = {};
        for (const { transceiver, publication } of this.sent.values())
            if (transceiver.mid !== null)
                metadata[transceiver.mid] = {
                    purpose: publication.purpose,
                    muted: publication.muted,
                };
        return metadata;
    }

    /** Mutes need no renegotiation: just the metadata. */
    private sendMetadataIfChanged(): void {
        const metadata = this.trackMetadata();
        const encoded = JSON.stringify(metadata);
        if (encoded === this.lastMetadata) return;
        this.lastMetadata = encoded;
        this.send({ type: "track_metadata", track_metadata: metadata });
    }

    /** Nothing while muted video or unused: turning it back on needs no
     *  renegotiation. Muted audio keeps flowing as the silence LiveKit
     *  makes of it. */
    private applyTrack(entry: SentTrack): void {
        const { publication, transceiver } = entry;
        const mid = transceiver.mid;
        const use = mid === null ? {} : (this.consumption[mid] ?? {});
        const want =
            use.in_use === false ||
            (publication.kind === "video" && publication.muted)
                ? null
                : publication.track;
        if (want === entry.sending) return;
        entry.sending = want;
        void transceiver.sender
            .replaceTrack(want)
            .then(() => this.constrainVideo(entry))
            .catch((err: unknown) =>
                console.warn("[full-mesh] couldn't send a track", err),
            );
    }

    /** Scale video down to the size the subscriber shows it at. */
    private async constrainVideo(entry: SentTrack): Promise<void> {
        const { transceiver, sending } = entry;
        if (entry.publication.kind !== "video" || !sending) return;
        const mid = transceiver.mid;
        const use = mid === null ? {} : (this.consumption[mid] ?? {});
        const params = transceiver.sender.getParameters();
        const [encoding] = params.encodings ?? [];
        if (!encoding) return;
        const { width, height } = sending.getSettings();
        const scale = Math.max(
            1,
            width && use.max_width ? width / use.max_width : 1,
            height && use.max_height ? height / use.max_height : 1,
        );
        if (encoding.scaleResolutionDownBy === scale) return;
        encoding.scaleResolutionDownBy = scale;
        await transceiver.sender.setParameters(params);
    }

    /** One offer at a time: changes made meanwhile go out together next. */
    private negotiate(): void {
        if (this.offerPending) {
            this.renegotiate = true;
            return;
        }
        this.offerPending = true;
        this.renegotiate = false;
        this.enqueue(async () => {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            const metadata = this.trackMetadata();
            this.lastMetadata = JSON.stringify(metadata);
            this.send({
                type: "description",
                description: {
                    type: "offer",
                    sdp: this.pc.localDescription!.sdp,
                },
                track_metadata: metadata,
            });
            // The mids exist now: consumption may apply to new tracks.
            for (const entry of this.sent.values()) this.applyTrack(entry);
        });
    }

    protected handle(message: ControlMessage): void {
        switch (message.type) {
            case "description":
                if (message.description.type !== "answer") return;
                this.enqueue(async () => {
                    if (this.pc.signalingState !== "have-local-offer") return;
                    await this.pc.setRemoteDescription(message.description);
                    this.answerReceived();
                    this.offerPending = false;
                    if (this.renegotiate) this.negotiate();
                });
                break;
            case "candidates":
                this.addCandidates(message.candidates);
                break;
            case "consumption_metadata":
                this.consumption = message.consumption_metadata;
                for (const entry of this.sent.values()) {
                    // Forget what was applied, so size changes re-apply too.
                    entry.sending = undefined;
                    this.applyTrack(entry);
                }
                break;
            default:
                break;
        }
    }

    /** False when the channel isn't open (yet). */
    sendData(
        payload: Uint8Array,
        topic: string | undefined,
        reliable: boolean,
    ): boolean {
        const channel = reliable ? this.data : this.lossy;
        if (channel.readyState !== "open") return false;
        try {
            channel.send(encodeDataMessage(payload, topic));
            return true;
        } catch {
            return false;
        }
    }

    /** Bytes queued on the reliable data channel, not yet sent. */
    dataBuffered(): number {
        return this.data.bufferedAmount;
    }

    addDataTrack(name: string): void {
        if (this.closed || this.dataTracks.has(name)) return;
        this.dataTracks.set(
            name,
            this.pc.createDataChannel(name, {
                protocol: DATA_TRACK_PROTOCOL,
                ordered: false,
                maxRetransmits: 0,
            }),
        );
    }

    removeDataTrack(name: string): void {
        const channel = this.dataTracks.get(name);
        this.dataTracks.delete(name);
        channel?.close();
    }

    pushDataTrack(name: string, frame: Uint8Array): boolean {
        const channel = this.dataTracks.get(name);
        if (channel?.readyState !== "open") return false;
        try {
            channel.send(frame as Uint8Array<ArrayBuffer>);
            return true;
        } catch {
            return false;
        }
    }

    protected onClosed(): void {
        this.stopWatching();
    }
}

// ── Subscriber ─────────────────────────────────────────────────────────────

export interface ReceivedTrack {
    readonly mid: string;
    readonly kind: "audio" | "video";
    readonly track: MeshRemoteTrack;
    readonly receiver: RTCRtpReceiver;
}

export interface SubscriberEvents {
    /** Tracks, their metadata, or data tracks changed. */
    changed(): void;
    audioAdded(track: ReceivedTrack): void;
    audioRemoved(track: ReceivedTrack): void;
    videoAdded(track: ReceivedTrack): void;
    data(payload: Uint8Array, topic: string | undefined): void;
    dataTrackOpened(track: MeshRemoteDataTrack): void;
    dataTrackClosed(sid: string): void;
    playbackBlockedChanged(): void;
}

/** What a purpose and a media kind mean as a call source. */
export function sourceOf(
    purpose: string | undefined,
    kind: "audio" | "video",
): CallSource {
    if (purpose === "m.usermedia")
        return kind === "audio" ? "microphone" : "camera";
    if (purpose === "m.screenshare")
        return kind === "audio" ? "screen_share_audio" : "screen_share";
    return "unknown";
}

/** Our side of a connection to a publisher whose media we want. */
export class SubscriberConnection extends MeshConnection {
    private trackMetadata: TrackMetadata = {};
    private readonly received = new Map<string, ReceivedTrack>();
    private consumption: ConsumptionMetadata = {};
    private readonly dataTracks = new Map<string, MeshRemoteDataTrack>();
    private offerTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        opts: ConnectionOptions,
        private readonly events: SubscriberEvents,
    ) {
        super(opts);
        this.pc.addEventListener("track", (ev) => this.onTrack(ev));
        this.pc.addEventListener("datachannel", ({ channel }) =>
            this.onDataChannel(channel),
        );
        this.signalling.send(this.peer, this.connectionId, {
            type: "subscribe",
        });
        this.offerTimer = setTimeout(
            () => this.fail("no_offer"),
            OFFER_TIMEOUT_MS,
        );
    }

    tracks(): ReceivedTrack[] {
        return [...this.received.values()];
    }

    metadataOf(mid: string) {
        return this.trackMetadata[mid];
    }

    inUse(mid: string): boolean {
        return this.consumption[mid]?.in_use ?? true;
    }

    /** Ask the publisher to stop (or resume) sending a track. */
    setInUse(mid: string, inUse: boolean): void {
        if (this.inUse(mid) === inUse) return;
        const entry = { ...this.consumption[mid] };
        if (inUse) delete entry.in_use;
        else entry.in_use = false;
        this.consumption = { ...this.consumption, [mid]: entry };
        this.send({
            type: "consumption_metadata",
            consumption_metadata: this.consumption,
        });
    }

    get playbackBlocked(): boolean {
        return [...this.received.values()].some(
            (r) => r.kind === "audio" && r.track.playbackBlocked,
        );
    }

    async startAudio(): Promise<void> {
        await Promise.all(
            [...this.received.values()].map((r) => r.track.resume()),
        );
    }

    protected handle(message: ControlMessage): void {
        switch (message.type) {
            case "description":
                if (message.description.type !== "offer") return;
                clearTimeout(this.offerTimer);
                this.enqueue(async () => {
                    // Before applying: the browser fires `track` while it
                    // applies, and a track must arrive with its metadata.
                    if (message.track_metadata)
                        this.trackMetadata = message.track_metadata;
                    await this.pc.setRemoteDescription(message.description);
                    this.openControlChannel();
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    this.send({
                        type: "description",
                        description: {
                            type: "answer",
                            sdp: this.pc.localDescription!.sdp,
                        },
                    });
                    this.answerReceived();
                    this.dropStoppedTracks();
                    this.events.changed();
                    // Our first consumption metadata goes once switched.
                    if (Object.keys(this.consumption).length > 0)
                        this.send({
                            type: "consumption_metadata",
                            consumption_metadata: this.consumption,
                        });
                });
                break;
            case "candidates":
                this.addCandidates(message.candidates);
                break;
            case "track_metadata":
                // Queued like the offers: one that arrived behind a pending
                // offer is newer than the metadata that offer carries, and
                // applying it at once would let the offer overwrite it, leaving
                // a peer shown muted (or not) until their next change.
                this.enqueue(async () => {
                    this.trackMetadata = message.track_metadata;
                    this.events.changed();
                });
                break;
            default:
                break;
        }
    }

    private onTrack(ev: RTCTrackEvent): void {
        const mid = ev.transceiver.mid;
        if (mid === null || this.closed) return;
        const kind = ev.track.kind === "audio" ? "audio" : "video";
        const old = this.received.get(mid);
        if (old?.track.mediaStreamTrack === ev.track) return;
        if (old) this.removeTrack(old);
        const received: ReceivedTrack = {
            mid,
            kind,
            receiver: ev.receiver,
            track: new MeshRemoteTrack(ev.track, () =>
                this.events.playbackBlockedChanged(),
            ),
        };
        this.received.set(mid, received);
        if (kind === "audio") this.events.audioAdded(received);
        else this.events.videoAdded(received);
        this.events.changed();
    }

    /** Transceivers the publisher stopped in its latest offer. */
    private dropStoppedTracks(): void {
        const live = new Set(
            this.pc
                .getTransceivers()
                .filter(
                    (t) =>
                        t.mid !== null &&
                        t.currentDirection !== "stopped" &&
                        t.currentDirection !== "inactive",
                )
                .map((t) => t.mid),
        );
        for (const received of [...this.received.values()])
            if (!live.has(received.mid)) this.removeTrack(received);
    }

    private removeTrack(received: ReceivedTrack): void {
        this.received.delete(received.mid);
        if (received.kind === "audio") this.events.audioRemoved(received);
        received.track.detachAll();
    }

    private onDataChannel(channel: RTCDataChannel): void {
        channel.binaryType = "arraybuffer";
        switch (channel.protocol) {
            case DATA_PROTOCOL:
            case LOSSY_DATA_PROTOCOL:
                channel.addEventListener("message", ({ data }) => {
                    if (!(data instanceof ArrayBuffer)) return;
                    const message = decodeDataMessage(data);
                    if (message)
                        this.events.data(message.payload, message.topic);
                });
                break;
            case EC_DATA_PROTOCOL:
                channel.addEventListener("message", ({ data }) => {
                    const message = decodeEcDataMessage(data);
                    if (message)
                        this.events.data(message.payload, message.topic);
                });
                break;
            case DATA_TRACK_PROTOCOL: {
                const track = new MeshRemoteDataTrack(
                    `${this.connectionId}/${channel.id ?? channel.label}`,
                    channel.label,
                    `${this.peer.userId}:${this.peer.deviceId}`,
                    channel,
                );
                this.dataTracks.set(track.info.sid, track);
                const opened = () => this.events.dataTrackOpened(track);
                if (channel.readyState === "open") opened();
                else channel.addEventListener("open", opened, { once: true });
                channel.addEventListener("close", () => {
                    if (!this.dataTracks.delete(track.info.sid)) return;
                    track.end();
                    this.events.dataTrackClosed(track.info.sid);
                });
                break;
            }
            default:
                // A protocol we don't know: the MSC says to ignore it.
                break;
        }
    }

    remoteDataTracks(): MeshRemoteDataTrack[] {
        return [...this.dataTracks.values()];
    }

    protected onClosed(): void {
        clearTimeout(this.offerTimer);
        for (const received of [...this.received.values()])
            this.removeTrack(received);
        for (const track of this.dataTracks.values()) {
            track.end();
            this.events.dataTrackClosed(track.info.sid);
        }
        this.dataTracks.clear();
        this.events.changed();
    }
}

/** A plugin data track a publisher sends us, as callPluginData reads one. */
export class MeshRemoteDataTrack implements PluginRemoteTrackLike {
    readonly info: { readonly sid: string; readonly name: string };
    private readonly readers = new Set<
        ReadableStreamDefaultController<{
            payload: Uint8Array;
            userTimestamp?: bigint;
        }>
    >();

    constructor(
        sid: string,
        name: string,
        readonly publisherIdentity: string,
        channel: RTCDataChannel,
    ) {
        this.info = { sid, name };
        channel.addEventListener("message", ({ data }) => {
            if (!(data instanceof ArrayBuffer)) return;
            const frame = decodeDataTrackFrame(data);
            if (!frame) return;
            for (const reader of this.readers) {
                try {
                    reader.enqueue(frame);
                } catch {
                    this.readers.delete(reader);
                }
            }
        });
    }

    subscribe(options?: { signal?: AbortSignal }) {
        let controller!: ReadableStreamDefaultController<{
            payload: Uint8Array;
            userTimestamp?: bigint;
        }>;
        const stream = new ReadableStream<{
            payload: Uint8Array;
            userTimestamp?: bigint;
        }>({
            start: (c) => {
                controller = c;
                this.readers.add(c);
            },
            cancel: () => void this.readers.delete(controller),
        });
        options?.signal?.addEventListener(
            "abort",
            () => {
                this.readers.delete(controller);
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            },
            { once: true },
        );
        return stream;
    }

    end(): void {
        for (const reader of this.readers) {
            try {
                reader.close();
            } catch {
                /* already closed */
            }
        }
        this.readers.clear();
    }
}

/** Encode a plugin data track frame (re-exported for the transport). */
export { encodeDataTrackFrame };
