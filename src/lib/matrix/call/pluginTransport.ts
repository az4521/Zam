/**
 * Plugin call transports (zam.call.registerTransport): a plugin carries call
 * media over its own network (I2P, Tor, ...) beside the SFU and the full
 * mesh. Zam keeps capture, playback, the call screen, mutes and speaking
 * indicators; the plugin moves the media.
 *
 * The model is the full mesh's (MSC4575): every member publishes on one
 * transport, the first of its membership's `transports`. A member who
 * publishes on a plugin transport names it there with this descriptor:
 *
 *   { type: "moe.crafty.zam.plugin_transport", plugin: "<plugin id>",
 *     transport: "<factory id>", device_id: "<device>", data: {...} }
 *
 * and is received through the same plugin by every member whose client has
 * it. Signalling between copies of a plugin is Olm-encrypted to-device,
 * scoped to the call (room, slot) and the transport.
 *
 * livekitCall.ts owns the call and creates the instances; the registry and
 * the instance live here. No LiveKit import.
 */
import { ClientEvent, type MatrixClient } from "matrix-js-sdk";
import type { ReceivedToDevice } from "../keyBackfill";
import type { PluginRoomLike } from "../callPluginData";
import type {
    Disposable,
    PluginCallPeer,
    PluginCallSource,
    PluginCallTransport,
    PluginCallTransportFactory,
    PluginLocalPublication,
    PluginRemoteTrackHandle,
} from "$lib/plugins/types";
import type {
    CallSource,
    CallTransport,
    CallTransportListener,
    PublishDataOptions,
    RemoteParticipantView,
    RemoteTrackView,
} from "./transport";
import type { MeshLocalMedia } from "./fullMesh/connection";
import { MeshRemoteTrack } from "./fullMesh/remoteTrack";

export const PLUGIN_TRANSPORT_TYPE = "moe.crafty.zam.plugin_transport";
export const PLUGIN_SIGNAL_TYPE = "moe.crafty.zam.plugin_transport.signal";
/** Largest `data` a membership carries, as JSON. */
export const MAX_DESCRIPTOR_DATA_BYTES = 2048;
/** Largest signalling message content, as JSON. */
export const MAX_SIGNAL_BYTES = 32 * 1024;

const FACTORY_ID = /^[A-Za-z0-9._-]{1,64}$/;
const SOURCES: readonly PluginCallSource[] = [
    "microphone",
    "camera",
    "screen_share",
    "screen_share_audio",
];

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---- Registry -------------------------------------------------------------

export interface RegisteredTransport {
    /** `${pluginId}/${factory.id}` */
    readonly key: string;
    readonly pluginId: string;
    readonly factory: PluginCallTransportFactory;
}

const registered = new Map<string, RegisteredTransport>();
const changeCbs = new Set<() => void>();

export function pluginTransportKey(pluginId: string, id: string): string {
    return `${pluginId}/${id}`;
}

/** Why a factory can't be registered, or null. */
export function pluginTransportProblem(
    factory: PluginCallTransportFactory,
): string | null {
    if (!isRecord(factory)) return "the transport must be an object";
    if (typeof factory.id !== "string" || !FACTORY_ID.test(factory.id))
        return "id must be 1-64 letters, digits, '.', '_' or '-'";
    if (typeof factory.label !== "string" || !factory.label.trim())
        return "label must be a non-empty string";
    if (
        !isRecord(factory.privacy) ||
        typeof factory.privacy.exposesIp !== "boolean" ||
        !(
            factory.privacy.thirdParty === null ||
            typeof factory.privacy.thirdParty === "string"
        )
    )
        return "privacy must be { exposesIp: boolean, thirdParty: string | null }";
    if (typeof factory.create !== "function")
        return "create must be a function";
    return null;
}

export function registerPluginCallTransport(
    pluginId: string,
    factory: PluginCallTransportFactory,
): () => void {
    const problem = pluginTransportProblem(factory);
    if (problem) throw new TypeError(`registerTransport: ${problem}`);
    const key = pluginTransportKey(pluginId, factory.id);
    if (registered.has(key))
        throw new Error(`registerTransport: "${factory.id}" is registered`);
    const entry: RegisteredTransport = { key, pluginId, factory };
    registered.set(key, entry);
    fireChange();
    return () => {
        if (registered.get(key) !== entry) return;
        registered.delete(key);
        fireChange();
    };
}

export function registeredPluginTransports(): RegisteredTransport[] {
    return [...registered.values()];
}

