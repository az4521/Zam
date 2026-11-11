/**
 * Plugin access to the active voice call's LiveKit data: lossy and reliable
 * packets, and data tracks. Plugins only ever see their own namespace
 * (`zam.plugin/<pluginId>/...`), so core topics (soundboard, audio loss) can
 * be neither read nor sent through here.
 *
 * Registry and pure helpers only. livekitCall.ts owns the LiveKit rooms: it
 * binds the call with bindPluginCallHost, routes packets and data-track events
 * in here, and this module never imports it back.
 */
import type { Disposable } from "$lib/plugins/types";

export const PLUGIN_WIRE_PREFIX = "zam.plugin/";
const MAX_NAME_LENGTH = 100;
/** LiveKit's payload limits for publishData. */
export const MAX_RELIABLE_PAYLOAD = 15_000;
export const MAX_LOSSY_PAYLOAD = 1_300;

export interface PluginCallPacket {
    payload: Uint8Array;
    userId: string;
    deviceId: string | null;
    /** The topic the plugin chose, without its namespace. */
    topic: string;
}

export interface PluginDataTrackFrame {
    payload: Uint8Array;
    /** Milliseconds, from the frame's user timestamp when it has one. */
    timestamp: number | null;
}

export interface PluginLocalDataTrackHandle {
    readonly name: string;
    /** False when the frame was dropped or the track is no longer published. */
    push(payload: Uint8Array, timestamp?: number): Promise<boolean>;
    unpublish(): Promise<void>;
}

export interface PluginRemoteDataTrackHandle {
    readonly name: string;
    readonly userId: string;
    readonly deviceId: string | null;
    subscribe(onFrame: (f: PluginDataTrackFrame) => void): Disposable;
    /** Runs when the publisher unpublishes or the call ends. */
    onEnded(cb: () => void): Disposable;
}

/** The slice of a LiveKit data track this module uses. */
export interface PluginLocalTrackLike {
    tryPush(frame: {
        payload: Uint8Array;
        userTimestamp?: bigint;
    }): Promise<void>;
    unpublish(): Promise<void>;
}

interface PluginTrackFrameLike {
    payload: Uint8Array;
    userTimestamp?: bigint;
}

/** The slice of a LiveKit RemoteDataTrack this module uses. */
export interface PluginRemoteTrackLike {
    readonly info: { readonly sid: string; readonly name: string };
    readonly publisherIdentity: string;
    subscribe(options?: {
        signal?: AbortSignal;
    }): ReadableStream<PluginTrackFrameLike>;
}

/** A room whose remote participants' data tracks may already be present. */
export interface PluginRoomLike {
    readonly remoteParticipants: {
        values(): Iterable<{
            readonly dataTracks: { values(): Iterable<PluginRemoteTrackLike> };
        }>;
    };
}

/** What livekitCall.ts gives the registry for the call it is in. */
export interface PluginCallHost {
    readonly roomId: string;
    /** Identities of the remote participants in the publishing room. */
    participantIdentities(): string[];
    publishData(
        payload: Uint8Array<ArrayBuffer>,
        opts: {
            reliable: boolean;
            topic: string;
            destinationIdentities?: string[];
        },
    ): Promise<void>;
    publishDataTrack(wireName: string): Promise<PluginLocalTrackLike>;
}

type CallChangeHandler = (roomId: string | null) => void;
type PacketHandler = (p: PluginCallPacket) => void;
type TrackHandler = (t: PluginRemoteDataTrackHandle) => void;

interface LocalEntry {
    pluginId: string;
    track: PluginLocalTrackLike;
    live: boolean;
}

interface RemoteEntry {
    pluginId: string;
    sid: string;
    room: PluginRoomLike;
    track: PluginRemoteTrackLike;
    handle: PluginRemoteDataTrackHandle;
    endedCbs: Set<() => void>;
    subs: Set<AbortController>;
    ended: boolean;
}

let host: PluginCallHost | null = null;
const callChangeHandlers = new Map<string, Set<CallChangeHandler>>();
const packetHandlers = new Map<string, Map<string, Set<PacketHandler>>>();
const trackHandlers = new Map<string, Set<TrackHandler>>();
const localEntries = new Set<LocalEntry>();
/** Remote tracks by sid (sids are unique across rooms). */
const remoteEntries = new Map<string, RemoteEntry>();
/** Each room's remote sids, so a room going away ends exactly its tracks. */
const roomSids = new Map<PluginRoomLike, Set<string>>();

