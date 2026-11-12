// Wire formats for the MSC4575 full mesh transport and for the data channels
// our clients add on top of it. Pure: no DOM objects, no SDK, no LiveKit.
// Everything here comes from the network and is untrusted, so the parsers
// take `unknown` and return null rather than throwing; a bad peer must not
// be able to break a call.

// Unstable identifiers. The MSC is not merged, so these keep its namespace
// until it is; changing one is a wire break with every other client.
export const FULL_MESH_TRANSPORT_TYPE = "org.matrix.msc4575.full_mesh";
export const SIGNALLING_TYPES: {
    subscribe: string;
    description: string;
    candidates: string;
    close: string;
} = {
    subscribe: "org.matrix.msc4575.rtc.full_mesh.subscribe",
    description: "org.matrix.msc4575.rtc.full_mesh.description",
    candidates: "org.matrix.msc4575.rtc.full_mesh.candidates",
    close: "org.matrix.msc4575.rtc.full_mesh.close",
};
export const CONTROL_CHANNEL_LABEL = "org.matrix.msc4575.rtc.full_mesh.control";
/** Negotiated id, fixed by the MSC so both sides can create the channel themselves. */
export const CONTROL_CHANNEL_ID = 0;

/** Our data channel protocols (Common Namespaced Identifier Grammar). */
/** Reliable and ordered: topic + binary payload. */
export const DATA_PROTOCOL = "moe.crafty.rtc.data";
/** Unordered with no retransmits, same framing; for data that goes stale. */
export const LOSSY_DATA_PROTOCOL = "moe.crafty.rtc.data.lossy";
/** One channel per plugin data track; the channel label is the track name. */
export const DATA_TRACK_PROTOCOL = "moe.crafty.rtc.data_track";
/** Element Call's text data channel, accepted so its clients interoperate. */
export const EC_DATA_PROTOCOL = "io.element.matrixrtc.topic_text";

/** Gap timeout is the MSC's RECOMMENDED 10 seconds. */
export const SEQ_GAP_TIMEOUT_MS = 10_000;
/** How long a subscribe that outruns its member event is kept. */
export const SUBSCRIBE_GRACE_MS = 10_000;
/** Candidates are batched for this long before one to-device message is sent. */
export const CANDIDATE_BATCH_MS = 200;
/** A sender we have no count for yet: how long its first messages are held
 *  for earlier ones still on their way. */
export const SEQ_START_WAIT_MS = 500;

/** Longest topic, in UTF-8 bytes. The length prefix is a u16, but a topic is a label, not data. */
export const MAX_TOPIC_BYTES = 256;

const MAX_METADATA_ENTRIES = 64;
const MAX_CANDIDATES = 100;
const MAX_SIZE = 16384;
const MAX_REASON_CHARS = 500;
/** Bounds the memory a peer can make us hold while waiting for a gap to fill. */
const SEQ_BUFFER_MAX = 256;
const DATA_TRACK_FLAG_TIMESTAMP = 1;
const U64_LIMIT = 1n << 64n;

export type MediaPurpose = "m.usermedia" | "m.screenshare";

export interface TrackMetadataEntry {
    /** A string, not only a MediaPurpose: apps may define more, and unknown ones are ignored by the receiver. */
    purpose: string;
    muted?: boolean;
}
/** Keyed by the transceiver mid. */
export type TrackMetadata = Record<string, TrackMetadataEntry>;

export interface ConsumptionMetadataEntry {
    in_use?: boolean;
    max_width?: number;
    max_height?: number;
}
/** Keyed by the transceiver mid. */
export type ConsumptionMetadata = Record<string, ConsumptionMetadataEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableKey(key: string): boolean {
    // A "__proto__" key from JSON would set the prototype of the object we build.
    return key !== "__proto__";
}

/** Validates track metadata; malformed entries are dropped rather than failing the whole object. */
export function parseTrackMetadata(value: unknown): TrackMetadata | null {
    if (!isRecord(value)) return null;
    const out: TrackMetadata = {};
    let count = 0;
    for (const [mid, raw] of Object.entries(value)) {
        if (count >= MAX_METADATA_ENTRIES) break;
        if (!isUsableKey(mid) || !isRecord(raw)) continue;
        if (typeof raw.purpose !== "string") continue;
        const entry: TrackMetadataEntry = { purpose: raw.purpose };
        if (typeof raw.muted === "boolean") entry.muted = raw.muted;
        out[mid] = entry;
        count++;
    }
    return out;
}