/** The registered transports changed (livekitCall re-syncs the call). */
export function onPluginTransportsChange(cb: () => void): () => void {
    changeCbs.add(cb);
    return () => void changeCbs.delete(cb);
}

function fireChange(): void {
    for (const cb of [...changeCbs])
        try {
            cb();
        } catch (e) {
            console.error("[plugin-transport] change handler threw", e);
        }
}

// ---- Membership descriptors (pure) ---------------------------------------

export interface PluginTransportDescriptor {
    type: typeof PLUGIN_TRANSPORT_TYPE;
    plugin: string;
    transport: string;
    device_id: string;
    data?: Record<string, unknown>;
}

/** Our membership's transport when we publish on a plugin transport.
 *  `data` too big or not JSON is dropped. */
export function ownPluginTransport(
    pluginId: string,
    factoryId: string,
    deviceId: string,
    data: unknown,
): PluginTransportDescriptor {
    const out: PluginTransportDescriptor = {
        type: PLUGIN_TRANSPORT_TYPE,
        plugin: pluginId,
        transport: factoryId,
        device_id: deviceId,
    };
    if (isRecord(data))
        try {
            const json = JSON.stringify(data);
            if (
                new TextEncoder().encode(json).byteLength <=
                MAX_DESCRIPTOR_DATA_BYTES
            )
                out.data = JSON.parse(json) as Record<string, unknown>;
            else console.warn("[plugin-transport] describe() data too big");
        } catch {
            console.warn("[plugin-transport] describe() data isn't JSON");
        }
    return out;
}

/** The registry key of the plugin transport a member publishes on
 *  (`picked`, see memberPublishTransport), with its data; null when it
 *  publishes on something else. Like the mesh, a descriptor naming another
 *  device than the member's is ignored. */
export function pickedPluginTransport(
    picked: unknown,
    deviceId: string,
): { key: string; data: Record<string, unknown> | null } | null {
    if (
        !isRecord(picked) ||
        picked.type !== PLUGIN_TRANSPORT_TYPE ||
        typeof picked.plugin !== "string" ||
        typeof picked.transport !== "string" ||
        picked.device_id !== deviceId
    )
        return null;
    return {
        key: pluginTransportKey(picked.plugin, picked.transport),
        data: isRecord(picked.data) ? picked.data : null,
    };
}

export function isPluginTransport(t: unknown): boolean {
    return isRecord(t) && t.type === PLUGIN_TRANSPORT_TYPE;
}

/** Our publications as a plugin transport sees them. */
export function pluginPublications(
    local: MeshLocalMedia | null,
): PluginLocalPublication[] {
    if (!local) return [];
    return local.publications().map((p) => ({
        id: p.id,
        kind: p.kind,
        source:
            p.purpose === "m.screenshare"
                ? p.kind === "audio"
                    ? "screen_share_audio"
                    : "screen_share"
                : p.kind === "audio"
                  ? "microphone"
                  : "camera",
        track: p.track,
        muted: p.muted,
    }));
}

// ---- Call data frames (pure) ----------------------------------------------

/** Frame version. Bump it when the layout changes. */
const DATA_FRAME_VERSION = 1;
/** Largest topic, in UTF-8 bytes. */
export const MAX_DATA_TOPIC_BYTES = 1024;
const DATA_FRAME_HEADER_BYTES = 3;

/** Frames call data for a plugin transport's `sendData`:
 *  [version = 1][topic byte length, u16 BE][topic UTF-8][payload]. */
export function encodePluginTransportData(
    topic: string,
    payload: Uint8Array,
): Uint8Array {
    const topicBytes = new TextEncoder().encode(topic);
    if (topicBytes.byteLength > MAX_DATA_TOPIC_BYTES)
        throw new RangeError(
            `topic is over ${MAX_DATA_TOPIC_BYTES} bytes (${topicBytes.byteLength})`,
        );
    const out = new Uint8Array(
        DATA_FRAME_HEADER_BYTES + topicBytes.byteLength + payload.byteLength,
    );
    out[0] = DATA_FRAME_VERSION;
    out[1] = topicBytes.byteLength >> 8;
    out[2] = topicBytes.byteLength & 0xff;
    out.set(topicBytes, DATA_FRAME_HEADER_BYTES);
    out.set(payload, DATA_FRAME_HEADER_BYTES + topicBytes.byteLength);
    return out;
}

/** The inverse of encodePluginTransportData, or null for a frame that is
 *  truncated, of another version, or has a bad topic. */
