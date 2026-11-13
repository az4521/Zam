/**
 * The full mesh transport (MSC4575) of one call: a SubscriberConnection to
 * every member we receive over the mesh, and, when we publish on it, a
 * PublisherConnection to every member who asked for our media. Implements
 * the call's transport interfaces (../transport.ts), so livekitCall.ts
 * treats it like any SFU connection.
 */
import type { MatrixClient } from "matrix-js-sdk";
import type {
    CallDataPublisher,
    CallTransport,
    CallTransportListener,
    PublishDataOptions,
    RemoteParticipantView,
    RemoteTrackView,
} from "../transport";
import type {
    PluginLocalTrackLike,
    PluginRoomLike,
} from "../../callPluginData";
import { SUBSCRIBE_GRACE_MS, encodeDataTrackFrame } from "./protocol";
import { createSignalling, type MeshPeer, type Signalling } from "./signalling";
import {
    PublisherConnection,
    SubscriberConnection,
    sourceOf,
    type MeshLocalMedia,
    type MeshRemoteDataTrack,
} from "./connection";

/** How often audio levels are read for the speaking indicators. */
const SPEAKER_POLL_MS = 250;
/** RTP audio level (0..1) above which someone counts as speaking. */
const SPEAKING_LEVEL = 0.03;
/** Speaking stays shown this long after the level drops, so it doesn't flicker. */
const SPEAKING_HOLD_MS = 600;
/** Queued bytes past which sendDataTo waits. */
const SEND_BUFFER_MAX = 1024 * 1024;
const SEND_BUFFER_POLL_MS = 10;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
/** A connection up this long counts as having worked: retries start over. */
const STABLE_MS = 60_000;

export interface MeshMember extends MeshPeer {
    /** Publishes on full mesh, and we receive them through it. */
    subscribe: boolean;
    /** Their legacy membership's created_ts: changes only on a rejoin.
     *  Undefined for a sticky m.rtc.member, whose timestamp changes on
     *  every refresh. */
    since?: number;
}

/** "@user:server:DEVICE", the identity every transport uses. */
export function meshIdentity(peer: { userId: string; deviceId: string }) {
    return `${peer.userId}:${peer.deviceId}`;
}

interface Subscription {
    peer: MeshPeer;
    connection: SubscriberConnection | null;
    attempts: number;
    retryTimer?: ReturnType<typeof setTimeout>;
    startedAt: number;
    /** connectionFailed was reported for this member. */
    reported?: boolean;
}