/** A size hint in device pixels: finite, rounded, clamped; anything else is dropped. */
function sizeHint(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const rounded = Math.round(value);
    return rounded > 0 ? Math.min(rounded, MAX_SIZE) : undefined;
}

/** Validates consumption metadata; the sizes are hints, so bad ones are dropped, not rejected. */
export function parseConsumptionMetadata(
    value: unknown,
): ConsumptionMetadata | null {
    if (!isRecord(value)) return null;
    const out: ConsumptionMetadata = {};
    let count = 0;
    for (const [mid, raw] of Object.entries(value)) {
        if (count >= MAX_METADATA_ENTRIES) break;
        if (!isUsableKey(mid) || !isRecord(raw)) continue;
        const entry: ConsumptionMetadataEntry = {};
        if (typeof raw.in_use === "boolean") entry.in_use = raw.in_use;
        const width = sizeHint(raw.max_width);
        if (width !== undefined) entry.max_width = width;
        const height = sizeHint(raw.max_height);
        if (height !== undefined) entry.max_height = height;
        out[mid] = entry;
        count++;
    }
    return out;
}

export interface SessionDescription {
    type: "offer" | "answer";
    sdp: string;
}

export type ControlMessage =
    | {
          type: "description";
          description: SessionDescription;
          track_metadata?: TrackMetadata;
      }
    | { type: "candidates"; candidates: RTCIceCandidateInit[] }
    | { type: "track_metadata"; track_metadata: TrackMetadata }
    | {
          type: "consumption_metadata";
          consumption_metadata: ConsumptionMetadata;
      };

function parseSessionDescription(value: unknown): SessionDescription | null {
    if (!isRecord(value)) return null;
    if (value.type !== "offer" && value.type !== "answer") return null;
    if (typeof value.sdp !== "string") return null;
    return { type: value.type, sdp: value.sdp };
}

/**
 * The description field shared by the control channel and to-device messages.
 * An offer must carry track metadata, because a track must never arrive
 * without the metadata that says what it is. An answer may omit it.
 */
function parseDescriptionBody(raw: Record<string, unknown>): {
    description: SessionDescription;
    track_metadata?: TrackMetadata;
} | null {
    const description = parseSessionDescription(raw.description);
    if (!description) return null;
    const metadata = parseTrackMetadata(raw.track_metadata);
    if (description.type === "offer") {
        if (!metadata) return null;
        return { description, track_metadata: metadata };
    }
    return metadata
        ? { description, track_metadata: metadata }
        : { description };
}

/** A received control-channel message (a string of JSON), or null to ignore (malformed / unknown type / non-string). */
export function parseControlMessage(data: unknown): ControlMessage | null {
    if (typeof data !== "string") return null;
    let raw: unknown;
    try {
        raw = JSON.parse(data);
    } catch {
        return null;
    }
    if (!isRecord(raw)) return null;
    switch (raw.type) {
        case "description": {
            const body = parseDescriptionBody(raw);
            return body ? { type: "description", ...body } : null;
        }
        case "candidates": {
            const candidates = parseCandidates(raw.candidates);
            return candidates ? { type: "candidates", candidates } : null;
        }
        case "track_metadata": {
            const metadata = parseTrackMetadata(raw.track_metadata);
            return metadata
                ? { type: "track_metadata", track_metadata: metadata }
                : null;
        }
        case "consumption_metadata": {
            const metadata = parseConsumptionMetadata(raw.consumption_metadata);
            return metadata
                ? {
                      type: "consumption_metadata",
                      consumption_metadata: metadata,
                  }
                : null;
        }
        default:
            // Unknown types are ignored, not rejected, so newer peers can add types.
            return null;
    }
}

export function encodeControlMessage(message: ControlMessage): string {
    return JSON.stringify(message);
}