export function decodePluginTransportData(
    frame: unknown,
): { topic: string; payload: Uint8Array } | null {
    if (!(frame instanceof Uint8Array)) return null;
    if (frame.byteLength < DATA_FRAME_HEADER_BYTES) return null;
    if (frame[0] !== DATA_FRAME_VERSION) return null;
    const topicLength = (frame[1] << 8) | frame[2];
    if (topicLength > MAX_DATA_TOPIC_BYTES) return null;
    const payloadStart = DATA_FRAME_HEADER_BYTES + topicLength;
    if (frame.byteLength < payloadStart) return null;
    let topic: string;
    try {
        topic = new TextDecoder("utf-8", { fatal: true }).decode(
            frame.subarray(DATA_FRAME_HEADER_BYTES, payloadStart),
        );
    } catch {
        return null;
    }
    return { topic, payload: frame.slice(payloadStart) };
}

// ---- One call's instance ---------------------------------------------------

export interface PluginTransportMember {
    userId: string;
    deviceId: string;
    memberId: string;
    /** They publish on this transport (with their descriptor's data). */
    publishes: boolean;
    data: Record<string, unknown> | null;
}

interface RemoteEntry {
    identity: string;
    source: PluginCallSource;
    track: MeshRemoteTrack;
    muted: boolean;
    enabled: boolean;
    enabledCbs: Set<(enabled: boolean) => void>;
    view: RemoteTrackView;
}

const NO_DATA_TRACKS: PluginRoomLike = {
    remoteParticipants: { values: () => [] },
};

/**
 * One plugin transport in one call, as a CallTransport. The plugin's own
 * instance is made lazily by `start`, after the user agreed.
 */
export class PluginTransportInstance implements CallTransport {
    readonly kind = "plugin" as const;
    /** Plugin data tracks go through LiveKit or the mesh, not here. */
    readonly pluginRoom = NO_DATA_TRACKS;
    private plugin: PluginCallTransport | null = null;
    private readonly remotes = new Map<string, RemoteEntry>();
    private readonly signalHandlers = new Set<
        (
            from: { userId: string; deviceId: string; identity: string },
            content: Record<string, unknown>,
        ) => void
    >();
    private readonly localCbs = new Set<() => void>();
    private unlistenLocal: (() => void) | null = null;
    private closed = false;
    private members: PluginTransportMember[] = [];

    constructor(
        readonly entry: RegisteredTransport,
        private readonly opts: {
            client: MatrixClient;
            roomId: string;
            slotId: string;
            own: { userId: string; deviceId: string; memberId: string };
            /** Our media, when we publish on this transport. */
            local: MeshLocalMedia | null;
            listener: CallTransportListener;
        },
    ) {
        opts.client.on(
            ClientEvent.ReceivedToDeviceMessage as never,
            this.onToDevice as never,
        );
        if (opts.local)
            this.unlistenLocal = opts.local.onChange(() => {
                for (const cb of [...this.localCbs])
                    try {
                        cb();
                    } catch (e) {
                        this.report("local.onChange handler", e);
                    }
            });
    }

    get publishing(): boolean {
        return !!this.opts.local;
    }

    get started(): boolean {
        return !!this.plugin;
    }

    /** The plugin's instance is up and it can send call data. */
    get carriesData(): boolean {
        return (
            !this.closed &&
            !!this.plugin &&
            typeof this.plugin.sendData === "function"
        );
    }

    /** Sends call data (a topic and payload) over the plugin, to
     *  `destinationIdentities` or everyone it reaches. */
    async publishData(
        payload: Uint8Array,
        opts: PublishDataOptions,
    ): Promise<void> {
        if (this.closed) throw new Error("the call is over");
        const plugin = this.plugin;
        if (!plugin || typeof plugin.sendData !== "function")
            throw new Error("this transport can't carry call data");
        const frame = encodePluginTransportData(opts.topic ?? "", payload);
        await plugin.sendData(opts.destinationIdentities ?? null, frame, {
            reliable: opts.reliable,
        });
    }

    /** Members our data reaches over this transport right now. */
    subscriberIdentities(): string[] {
        if (this.closed || !this.plugin) return [];
        try {
            const reached = this.plugin.reachable?.() ?? [];
            const known = new Set(this.members.map((m) => m.memberId));
            return [...reached].filter((id) => known.has(id));
        } catch (e) {
            this.report("reachable", e);
            return [];
        }
    }