export class FullMeshTransport implements CallTransport, CallDataPublisher {
    readonly kind = "full_mesh" as const;
    private readonly signalling: Signalling;
    private readonly members = new Map<string, MeshMember>();
    private readonly subscriptions = new Map<string, Subscription>();
    private readonly publishers = new Map<string, PublisherConnection>();
    /** Subscribe requests that came before the member's membership. */
    private readonly waiting = new Map<
        string,
        {
            peer: MeshPeer;
            connectionId: string;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private readonly localDataTracks = new Set<string>();
    /** Members a relayed connection to never came up: connect directly. */
    private readonly direct = new Set<string>();
    private closed = false;
    private readonly speakerTimer: ReturnType<typeof setInterval>;
    private readonly lastLoud = new Map<string, number>();
    private speaking: string[] = [];
    private localLevel: {
        ctx: AudioContext;
        analyser: AnalyserNode;
        track: MediaStreamTrack;
    } | null = null;

    readonly pluginRoom: PluginRoomLike;

    constructor(
        private readonly opts: {
            client: MatrixClient;
            roomId: string;
            slotId: string;
            own: MeshPeer;
            /** Null until setListener: nothing connects before setMembers. */
            listener: CallTransportListener | null;
            /** What we send; null when we don't publish on the mesh. */
            local: MeshLocalMedia | null;
            /** `direct`: a relayed connection to this member never came
             *  up, so leave the relay out if the user allows that. */
            rtcConfig: (direct: boolean) => Promise<RTCConfiguration>;
        },
    ) {
        this.signalling = createSignalling({
            client: opts.client,
            roomId: opts.roomId,
            slotId: opts.slotId,
            own: opts.own,
            onMessage: (m) =>
                this.onSignalling(m.peer, m.connectionId, m.payload),
            peerSince: (memberId) => this.members.get(memberId)?.since,
        });
        const subscriptions = this.subscriptions;
        this.pluginRoom = {
            remoteParticipants: {
                values: () =>
                    [...subscriptions.values()].map((s) => ({
                        dataTracks: new Map(
                            (s.connection?.remoteDataTracks() ?? []).map(
                                (t) => [t.info.sid, t],
                            ),
                        ),
                    })),
            },
        };
        this.speakerTimer = setInterval(
            () => void this.pollSpeakers(),
            SPEAKER_POLL_MS,
        );
    }

    setListener(listener: CallTransportListener): void {
        this.opts.listener = listener;
    }

    private get listener(): CallTransportListener {
        return this.opts.listener ?? NOOP_LISTENER;
    }

    get publishing(): boolean {
        return this.opts.local !== null;
    }

    /** The call's joined members (not us), and which we receive over the mesh. */
    setMembers(members: MeshMember[]): void {
        if (this.closed) return;
        this.members.clear();
        for (const m of members) this.members.set(m.memberId, m);
        for (const memberId of this.direct)
            if (!this.members.has(memberId)) this.direct.delete(memberId);
        // Publishers MUST stop sending to members that left.
        for (const [memberId, connection] of this.publishers) {
            const m = this.members.get(memberId);
            if (m && samePeer(m, connection.peer)) continue;
            connection.close("left", true);
        }
        for (const [memberId, w] of this.waiting) {
            const m = this.members.get(memberId);
            if (!m) continue;
            clearTimeout(w.timer);
            this.waiting.delete(memberId);
            void this.accept(w.peer, w.connectionId);
        }
        for (const [memberId, sub] of this.subscriptions) {
            const m = this.members.get(memberId);
            if (m?.subscribe && samePeer(m, sub.peer)) continue;
            this.unsubscribe(memberId, "unsubscribed");
        }
        for (const m of members)
            if (m.subscribe && !this.subscriptions.has(m.memberId))
                this.subscribe(m);
        this.listener.changed();
    }

    // ── Receiving ───────────────────────────────────────────────────────

    private subscribe(peer: MeshPeer): void {
        const sub: Subscription = {
            peer: { ...peer },
            connection: null,
            attempts: 0,
            startedAt: 0,
        };
        this.subscriptions.set(peer.memberId, sub);
        void this.connectSubscription(sub);
    }

    private async connectSubscription(sub: Subscription): Promise<void> {
        const rtcConfig = await this.opts
            .rtcConfig(this.direct.has(sub.peer.memberId))
            .catch(() => null);
        if (this.closed || this.subscriptions.get(sub.peer.memberId) !== sub)
            return;
        if (!rtcConfig) {
            this.scheduleRetry(sub);
            return;
        }
        const listener = this.listener;
        const identity = meshIdentity(sub.peer);
        const relayed = rtcConfig.iceTransportPolicy === "relay";
        sub.startedAt = Date.now();
        const connection: SubscriberConnection = new SubscriberConnection(
            {
                peer: sub.peer,
                connectionId: newConnectionId(),
                signalling: this.signalling,
                rtcConfig,
                onEnded: (failed) => {
                    if (sub.connection !== connection) return;
                    sub.connection = null;
                    listener.changed();
                    if (Date.now() - sub.startedAt > STABLE_MS)
                        sub.attempts = 0;
                    const deadRoute = failed && !connection.everConnected;
                    void (
                        deadRoute && relayed
                            ? this.fallBackToDirect(sub.peer.memberId)
                            : Promise.resolve(false)
                    ).then((fellBack) => {
                        if (this.subscriptions.get(sub.peer.memberId) !== sub)
                            return;
                        if (fellBack) {
                            // Straight on to the direct attempt.
                            sub.attempts = 0;
                        } else if (deadRoute && !sub.reported) {
                            // Never came up: no route between us (once per
                            // member).
                            sub.reported = true;
                            listener.connectionFailed?.(identity);
                        }
                        // A publisher that closed on us (left, stopped
                        // publishing) is retried too while its membership
                        // says it publishes.
                        this.scheduleRetry(sub, failed);
                    });
                },
            },
            {
                changed: () => listener.changed(),
                audioAdded: (r) =>
                    listener.audioSubscribed(
                        r.track,
                        sourceOf(
                            connection.metadataOf(r.mid)?.purpose,
                            "audio",
                        ),
                        identity,
                    ),
                audioRemoved: (r) => listener.audioUnsubscribed(r.track),
                videoAdded: (r) => {
                    const view = this.trackView(connection, r.mid);
                    if (view) listener.videoSubscribed(view, identity);
                },
                data: (payload, topic) =>
                    listener.data(payload, identity, topic),
                dataTrackOpened: (t: MeshRemoteDataTrack) =>
                    listener.dataTrackPublished(this.pluginRoom, t),
                dataTrackClosed: (sid) => listener.dataTrackUnpublished(sid),
                playbackBlockedChanged: () => listener.changed(),
            },
        );
        sub.connection = connection;
    }

    private scheduleRetry(sub: Subscription, failed = true): void {
        clearTimeout(sub.retryTimer);
        const delay = failed
            ? Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** sub.attempts)
            : RETRY_MAX_MS;
        sub.attempts++;
        sub.retryTimer = setTimeout(() => {
            if (
                this.closed ||
                this.subscriptions.get(sub.peer.memberId) !== sub
            )
                return;
            void this.connectSubscription(sub);
        }, delay);
    }