function parseCandidate(raw: unknown): RTCIceCandidateInit | null {
    if (!isRecord(raw) || typeof raw.candidate !== "string") return null;
    const { sdpMid, sdpMLineIndex, usernameFragment } = raw;
    if (sdpMid !== undefined && sdpMid !== null && typeof sdpMid !== "string") {
        return null;
    }
    if (
        sdpMLineIndex !== undefined &&
        sdpMLineIndex !== null &&
        (typeof sdpMLineIndex !== "number" || !Number.isFinite(sdpMLineIndex))
    ) {
        return null;
    }
    if (
        usernameFragment !== undefined &&
        usernameFragment !== null &&
        typeof usernameFragment !== "string"
    ) {
        return null;
    }
    const candidate: RTCIceCandidateInit = { candidate: raw.candidate };
    if (sdpMid !== undefined) candidate.sdpMid = sdpMid;
    if (sdpMLineIndex !== undefined) candidate.sdpMLineIndex = sdpMLineIndex;
    if (usernameFragment !== undefined) {
        candidate.usernameFragment = usernameFragment;
    }
    return candidate;
}

/**
 * Keeps the valid candidates and drops the rest. An empty `candidate` string
 * is kept: it is the end-of-candidates marker.
 */
export function parseCandidates(value: unknown): RTCIceCandidateInit[] | null {
    if (!Array.isArray(value)) return null;
    const out: RTCIceCandidateInit[] = [];
    for (const raw of value) {
        if (out.length >= MAX_CANDIDATES) break;
        const candidate = parseCandidate(raw);
        if (candidate) out.push(candidate);
    }
    return out;
}

/** What every to-device message carries (snake_case on the wire). */
export interface SignallingCommon {
    room_id: string;
    slot_id: string;
    member_id: string;
    claimed_device_id: string;
    target_member_id: string;
    connection_id: string;
    seq: number;
}

export type SignallingPayload =
    | { type: "subscribe" }
    | {
          type: "description";
          description: SessionDescription;
          track_metadata?: TrackMetadata;
      }
    | { type: "candidates"; candidates: RTCIceCandidateInit[] }
    | { type: "close"; reason?: string };

/** Builds the to-device event type and content for a payload. */
export function buildSignalling(
    common: SignallingCommon,
    payload: SignallingPayload,
): { eventType: string; content: Record<string, unknown> } {
    const content: Record<string, unknown> = {
        room_id: common.room_id,
        slot_id: common.slot_id,
        member_id: common.member_id,
        claimed_device_id: common.claimed_device_id,
        target_member_id: common.target_member_id,
        connection_id: common.connection_id,
        seq: common.seq,
    };
    switch (payload.type) {
        case "subscribe":
            return { eventType: SIGNALLING_TYPES.subscribe, content };
        case "description":
            content.description = {
                type: payload.description.type,
                sdp: payload.description.sdp,
            };
            if (payload.track_metadata !== undefined) {
                content.track_metadata = payload.track_metadata;
            }
            return { eventType: SIGNALLING_TYPES.description, content };
        case "candidates":
            content.candidates = payload.candidates;
            return { eventType: SIGNALLING_TYPES.candidates, content };
        case "close":
            if (payload.reason !== undefined) content.reason = payload.reason;
            return { eventType: SIGNALLING_TYPES.close, content };
    }
}

export interface ParsedSignalling {
    common: SignallingCommon;
    payload: SignallingPayload;
}

function parseCommon(
    content: Record<string, unknown>,
): SignallingCommon | null {
    const {
        room_id,
        slot_id,
        member_id,
        claimed_device_id,
        target_member_id,
        connection_id,
        seq,
    } = content;
    if (
        typeof room_id !== "string" ||
        typeof slot_id !== "string" ||
        typeof member_id !== "string" ||
        typeof claimed_device_id !== "string" ||
        typeof target_member_id !== "string" ||
        typeof connection_id !== "string"
    ) {
        return null;
    }
    // A seq above 2^53 cannot be ordered exactly, so it counts as malformed.
    if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) {
        return null;
    }
    return {
        room_id,
        slot_id,
        member_id,
        claimed_device_id,
        target_member_id,
        connection_id,
        seq,
    };
}