    /** Make the plugin's instance. Throws what the plugin threw. */
    start(): void {
        if (this.plugin || this.closed) return;
        const { roomId, slotId, own } = this.opts;
        this.plugin = this.entry.factory.create({
            roomId,
            slotId,
            own: {
                userId: own.userId,
                deviceId: own.deviceId,
                identity: own.memberId,
            },
            publishing: this.publishing,
            local: {
                publications: () => pluginPublications(this.opts.local),
                onChange: (cb) => this.addTo(this.localCbs, cb),
            },
            remote: {
                addTrack: (identity, o) => this.addTrack(identity, o),
                setSpeakers: (ids) => {
                    if (this.closed) return;
                    const known = new Set(this.members.map((m) => m.memberId));
                    this.opts.listener.speakers(
                        [...ids].filter((id) => known.has(id)),
                    );
                },
                deliverData: (identity, frame) =>
                    this.deliverData(identity, frame),
            },
            signalling: {
                send: (peer, content) => this.sendSignal(peer, content),
                onMessage: (handler) =>
                    this.addTo(this.signalHandlers, handler),
            },
        });
        this.pushMembers();
    }

    setMembers(members: PluginTransportMember[]): void {
        this.members = members;
        // Tracks of someone who left go with them.
        const present = new Set(members.map((m) => m.memberId));
        for (const [key, r] of this.remotes)
            if (!present.has(r.identity)) this.endTrack(key);
        this.pushMembers();
    }

    private pushMembers(): void {
        if (!this.plugin || this.closed) return;
        const peers: PluginCallPeer[] = this.members.map((m) => ({
            identity: m.memberId,
            userId: m.userId,
            deviceId: m.deviceId,
            publishes: m.publishes,
            data: m.data,
        }));
        try {
            this.plugin.setMembers(peers);
        } catch (e) {
            this.report("setMembers", e);
        }
    }

    /** A frame a peer's sendData produced: handed to the call's listener
     *  exactly like LiveKit or mesh data. */
    private deliverData(identity: string, frame: Uint8Array): void {
        if (this.closed) return;
        if (!this.members.some((m) => m.memberId === identity)) return;
        const decoded = decodePluginTransportData(frame);
        if (!decoded) return;
        try {
            this.opts.listener.data(
                decoded.payload,
                identity,
                decoded.topic || undefined,
            );
        } catch (e) {
            this.report("data listener", e);
        }
    }

    private addTrack(
        identity: string,
        o: { source: PluginCallSource; track: MediaStreamTrack },
    ): PluginRemoteTrackHandle {
        if (this.closed) throw new Error("the call is over");
        if (!SOURCES.includes(o.source))
            throw new TypeError(`unknown source "${String(o.source)}"`);
        if (
            typeof MediaStreamTrack !== "undefined" &&
            !(o.track instanceof MediaStreamTrack)
        )
            throw new TypeError("track must be a MediaStreamTrack");
        const member = this.members.find((m) => m.memberId === identity);
        if (!member) throw new Error(`${identity} isn't in the call`);
        const kind = o.track.kind === "video" ? "video" : "audio";
        if (
            (kind === "audio") !==
            (o.source === "microphone" || o.source === "screen_share_audio")
        )
            throw new TypeError(`a ${kind} track can't be ${o.source}`);
        const key = `${identity}\n${o.source}`;
        if (this.remotes.has(key)) this.endTrack(key);
        const listener = this.opts.listener;
        const track = new MeshRemoteTrack(o.track, () => listener.changed());
        const entry: RemoteEntry = {
            identity,
            source: o.source,
            track,
            muted: false,
            enabled: true,
            enabledCbs: new Set(),
            view: null as unknown as RemoteTrackView,
        };
        const setEnabled = (enabled: boolean) => {
            if (kind === "audio" || entry.enabled === enabled) return;
            entry.enabled = enabled;
            for (const cb of [...entry.enabledCbs])
                try {
                    cb(enabled);
                } catch (e) {
                    this.report("onEnabledChange handler", e);
                }
            listener.changed();
        };
        entry.view = {
            kind,
            source: o.source as CallSource,
            get muted() {
                return entry.muted;
            },
            get track() {
                return entry.enabled ? entry.track : null;
            },
            paused: false,
            setEnabled,
        };
        this.remotes.set(key, entry);
        if (kind === "audio")
            listener.audioSubscribed(track, o.source as CallSource, identity);
        else listener.videoSubscribed(entry.view, identity);
        listener.changed();
        const self = this;
        return {
            get enabled() {
                return entry.enabled;
            },
            onEnabledChange: (cb) => self.addTo(entry.enabledCbs, cb),
            setMuted(muted: boolean) {
                if (self.remotes.get(key) !== entry || entry.muted === muted)
                    return;
                entry.muted = !!muted;
                listener.changed();
            },
            end() {
                if (self.remotes.get(key) === entry) self.endTrack(key);
            },
        };
    }