    /**
     * After a relayed connection to `memberId` never came up: connect to
     * them directly from now on, if the user allows that (no required
     * relay). False when nothing would change.
     */
    private async fallBackToDirect(memberId: string): Promise<boolean> {
        if (this.direct.has(memberId)) return false;
        const config = await this.opts.rtcConfig(true).catch(() => null);
        if (this.closed || !config || config.iceTransportPolicy === "relay")
            return false;
        console.info(
            `[full-mesh] relayed connection with ${memberId} failed; connecting directly`,
        );
        this.direct.add(memberId);
        return true;
    }

    private unsubscribe(memberId: string, reason: string): void {
        const sub = this.subscriptions.get(memberId);
        if (!sub) return;
        this.subscriptions.delete(memberId);
        clearTimeout(sub.retryTimer);
        sub.connection?.close(reason, true);
        this.lastLoud.delete(meshIdentity(sub.peer));
    }

    // ── Publishing ──────────────────────────────────────────────────────

    private async accept(peer: MeshPeer, connectionId: string): Promise<void> {
        const local = this.opts.local;
        if (!local) return;
        const rtcConfig = await this.opts
            .rtcConfig(this.direct.has(peer.memberId))
            .catch(() => null);
        if (this.closed) return;
        const member = this.members.get(peer.memberId);
        if (!rtcConfig || !member || !samePeer(member, peer)) {
            this.signalling.send(peer, connectionId, {
                type: "close",
                reason: rtcConfig ? "not_a_member" : "no_ice_servers",
            });
            return;
        }
        // One connection per member pair: the new one replaces the old.
        this.publishers.get(peer.memberId)?.close("replaced", false);
        const connection: PublisherConnection = new PublisherConnection(
            {
                peer: { ...peer },
                connectionId,
                signalling: this.signalling,
                rtcConfig,
                // The subscriber retries; a publisher doesn't, but answers
                // the retry directly if the relay never came up.
                onEnded: (failed) => {
                    if (this.publishers.get(peer.memberId) === connection)
                        this.publishers.delete(peer.memberId);
                    if (
                        failed &&
                        !connection.everConnected &&
                        rtcConfig.iceTransportPolicy === "relay"
                    )
                        void this.fallBackToDirect(peer.memberId);
                },
            },
            local,
            this.localDataTracks,
        );
        this.publishers.set(peer.memberId, connection);
    }