/** Parses a received to-device message of any of the four types; null if the type is not one of ours or any common field is missing/wrong-typed (seq must be a non-negative safe integer), or the payload is invalid (description needs type offer|answer and string sdp; an OFFER without valid track_metadata object is invalid — the MSC makes it required on offers; candidates must parse; reason kept only if string, truncated to 500 chars). */
export function parseSignalling(
    eventType: string,
    content: Record<string, unknown>,
): ParsedSignalling | null {
    if (!isRecord(content)) return null;
    const common = parseCommon(content);
    if (!common) return null;
    switch (eventType) {
        case SIGNALLING_TYPES.subscribe:
            return { common, payload: { type: "subscribe" } };
        case SIGNALLING_TYPES.description: {
            const body = parseDescriptionBody(content);
            return body
                ? { common, payload: { type: "description", ...body } }
                : null;
        }
        case SIGNALLING_TYPES.candidates: {
            const candidates = parseCandidates(content.candidates);
            return candidates
                ? { common, payload: { type: "candidates", candidates } }
                : null;
        }
        case SIGNALLING_TYPES.close: {
            // The reason is for humans and logs; it is capped so it cannot be used to bloat memory.
            if (typeof content.reason !== "string") {
                return { common, payload: { type: "close" } };
            }
            const reason = Array.from(content.reason)
                .slice(0, MAX_REASON_CHARS)
                .join("");
            return { common, payload: { type: "close", reason } };
        }
        default:
            return null;
    }
}

/**
 * Delivers the items of one sender in seq order. A gap is waited on for
 * gapTimeoutMs, then skipped, so one lost message cannot stall the whole
 * connection. The timer restarts only when the head of the gap changes:
 * restarting it on every out-of-order arrival would let a steady stream
 * postpone the skip forever.
 */
export class SeqOrderer<T> {
    private next = 0;
    /** Until the first delivery: we may have joined the count midway. */
    private started = false;
    private readonly buffer = new Map<number, T>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private disposed = false;
    private readonly deliver: (item: T) => void;
    private readonly gapTimeoutMs: number;
    private readonly startWaitMs: number | null;

    /**
     * `startWaitMs`: the sender may have counted for a while before we
     * started listening (we reloaded, they didn't). Then the first items
     * are only held this long, for anything sent before them that is still
     * on its way, and the count starts at the lowest seen. Null expects the
     * count to start at 0.
     */
    constructor(
        deliver: (item: T) => void,
        gapTimeoutMs: number = SEQ_GAP_TIMEOUT_MS,
        startWaitMs: number | null = null,
    ) {
        this.deliver = deliver;
        this.gapTimeoutMs = gapTimeoutMs;
        this.startWaitMs = startWaitMs;
    }

    push(seq: number, item: T): void {
        if (this.disposed || seq < this.next) return;
        if (seq === this.next) {
            this.started = true;
            this.next++;
            this.deliver(item);
            this.drain();
            this.arm();
            return;
        }
        if (this.buffer.has(seq) || this.buffer.size >= SEQ_BUFFER_MAX) return;
        const wasEmpty = this.buffer.size === 0;
        this.buffer.set(seq, item);
        if (wasEmpty) this.arm();
    }

    /** Whether the count has moved past 0: a seq 0 now is a restart. */
    get advanced(): boolean {
        return this.next > 0;
    }

    dispose(): void {
        this.disposed = true;
        this.clearTimer();
        this.buffer.clear();
    }

    private drain(): void {
        while (this.buffer.has(this.next)) {
            const item = this.buffer.get(this.next) as T;
            this.buffer.delete(this.next);
            this.next++;
            this.deliver(item);
        }
    }

    private skipGap(): void {
        this.timer = undefined;
        if (this.disposed || this.buffer.size === 0) return;
        this.next = Math.min(...this.buffer.keys());
        this.started = true;
        this.drain();
        this.arm();
    }

    /** Points the timer at the current head of the gap, or stops it if nothing waits. */
    private arm(): void {
        this.clearTimer();
        if (this.buffer.size === 0) return;
        const wait =
            !this.started && this.startWaitMs !== null
                ? this.startWaitMs
                : this.gapTimeoutMs;
        this.timer = setTimeout(() => this.skipGap(), wait);
    }

    private clearTimer(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}

/** Views any binary input as bytes without copying it. */
function asBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
    return ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
}