function isValidPluginId(pluginId: string): boolean {
    return (
        typeof pluginId === "string" &&
        pluginId.length > 0 &&
        !pluginId.includes("/")
    );
}

function assertName(label: string, value: string): void {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_NAME_LENGTH
    )
        throw new RangeError(
            `${label} must be 1-${MAX_NAME_LENGTH} characters`,
        );
}

/** The wire form of a plugin's topic or track name. */
export function pluginWireName(pluginId: string, name: string): string {
    if (!isValidPluginId(pluginId))
        throw new RangeError(`Invalid plugin id: ${JSON.stringify(pluginId)}`);
    if (name === "") throw new RangeError("Plugin wire name is empty");
    return `${PLUGIN_WIRE_PREFIX}${pluginId}/${name}`;
}

/** Inverse of pluginWireName; null for anything outside the plugin namespace. */
export function parsePluginWireName(
    wire: string,
): { pluginId: string; name: string } | null {
    if (!wire.startsWith(PLUGIN_WIRE_PREFIX)) return null;
    const rest = wire.slice(PLUGIN_WIRE_PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    const name = rest.slice(slash + 1);
    if (name === "") return null;
    return { pluginId: rest.slice(0, slash), name };
}

/** "@user:server:DEVICE" -> "@user:server". Device ids never contain ":". */
function userIdOfIdentity(identity: string): string {
    return identity.slice(0, identity.lastIndexOf(":"));
}

/** "@user:server:DEVICE" -> "DEVICE", or null without a device part. */
function deviceIdOfIdentity(identity: string): string | null {
    const colon = identity.lastIndexOf(":");
    return colon < 0 ? null : identity.slice(colon + 1);
}

/** LiveKit's user timestamp is taken as microseconds since the epoch. */
function frameTimestampMs(ts: bigint | undefined): number | null {
    return ts === undefined ? null : Number(ts) / 1000;
}

function fire<T>(handlers: Iterable<(arg: T) => void>, arg: T, what: string) {
    for (const handler of [...handlers]) {
        try {
            handler(arg);
        } catch (err) {
            console.error(`[plugin] ${what} handler failed`, err);
        }
    }
}

function fireCallChange(roomId: string | null): void {
    for (const handlers of callChangeHandlers.values())
        fire(handlers, roomId, "call change");
}

function endLocal(entry: LocalEntry): void {
    if (!entry.live) return;
    entry.live = false;
    localEntries.delete(entry);
    void entry.track.unpublish().catch(() => {});
}

function endRemote(entry: RemoteEntry): void {
    if (entry.ended) return;
    entry.ended = true;
    remoteEntries.delete(entry.sid);
    const sids = roomSids.get(entry.room);
    sids?.delete(entry.sid);
    if (sids?.size === 0) roomSids.delete(entry.room);
    for (const ac of entry.subs) ac.abort();
    entry.subs.clear();
    const ended = [...entry.endedCbs];
    entry.endedCbs.clear();
    for (const cb of ended) {
        try {
            cb();
        } catch (err) {
            console.error("[plugin] data track ended handler failed", err);
        }
    }
}

/** Drops the current call's local and remote tracks and tells nobody. */
function endCallState(): void {
    for (const entry of [...localEntries]) endLocal(entry);
    for (const entry of [...remoteEntries.values()]) endRemote(entry);
    roomSids.clear();
    host = null;
}

/**
 * The call this device is in, or null. livekitCall.ts calls it with the call
 * once its home room is connected (and with null when the call ends); a new
 * call replaces the old one, which ends its tracks first.
 */
export function bindPluginCallHost(next: PluginCallHost | null): void {
    const hadCall = host !== null;
    if (hadCall) {
        endCallState();
        fireCallChange(null);
    }
    if (next) {
        host = next;
        fireCallChange(next.roomId);
    }
}

export function getPluginCallRoomId(): string | null {
    return host?.roomId ?? null;
}

export function onPluginCallChange(
    pluginId: string,
    handler: (roomId: string | null) => void,
): () => void {
    let set = callChangeHandlers.get(pluginId);
    if (!set) {
        set = new Set();
        callChangeHandlers.set(pluginId, set);
    }
    set.add(handler);
    return () => {
        const current = callChangeHandlers.get(pluginId);
        current?.delete(handler);
        if (current?.size === 0) callChangeHandlers.delete(pluginId);
    };
}

/** Packets for this plugin's topics; core topics never reach it. */
export function handlePluginCallData(
    topic: string,
    payload: Uint8Array,
    identity: string,
): boolean {
    const parsed = parsePluginWireName(topic);
    if (!parsed) return topic.startsWith(PLUGIN_WIRE_PREFIX);
    const handlers = packetHandlers.get(parsed.pluginId)?.get(parsed.name);
    if (!handlers || handlers.size === 0) return true;
    const packet: PluginCallPacket = {
        payload,
        userId: userIdOfIdentity(identity),
        deviceId: deviceIdOfIdentity(identity),
        topic: parsed.name,
    };
    fire(handlers, packet, "call data");
    return true;
}

export function onPluginCallData(
    pluginId: string,
    topic: string,
    handler: (p: PluginCallPacket) => void,
): () => void {
    let topics = packetHandlers.get(pluginId);
    if (!topics) {
        topics = new Map();
        packetHandlers.set(pluginId, topics);
    }
    let set = topics.get(topic);
    if (!set) {
        set = new Set();
        topics.set(topic, set);
    }
    set.add(handler);
    return () => {
        const current = packetHandlers.get(pluginId)?.get(topic);
        current?.delete(handler);
        if (current?.size === 0) packetHandlers.get(pluginId)?.delete(topic);
        if (packetHandlers.get(pluginId)?.size === 0)
            packetHandlers.delete(pluginId);
    };
}

export async function sendPluginCallData(
    pluginId: string,
    topic: string,
    payload: Uint8Array,
    opts: { reliable?: boolean; to?: string[] } = {},
): Promise<void> {
    if (!isValidPluginId(pluginId)) throw new RangeError("Invalid plugin id");
    assertName("Topic", topic);
    const reliable = opts.reliable ?? true;
    const limit = reliable ? MAX_RELIABLE_PAYLOAD : MAX_LOSSY_PAYLOAD;
    if (payload.byteLength > limit)
        throw new RangeError(
            `Payload is ${payload.byteLength} bytes; the ${
                reliable ? "reliable" : "lossy"
            } limit is ${limit}`,
        );
    const h = host;
    if (!h) throw new Error("Not in a voice call");
    let destinationIdentities: string[] | undefined;
    if (opts.to) {
        const wanted = new Set(opts.to);
        destinationIdentities = h
            .participantIdentities()
            .filter((id) => wanted.has(userIdOfIdentity(id)));
        // Addressed only to people who aren't here: nothing to send.
        if (destinationIdentities.length === 0) return;
    }
    // A copy with its own buffer: LiveKit takes ArrayBuffer-backed bytes only.
    await h.publishData(new Uint8Array(payload), {
        reliable,
        topic: pluginWireName(pluginId, topic),
        destinationIdentities,
    });
}

function makeLocalHandle(
    entry: LocalEntry,
    name: string,
): PluginLocalDataTrackHandle {
    return {
        name,
        async push(payload, timestamp) {
            if (!entry.live) return false;
            try {
                await entry.track.tryPush({
                    payload,
                    userTimestamp:
                        timestamp === undefined
                            ? undefined
                            : BigInt(Math.round(timestamp * 1000)),
                });
                return true;
            } catch {
                return false;
            }
        },
        async unpublish() {
            endLocal(entry);
        },
    };
}

export async function publishPluginDataTrack(
    pluginId: string,
    name: string,
): Promise<PluginLocalDataTrackHandle> {
    if (!isValidPluginId(pluginId)) throw new RangeError("Invalid plugin id");
    assertName("Track name", name);
    const h = host;
    if (!h) throw new Error("Not in a voice call");
    const track = await h.publishDataTrack(pluginWireName(pluginId, name));
    if (host !== h) {
        // The call ended while the track was being published.
        void track.unpublish().catch(() => {});
        throw new Error(
            "The voice call ended before the data track was published",
        );
    }
    const entry: LocalEntry = { pluginId, track, live: true };
    localEntries.add(entry);
    return makeLocalHandle(entry, name);
}

/** Streams frames to `onFrame` until disposed or the track ends. */
function pumpFrames(
    track: PluginRemoteTrackLike,
    signal: AbortSignal,
    onFrame: (f: PluginDataTrackFrame) => void,
): void {
    void (async () => {
        let reader: ReadableStreamDefaultReader<PluginTrackFrameLike> | null =
            null;
        const stop = () => void reader?.cancel().catch(() => {});
        try {
            reader = track.subscribe({ signal }).getReader();
            signal.addEventListener("abort", stop, { once: true });
            while (!signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                try {
                    onFrame({
                        payload: value.payload,
                        timestamp: frameTimestampMs(value.userTimestamp),
                    });
                } catch (err) {
                    console.error("[plugin] data track handler failed", err);
                }
            }
        } catch {
            // The track ended or its stream failed: the subscription just stops.
        } finally {
            stop();
        }
    })();
}

function makeRemoteHandle(entry: RemoteEntry): PluginRemoteDataTrackHandle {
    const info = entry.track.info;
    const identity = entry.track.publisherIdentity;
    return {
        name: parsePluginWireName(info.name)?.name ?? info.name,
        userId: userIdOfIdentity(identity),
        deviceId: deviceIdOfIdentity(identity),
        subscribe(onFrame) {
            const ac = new AbortController();
            if (entry.ended) ac.abort();
            else {
                entry.subs.add(ac);
                pumpFrames(entry.track, ac.signal, onFrame);
            }
            return {
                dispose() {
                    entry.subs.delete(ac);
                    ac.abort();
                },
            };
        },
        onEnded(cb) {
            if (!entry.ended) entry.endedCbs.add(cb);
            return {
                dispose() {
                    entry.endedCbs.delete(cb);
                },
            };
        },
    };
}

export function onPluginDataTrack(
    pluginId: string,
    handler: (t: PluginRemoteDataTrackHandle) => void,
): () => void {
    let set = trackHandlers.get(pluginId);
    if (!set) {
        set = new Set();
        trackHandlers.set(pluginId, set);
    }
    set.add(handler);
    // Tracks published before this registration.
    for (const entry of [...remoteEntries.values()])
        if (entry.pluginId === pluginId)
            fire([handler], entry.handle, "data track");
    return () => {
        const current = trackHandlers.get(pluginId);
        current?.delete(handler);
        if (current?.size === 0) trackHandlers.delete(pluginId);
    };
}

/** A remote data track was published in `room`. Ignored outside a call and
 *  for core tracks; a track already known by sid is not announced twice. */
export function pluginDataTrackPublished(
    room: PluginRoomLike,
    track: PluginRemoteTrackLike,
): void {
    if (!host) return;
    const parsed = parsePluginWireName(track.info.name);
    if (!parsed) return;
    const sid = track.info.sid;
    if (remoteEntries.has(sid)) return;
    const entry: RemoteEntry = {
        pluginId: parsed.pluginId,
        sid,
        room,
        track,
        handle: null as unknown as PluginRemoteDataTrackHandle,
        endedCbs: new Set(),
        subs: new Set(),
        ended: false,
    };
    entry.handle = makeRemoteHandle(entry);
    remoteEntries.set(sid, entry);
    let sids = roomSids.get(room);
    if (!sids) {
        sids = new Set();
        roomSids.set(room, sids);
    }
    sids.add(sid);
    fire(trackHandlers.get(parsed.pluginId) ?? [], entry.handle, "data track");
}

export function pluginDataTrackUnpublished(sid: string): void {
    const entry = remoteEntries.get(sid);
    if (entry) endRemote(entry);
}

/** A room disconnected: its remote tracks end without an unpublish event. */
export function pluginDataTracksRoomGone(room: PluginRoomLike): void {
    for (const sid of [...(roomSids.get(room) ?? [])]) {
        const entry = remoteEntries.get(sid);
        if (entry) endRemote(entry);
    }
    roomSids.delete(room);
}

/** Tracks already published when a room connects (or a participant's
 *  tracks were missed). Sid dedupe makes this safe to run after the events. */
export function scanPluginDataTracks(room: PluginRoomLike): void {
    for (const p of room.remoteParticipants.values())
        for (const track of p.dataTracks.values())
            pluginDataTrackPublished(room, track);
}

/** The plugin was unloaded: drop its handlers, unpublish its local tracks,
 *  and stop its subscriptions. Its remote handles' onEnded does not run. */
export function clearPluginCallData(pluginId: string): void {
    callChangeHandlers.delete(pluginId);
    packetHandlers.delete(pluginId);
    trackHandlers.delete(pluginId);
    for (const entry of [...localEntries])
        if (entry.pluginId === pluginId) endLocal(entry);
    for (const entry of [...remoteEntries.values()]) {
        if (entry.pluginId !== pluginId) continue;
        entry.endedCbs.clear();
        endRemote(entry);
    }
}
