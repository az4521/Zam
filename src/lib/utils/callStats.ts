/**
 * Pure folding of WebRTC `getStats()` reports into what the call debug panel
 * shows: how the media actually travels (UDP, TCP, or through a TURN relay),
 * round-trip time, bitrate, and audio receive health. A TCP path is the one to
 * look for when a call drifts out of sync: a lost packet stalls everything
 * behind it until it is resent, where UDP just drops it and carries on.
 *
 * Inputs are the report's values as plain objects (`[...report.values()]`), so
 * this runs under test without a browser. Every field is read defensively:
 * engines differ (Firefox marks the pair `selected`, Chromium links it from the
 * `transport` stat), and a transport that has not connected yet has none.
 */

/** One entry of an RTCStatsReport. */
export interface RawStat {
    id: string;
    type: string;
    [key: string]: unknown;
}

export type CandidateType = "host" | "srflx" | "prflx" | "relay";

/**
 * How media reaches the SFU. `relay-*` means through TURN, named by the leg
 * between this device and the TURN server — the one a local network shapes.
 */
export type CallPath =
    "udp" | "tcp" | "relay-udp" | "relay-tcp" | "relay-tls" | "unknown";

export interface AudioInSummary {
    packetsReceived: number;
    packetsLost: number;
    /** Most recent interarrival jitter, ms. */
    jitterMs: number | null;
    /** Average time a sample waited in the jitter buffer, ms. */
    jitterBufferMs: number | null;
    concealedSamples: number;
    totalSamplesReceived: number;
}

export interface TransportSummary {
    /** When the report was taken (ms, caller's clock). */
    at: number;
    /** Selected ICE pair state, e.g. "succeeded". */
    pairState: string | null;
    path: CallPath;
    localCandidateType: CandidateType | null;
    remoteCandidateType: CandidateType | null;
    /** remote address:port of the selected pair. */
    remoteAddress: string | null;
    /** ICE (STUN consent) round trip on the selected pair, ms. */
    iceRttMs: number | null;
    /** Media round trip reported back by the far end (RTCP), ms. */
    mediaRttMs: number | null;
    /** Fraction of our outgoing audio the far end reports lost, 0..1. */
    outgoingLoss: number | null;
    bytesSent: number;
    bytesReceived: number;
    /** Rates over the interval since the previous summary, kbit/s. */
    sendKbps: number | null;
    recvKbps: number | null;
    /** The congestion controller's send budget, kbit/s. */
    availableOutgoingKbps: number | null;
    audioIn: AudioInSummary;
    /** Inbound audio packet loss over the interval, 0..1. */
    intervalAudioLoss: number | null;
}

const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function candidateType(v: unknown): CandidateType | null {
    return v === "host" || v === "srflx" || v === "prflx" || v === "relay"
        ? v
        : null;
}

/** The ICE candidate pair media is flowing over, if any. */
function selectedPair(stats: readonly RawStat[]): RawStat | null {
    const byId = new Map(stats.map((s) => [s.id, s]));
    for (const s of stats) {
        if (s.type !== "transport") continue;
        const id = str(s.selectedCandidatePairId);
        const pair = id ? byId.get(id) : undefined;
        if (pair) return pair;
    }
    const pairs = stats.filter((s) => s.type === "candidate-pair");
    return (
        pairs.find((p) => p.selected === true) ??
        pairs.find((p) => p.nominated === true && p.state === "succeeded") ??
        null
    );
}

/** Classify the path from the local candidate of the selected pair. */
export function classifyPath(local: RawStat | null | undefined): CallPath {
    if (!local) return "unknown";
    const protocol = str(local.protocol)?.toLowerCase();
    if (candidateType(local.candidateType) === "relay") {
        const relay = str(local.relayProtocol)?.toLowerCase();
        if (relay === "udp" || relay === "tcp" || relay === "tls")
            return `relay-${relay}`;
        return "unknown";
    }
    if (protocol === "udp" || protocol === "tcp") return protocol;
    return "unknown";
}

/** Whether a path is subject to TCP head-of-line blocking. */
export function pathIsTcp(path: CallPath): boolean {
    return path === "tcp" || path === "relay-tcp" || path === "relay-tls";
}

function rateKbps(
    bytes: number,
    prevBytes: number | undefined,
    dtMs: number | null,
): number | null {
    if (prevBytes === undefined || !dtMs || dtMs <= 0) return null;
    const delta = bytes - prevBytes;
    // A counter that went backwards is a new transport (ICE restart, rejoin).
    if (delta < 0) return null;
    return (delta * 8) / dtMs;
}