function encodeTopic(topic: string | undefined): Uint8Array {
    if (!topic) return new Uint8Array(0);
    const bytes = new TextEncoder().encode(topic);
    if (bytes.byteLength > MAX_TOPIC_BYTES) {
        throw new RangeError(
            `topic is ${bytes.byteLength} bytes, the limit is ${MAX_TOPIC_BYTES}`,
        );
    }
    return bytes;
}

/**
 * Data channel framing (DATA_PROTOCOL and LOSSY_DATA_PROTOCOL): one binary
 * message = [u16 big-endian topic byte length][topic utf-8][payload].
 * An empty topic is encoded as length 0, the same as no topic.
 */
export function encodeDataMessage(
    payload: Uint8Array,
    topic?: string,
): Uint8Array<ArrayBuffer> {
    const topicBytes = encodeTopic(topic);
    const out = new Uint8Array(2 + topicBytes.byteLength + payload.byteLength);
    new DataView(out.buffer).setUint16(0, topicBytes.byteLength, false);
    out.set(topicBytes, 2);
    out.set(payload, 2 + topicBytes.byteLength);
    return out;
}

/** null if too short / topic length overruns. Topic "" decodes as undefined. */
export function decodeDataMessage(
    data: ArrayBuffer | Uint8Array,
): { topic?: string; payload: Uint8Array } | null {
    const bytes = asBytes(data);
    if (bytes.byteLength < 2) return null;
    const topicLength = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
    ).getUint16(0, false);
    if (topicLength > MAX_TOPIC_BYTES) return null;
    if (2 + topicLength > bytes.byteLength) return null;
    let topic: string | undefined;
    if (topicLength > 0) {
        try {
            // Fatal, so an invalid UTF-8 topic is rejected instead of silently mangled.
            topic = new TextDecoder("utf-8", { fatal: true }).decode(
                bytes.subarray(2, 2 + topicLength),
            );
        } catch {
            return null;
        }
    }
    // A copy, because the caller may reuse the buffer the message arrived in.
    const payload = bytes.slice(2 + topicLength);
    return topic === undefined ? { payload } : { topic, payload };
}

/** Element Call's channel: a JSON string {topic: string, text: string}; returns payload = UTF-8 bytes of text. null if malformed. */
export function decodeEcDataMessage(
    data: unknown,
): { topic: string; payload: Uint8Array } | null {
    if (typeof data !== "string") return null;
    let raw: unknown;
    try {
        raw = JSON.parse(data);
    } catch {
        return null;
    }
    if (!isRecord(raw)) return null;
    if (typeof raw.topic !== "string" || typeof raw.text !== "string") {
        return null;
    }
    return {
        topic: raw.topic,
        payload: new TextEncoder().encode(raw.text),
    };
}

/**
 * Data track frames (DATA_TRACK_PROTOCOL): [u8 flags][if flags&1: 8-byte
 * big-endian u64 user timestamp][payload]. Unknown flag bits are ignored so
 * the format can grow without breaking older clients.
 */
export function encodeDataTrackFrame(
    payload: Uint8Array,
    userTimestamp?: bigint,
): Uint8Array<ArrayBuffer> {
    const hasTimestamp = userTimestamp !== undefined;
    if (hasTimestamp && (userTimestamp < 0n || userTimestamp >= U64_LIMIT)) {
        throw new RangeError(
            "userTimestamp does not fit in an unsigned 64-bit integer",
        );
    }
    const headerLength = hasTimestamp ? 9 : 1;
    const out = new Uint8Array(headerLength + payload.byteLength);
    const view = new DataView(out.buffer);
    view.setUint8(0, hasTimestamp ? DATA_TRACK_FLAG_TIMESTAMP : 0);
    if (hasTimestamp) view.setBigUint64(1, userTimestamp, false);
    out.set(payload, headerLength);
    return out;
}

export function decodeDataTrackFrame(
    data: ArrayBuffer | Uint8Array,
): { payload: Uint8Array; userTimestamp?: bigint } | null {
    const bytes = asBytes(data);
    if (bytes.byteLength < 1) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const flags = view.getUint8(0);
    if ((flags & DATA_TRACK_FLAG_TIMESTAMP) === 0) {
        return { payload: bytes.slice(1) };
    }
    if (bytes.byteLength < 9) return null;
    return {
        payload: bytes.slice(9),
        userTimestamp: view.getBigUint64(1, false),
    };
}