    private endTrack(key: string): void {
        const r = this.remotes.get(key);
        if (!r) return;
        this.remotes.delete(key);
        if (r.view.kind === "audio")
            this.opts.listener.audioUnsubscribed(r.track);
        r.track.detachAll();
        r.enabledCbs.clear();
        this.opts.listener.changed();
    }

    participants(): RemoteParticipantView[] {
        const by = new Map<string, RemoteTrackView[]>();
        for (const r of this.remotes.values()) {
            const list = by.get(r.identity) ?? [];
            list.push(r.view);
            by.set(r.identity, list);
        }
        return [...by].map(([identity, tracks]) => ({ identity, tracks }));
    }

    get playbackBlocked(): boolean {
        return [...this.remotes.values()].some((r) => r.track.playbackBlocked);
    }

    async startAudio(): Promise<void> {
        await Promise.all(
            [...this.remotes.values()].map((r) => r.track.resume()),
        );
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        this.opts.client.off(
            ClientEvent.ReceivedToDeviceMessage as never,
            this.onToDevice as never,
        );
        this.unlistenLocal?.();
        for (const key of [...this.remotes.keys()]) this.endTrack(key);
        this.signalHandlers.clear();
        this.localCbs.clear();
        const plugin = this.plugin;
        this.plugin = null;
        try {
            await plugin?.close();
        } catch (e) {
            this.report("close", e);
        }
    }

    // ---- Signalling ----

    private async sendSignal(
        peer: { userId: string; deviceId: string },
        content: Record<string, unknown>,
    ): Promise<void> {
        if (this.closed) throw new Error("the call is over");
        if (!isRecord(content))
            throw new TypeError("content must be an object");
        const member = this.members.find(
            (m) => m.userId === peer?.userId && m.deviceId === peer?.deviceId,
        );
        if (!member) throw new Error("that device isn't in the call");
        const json = JSON.stringify(content);
        if (new TextEncoder().encode(json).byteLength > MAX_SIGNAL_BYTES)
            throw new RangeError(`content is over ${MAX_SIGNAL_BYTES} bytes`);
        const { client, roomId, slotId, own } = this.opts;
        const crypto = client.getCrypto();
        if (!crypto) throw new Error("encryption is not running");
        const batch = await crypto.encryptToDeviceMessages(
            PLUGIN_SIGNAL_TYPE,
            [{ userId: member.userId, deviceId: member.deviceId }],
            {
                room_id: roomId,
                slot_id: slotId,
                plugin: this.entry.pluginId,
                transport: this.entry.factory.id,
                member_id: own.memberId,
                claimed_device_id: own.deviceId,
                target_member_id: member.memberId,
                data: JSON.parse(json) as unknown,
            },
        );
        if (batch.batch.length === 0)
            throw new Error(`no Olm session with ${member.deviceId}`);
        await client.queueToDevice(batch);
    }

    private readonly onToDevice = (received: ReceivedToDevice): void => {
        if (this.closed || received.message.type !== PLUGIN_SIGNAL_TYPE) return;
        const info = received.encryptionInfo;
        if (!info) return;
        const c = received.message.content;
        if (
            c.room_id !== this.opts.roomId ||
            c.slot_id !== this.opts.slotId ||
            c.plugin !== this.entry.pluginId ||
            c.transport !== this.entry.factory.id ||
            c.target_member_id !== this.opts.own.memberId ||
            typeof c.claimed_device_id !== "string" ||
            !isRecord(c.data)
        )
            return;
        if (info.senderDevice && info.senderDevice !== c.claimed_device_id)
            return;
        const member = this.members.find(
            (m) =>
                m.userId === info.sender && m.deviceId === c.claimed_device_id,
        );
        if (!member) return;
        const from = {
            userId: member.userId,
            deviceId: member.deviceId,
            identity: member.memberId,
        };
        for (const h of [...this.signalHandlers])
            try {
                h(from, c.data);
            } catch (e) {
                this.report("signalling handler", e);
            }
    };

    private addTo<T>(set: Set<T>, item: T): Disposable {
        set.add(item);
        return { dispose: () => void set.delete(item) };
    }

    private report(what: string, err: unknown): void {
        console.error(
            `[plugin ${this.entry.pluginId}] transport "${this.entry.factory.id}" ${what} threw`,
            err,
        );
    }
}