/** Inbound audio receive health from one or more `inbound-rtp` stats. */
export function summarizeAudioIn(stats: readonly RawStat[]): AudioInSummary {
    const out: AudioInSummary = {
        packetsReceived: 0,
        packetsLost: 0,
        jitterMs: null,
        jitterBufferMs: null,
        concealedSamples: 0,
        totalSamplesReceived: 0,
    };
    let bufferDelay = 0;
    let bufferEmitted = 0;
    for (const s of stats) {
        if (s.type !== "inbound-rtp") continue;
        if ((s.kind ?? s.mediaType) !== "audio") continue;
        out.packetsReceived += num(s.packetsReceived) ?? 0;
        out.packetsLost += Math.max(0, num(s.packetsLost) ?? 0);
        const jitter = num(s.jitter);
        if (jitter !== null)
            out.jitterMs = Math.max(out.jitterMs ?? 0, jitter * 1000);
        bufferDelay += num(s.jitterBufferDelay) ?? 0;
        bufferEmitted += num(s.jitterBufferEmittedCount) ?? 0;
        out.concealedSamples += num(s.concealedSamples) ?? 0;
        out.totalSamplesReceived += num(s.totalSamplesReceived) ?? 0;
    }
    if (bufferEmitted > 0)
        out.jitterBufferMs = (bufferDelay / bufferEmitted) * 1000;
    return out;
}

/**
 * Fold one transport's stats report. Pass the previous summary of the SAME
 * transport to get interval rates; without it the rates are null.
 */
export function summarizeTransport(
    stats: readonly RawStat[],
    at: number,
    prev: TransportSummary | null = null,
): TransportSummary {
    const byId = new Map(stats.map((s) => [s.id, s]));
    const pair = selectedPair(stats);
    const local = pair ? byId.get(str(pair.localCandidateId) ?? "") : null;
    const remote = pair ? byId.get(str(pair.remoteCandidateId) ?? "") : null;

    let bytesSent = num(pair?.bytesSent);
    let bytesReceived = num(pair?.bytesReceived);
    // Firefox leaves pair byte counters at zero; the transport stat has them.
    for (const s of stats) {
        if (s.type !== "transport") continue;
        if (!bytesSent) bytesSent = num(s.bytesSent);
        if (!bytesReceived) bytesReceived = num(s.bytesReceived);
    }

    let mediaRttMs: number | null = null;
    let outgoingLoss: number | null = null;
    for (const s of stats) {
        if (s.type !== "remote-inbound-rtp") continue;
        const rtt = num(s.roundTripTime);
        if (rtt !== null) mediaRttMs = Math.max(mediaRttMs ?? 0, rtt * 1000);
        if ((s.kind ?? s.mediaType) === "audio") {
            const lost = num(s.fractionLost);
            if (lost !== null) outgoingLoss = Math.max(outgoingLoss ?? 0, lost);
        }
    }

    const iceRtt = num(pair?.currentRoundTripTime);
    const available = num(pair?.availableOutgoingBitrate);
    const remoteAddr = str(remote?.address) ?? str(remote?.ip);
    const remotePort = num(remote?.port);
    const audioIn = summarizeAudioIn(stats);
    const dtMs = prev ? at - prev.at : null;

    let intervalAudioLoss: number | null = null;
    if (prev) {
        const got = audioIn.packetsReceived - prev.audioIn.packetsReceived;
        const lost = audioIn.packetsLost - prev.audioIn.packetsLost;
        if (got >= 0 && lost >= 0 && got + lost > 0)
            intervalAudioLoss = lost / (got + lost);
    }

    return {
        at,
        pairState: str(pair?.state),
        path: classifyPath(local),
        localCandidateType: candidateType(local?.candidateType),
        remoteCandidateType: candidateType(remote?.candidateType),
        remoteAddress: remoteAddr
            ? remotePort !== null
                ? `${remoteAddr}:${remotePort}`
                : remoteAddr
            : null,
        iceRttMs: iceRtt !== null ? iceRtt * 1000 : null,
        mediaRttMs,
        outgoingLoss,
        bytesSent: bytesSent ?? 0,
        bytesReceived: bytesReceived ?? 0,
        sendKbps: rateKbps(bytesSent ?? 0, prev?.bytesSent, dtMs),
        recvKbps: rateKbps(bytesReceived ?? 0, prev?.bytesReceived, dtMs),
        availableOutgoingKbps: available !== null ? available / 1000 : null,
        audioIn,
        intervalAudioLoss,
    };
}

/** Coarse health for colouring a value: fine, worth a look, or bad. */
export type StatTone = "ok" | "warn" | "bad";

export function rttTone(ms: number | null): StatTone {
    if (ms === null || ms < 150) return "ok";
    return ms < 300 ? "warn" : "bad";
}

export function lossTone(fraction: number | null): StatTone {
    if (fraction === null || fraction < 0.02) return "ok";
    return fraction < 0.08 ? "warn" : "bad";
}

export function jitterTone(ms: number | null): StatTone {
    if (ms === null || ms < 30) return "ok";
    return ms < 60 ? "warn" : "bad";
}