    private onSignalling(
        peer: MeshPeer,
        connectionId: string,
        payload: Parameters<Signalling["send"]>[2],
    ): void {
        if (this.closed) return;
        if (payload.type === "subscribe") {
            if (!this.opts.local) {
                this.signalling.send(peer, connectionId, {
                    type: "close",
                    reason: "not_publishing",
                });
                return;
            }
            const member = this.members.get(peer.memberId);
            if (member) {
                void this.accept(peer, connectionId);
                return;
            }
            // The request may overtake the subscriber's membership.
            const old = this.waiting.get(peer.memberId);
            if (old) clearTimeout(old.timer);
            this.waiting.set(peer.memberId, {
                peer,
                connectionId,
                timer: setTimeout(() => {
                    if (
                        this.waiting.get(peer.memberId)?.connectionId !==
                        connectionId
                    )
                        return;
                    this.waiting.delete(peer.memberId);
                    this.signalling.send(peer, connectionId, {
                        type: "close",
                        reason: "not_a_member",
                    });
                }, SUBSCRIBE_GRACE_MS),
            });
            return;
        }
        // A connection's messages must come from the device it was set up with.
        const sub = this.subscriptions.get(peer.memberId);
        if (
            sub?.connection?.connectionId === connectionId &&
            samePeer(sub.peer, peer)
        ) {
            sub.connection.receive(payload);
            return;
        }
        const pub = this.publishers.get(peer.memberId);
        if (pub?.connectionId === connectionId && samePeer(pub.peer, peer))
            pub.receive(payload);
        // Anything else belongs to a replaced or closed connection.
    }

    // ── CallTransport ───────────────────────────────────────────────────

    private trackView(
        connection: SubscriberConnection,
        mid: string,
    ): RemoteTrackView | null {
        const received = connection.tracks().find((t) => t.mid === mid);
        const meta = connection.metadataOf(mid);
        // Tracks without metadata, or of a purpose we don't know, are ignored.
        if (!received || !meta) return null;
        const source = sourceOf(meta.purpose, received.kind);
        if (source === "unknown") return null;
        return {
            kind: received.kind,
            source,
            muted: meta.muted ?? false,
            track: received.track,
            paused: !connection.inUse(mid),
            setEnabled: (enabled) => connection.setInUse(mid, enabled),
        };
    }

    participants(): RemoteParticipantView[] {
        const out: RemoteParticipantView[] = [];
        for (const sub of this.subscriptions.values()) {
            const connection = sub.connection;
            if (!connection || connection.pc.connectionState !== "connected")
                continue;
            const tracks: RemoteTrackView[] = [];
            for (const r of connection.tracks()) {
                const view = this.trackView(connection, r.mid);
                if (view) tracks.push(view);
            }
            out.push({ identity: meshIdentity(sub.peer), tracks });
        }
        return out;
    }

    get playbackBlocked(): boolean {
        return [...this.subscriptions.values()].some(
            (s) => s.connection?.playbackBlocked,
        );
    }

    async startAudio(): Promise<void> {
        await Promise.all(
            [...this.subscriptions.values()].map((s) =>
                s.connection?.startAudio(),
            ),
        );
    }

    // ── Speaking indicators ─────────────────────────────────────────────

    private async pollSpeakers(): Promise<void> {
        if (this.closed) return;
        const now = Date.now();
        for (const sub of this.subscriptions.values()) {
            const connection = sub.connection;
            if (!connection) continue;
            for (const r of connection.tracks()) {
                if (r.kind !== "audio") continue;
                if (
                    sourceOf(connection.metadataOf(r.mid)?.purpose, "audio") !==
                    "microphone"
                )
                    continue;
                const [source] = r.receiver.getSynchronizationSources();
                if (
                    source &&
                    (source.audioLevel ?? 0) > SPEAKING_LEVEL &&
                    now - source.timestamp < 1_000
                )
                    this.lastLoud.set(meshIdentity(sub.peer), now);
            }
        }
        if (this.localSpeaking())
            this.lastLoud.set(meshIdentity(this.opts.own), now);
        const speaking = [...this.lastLoud]
            .filter(([, at]) => now - at < SPEAKING_HOLD_MS)
            .map(([identity]) => identity)
            .sort();
        if (speaking.join("\n") === this.speaking.join("\n")) return;
        this.speaking = speaking;
        this.listener.speakers(speaking);
    }

    /** Our own mic's level, when the mesh is what we publish on (an SFU
     *  reports ours otherwise). */
    private localSpeaking(): boolean {
        const mic = this.opts.local
            ?.publications()
            .find((p) => p.kind === "audio" && p.purpose === "m.usermedia");
        if (!mic?.track || mic.muted) return false;
        if (this.localLevel?.track !== mic.track) {
            void this.localLevel?.ctx.close().catch(() => {});
            this.localLevel = null;
            try {
                const ctx = new AudioContext();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                ctx.createMediaStreamSource(
                    new MediaStream([mic.track]),
                ).connect(analyser);
                this.localLevel = { ctx, analyser, track: mic.track };
            } catch {
                return false;
            }
        }
        const samples = new Float32Array(this.localLevel.analyser.fftSize);
        this.localLevel.analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        return Math.sqrt(sum / samples.length) > SPEAKING_LEVEL;
    }

    // ── CallDataPublisher ───────────────────────────────────────────────

    subscriberIdentities(): string[] {
        return [...this.publishers.values()].map((p) => meshIdentity(p.peer));
    }

    async publishData(
        payload: Uint8Array,
        opts: PublishDataOptions,
    ): Promise<void> {
        const only = opts.destinationIdentities
            ? new Set(opts.destinationIdentities)
            : null;
        for (const p of this.publishers.values())
            if (!only || only.has(meshIdentity(p.peer)))
                p.sendData(payload, opts.topic, opts.reliable);
    }

    /**
     * Reliable data to one member, waiting while a lot is already queued, so
     * a sender that sends faster than the link carries doesn't fill the
     * channel's buffer (which makes the browser throw). Rejects when there is
     * no open connection to them.
     */
    async sendDataTo(
        identity: string,
        payload: Uint8Array,
        topic: string,
    ): Promise<void> {
        const find = () =>
            [...this.publishers.values()].find(
                (p) => meshIdentity(p.peer) === identity,
            );
        const connection = find();
        if (!connection) throw new Error("link down");
        while (connection.dataBuffered() > SEND_BUFFER_MAX) {
            await new Promise((r) => setTimeout(r, SEND_BUFFER_POLL_MS));
            if (this.closed || find() !== connection)
                throw new Error("link down");
        }
        if (!connection.sendData(payload, topic, true))
            throw new Error("link down");
    }

    async publishDataTrack(name: string): Promise<PluginLocalTrackLike> {
        if (this.localDataTracks.has(name))
            throw new Error(`Data track ${name} is already published`);
        this.localDataTracks.add(name);
        for (const p of this.publishers.values()) p.addDataTrack(name);
        return {
            tryPush: async ({ payload, userTimestamp }) => {
                if (!this.localDataTracks.has(name))
                    throw new Error("Data track is unpublished");
                const frame = encodeDataTrackFrame(payload, userTimestamp);
                for (const p of this.publishers.values())
                    p.pushDataTrack(name, frame);
            },
            unpublish: async () => {
                if (!this.localDataTracks.delete(name)) return;
                for (const p of this.publishers.values())
                    p.removeDataTrack(name);
            },
        };
    }

    /** Debug panel: every connection and its state. */
    debugConnections(): {
        role: "subscriber" | "publisher";
        identity: string;
        state: string;
        pc: RTCPeerConnection;
    }[] {
        const out: ReturnType<FullMeshTransport["debugConnections"]> = [];
        for (const s of this.subscriptions.values())
            if (s.connection)
                out.push({
                    role: "subscriber",
                    identity: meshIdentity(s.peer),
                    state: s.connection.pc.connectionState,
                    pc: s.connection.pc,
                });
        for (const p of this.publishers.values())
            out.push({
                role: "publisher",
                identity: meshIdentity(p.peer),
                state: p.pc.connectionState,
                pc: p.pc,
            });
        return out;
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        clearInterval(this.speakerTimer);
        for (const w of this.waiting.values()) clearTimeout(w.timer);
        this.waiting.clear();
        for (const memberId of [...this.subscriptions.keys()])
            this.unsubscribe(memberId, "left");
        for (const p of [...this.publishers.values()]) p.close("left", true);
        this.publishers.clear();
        void this.localLevel?.ctx.close().catch(() => {});
        this.localLevel = null;
        // Let the close messages reach the to-device queue first.
        setTimeout(() => this.signalling.dispose(), 5_000);
    }
}

const NOOP_LISTENER: CallTransportListener = {
    audioSubscribed() {},
    audioUnsubscribed() {},
    videoSubscribed() {},
    changed() {},
    speakers() {},
    data() {},
    dataTrackPublished() {},
    dataTrackUnpublished() {},
};

function samePeer(a: MeshPeer, b: MeshPeer): boolean {
    return (
        a.userId === b.userId &&
        a.deviceId === b.deviceId &&
        a.memberId === b.memberId
    );
}

function newConnectionId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
