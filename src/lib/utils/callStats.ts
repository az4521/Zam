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
    /**
     * The SFU offered candidates but no UDP one. LiveKit's server does this
     * after it decides UDP failed for this client (ICE failed, or dropped
     * soon after connecting, while signalling stayed up): it switches the
     * client to TCP, strips its UDP candidates, and remembers that per room
     * and identity, so rejoining starts on TCP too. Tells a server-made
     * switch apart from a network that blocks UDP, where the server still
     * offers UDP and the client just can't reach it.
     */
    serverOfferedNoUdp: boolean;
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
    // Only what the server offered: a peer-reflexive candidate is learned
    // from the far end's connectivity checks, and Chromium lists UDP ones
    // even when every UDP candidate was stripped from the offer.
    const remoteProtocols = stats
        .filter(
            (s) =>
                s.type === "remote-candidate" &&
                candidateType(s.candidateType) !== "prflx",
        )
        .map((s) => str(s.protocol)?.toLowerCase());
    // Only on positive evidence: a candidate without a protocol says nothing.
    const serverOfferedNoUdp =
        remoteProtocols.includes("tcp") && !remoteProtocols.includes("udp");
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
        serverOfferedNoUdp,
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

/** What a sent or received track carries (LiveKit's Track.Source). */
export type StreamSource =
    "microphone" | "camera" | "screen_share" | "screen_share_audio" | "unknown";

/** Whose track an RTP stream belongs to, keyed by MediaStreamTrack id. */
export interface StreamOwner {
    source: StreamSource;
    /** Remote participant identity; null for our own tracks. */
    identity: string | null;
}

export interface StreamCodec {
    /** e.g. "audio/opus", "video/VP9". */
    mimeType: string;
    clockRate: number | null;
    channels: number | null;
    /** The SDP fmtp line: Opus FEC/DTX/stereo, H.264 profile, VP9 profile. */
    fmtp: string | null;
}

/**
 * One RTP stream (a sent `outbound-rtp` or received `inbound-rtp`) with its
 * codec and what the debug panel shows for it. Video fields are null for
 * audio and vice versa.
 */
export interface RtpStreamSummary {
    id: string;
    direction: "send" | "receive";
    kind: "audio" | "video";
    source: StreamSource;
    identity: string | null;
    codec: StreamCodec | null;
    /** Simulcast layer ("f"/"h"/"q"), when the stream is one. */
    rid: string | null;
    active: boolean | null;
    /** Payload plus RTP headers, for the rate. */
    bytes: number;
    packets: number;
    /** Over the interval since the previous summary, kbit/s. */
    kbps: number | null;
    /** What the encoder aims for (send only), kbit/s. */
    targetKbps: number | null;
    /** Media per packet over the interval, ms: Opus's frame size. */
    packetMs: number | null;
    packetsLost: number | null;
    jitterMs: number | null;
    width: number | null;
    height: number | null;
    fps: number | null;
    /** e.g. "libvpx", "ExternalEncoder", "VaapiVideoEncoder", "OpenH264". */
    implementation: string | null;
    /** True when a hardware encoder/decoder is doing the work. */
    hardware: boolean | null;
    /** Why the encoder holds back quality: "cpu", "bandwidth", "none". */
    qualityLimitation: string | null;
    scalabilityMode: string | null;
    /** Average time per encoded (send) or decoded (receive) frame, ms. */
    frameTimeMs: number | null;
    framesDropped: number | null;
    nackCount: number | null;
    pliCount: number | null;
    keyFrames: number | null;
    /** Retransmitted share of the bytes sent over the interval, 0..1. */
    retransmitShare: number | null;
    /** Raw counters, kept for the next interval. */
    retransmittedBytes: number;
    frames: number;
    framesTotalTime: number;
    at: number;
}

/**
 * Fold every RTP stream in one transport's report. `owners` maps track ids
 * to their source (a sent stream names its track through its media-source
 * stat, a received one directly); `prev` is the previous result for the
 * same transport, for interval rates.
 */
export function summarizeRtpStreams(
    stats: readonly RawStat[],
    at: number,
    owners: Readonly<Record<string, StreamOwner>> = {},
    prev: readonly RtpStreamSummary[] = [],
): RtpStreamSummary[] {
    const byId = new Map(stats.map((s) => [s.id, s]));
    const prevById = new Map(prev.map((p) => [p.id, p]));
    const out: RtpStreamSummary[] = [];
    for (const s of stats) {
        const send = s.type === "outbound-rtp";
        if (!send && s.type !== "inbound-rtp") continue;
        const kind = s.kind ?? s.mediaType;
        if (kind !== "audio" && kind !== "video") continue;

        const codecStat = byId.get(str(s.codecId) ?? "");
        const codec: StreamCodec | null = codecStat
            ? {
                  mimeType: str(codecStat.mimeType) ?? "?",
                  clockRate: num(codecStat.clockRate),
                  channels: num(codecStat.channels),
                  fmtp: str(codecStat.sdpFmtpLine) || null,
              }
            : null;

        const trackId = send
            ? str(byId.get(str(s.mediaSourceId) ?? "")?.trackIdentifier)
            : str(s.trackIdentifier);
        const owner = trackId ? owners[trackId] : undefined;

        const bytes =
            (num(send ? s.bytesSent : s.bytesReceived) ?? 0) +
            (num(send ? s.headerBytesSent : s.headerBytesReceived) ?? 0);
        const packets = num(send ? s.packetsSent : s.packetsReceived) ?? 0;
        const retransmittedBytes = num(s.retransmittedBytesSent) ?? 0;
        const frames = num(send ? s.framesEncoded : s.framesDecoded) ?? 0;
        const framesTotalTime =
            num(send ? s.totalEncodeTime : s.totalDecodeTime) ?? 0;

        const p = prevById.get(s.id);
        const dtMs = p ? at - p.at : null;
        let packetMs: number | null = null;
        if (kind === "audio" && p && dtMs && dtMs > 0) {
            const dp = packets - p.packets;
            // With DTX, Opus sends almost nothing in silence: too few
            // packets to read a frame size off.
            if (dp >= 5) packetMs = dtMs / dp;
        }
        let retransmitShare: number | null = null;
        if (send && p) {
            const db = bytes - p.bytes;
            const dr = retransmittedBytes - p.retransmittedBytes;
            if (db > 0 && dr >= 0) retransmitShare = dr / db;
        }
        let frameTimeMs: number | null = null;
        if (p ? frames > p.frames : frames > 0) {
            const df = frames - (p?.frames ?? 0);
            const dt = framesTotalTime - (p?.framesTotalTime ?? 0);
            frameTimeMs = (dt / df) * 1000;
        }

        const powerEfficient = send
            ? s.powerEfficientEncoder
            : s.powerEfficientDecoder;
        const target = num(s.targetBitrate);
        const jitter = num(s.jitter);

        out.push({
            id: s.id,
            direction: send ? "send" : "receive",
            kind,
            source: streamSource(owner?.source),
            identity: owner?.identity ?? null,
            codec,
            rid: str(s.rid),
            active: typeof s.active === "boolean" ? s.active : null,
            bytes,
            packets,
            kbps: rateKbps(bytes, p?.bytes, dtMs),
            targetKbps: target !== null ? target / 1000 : null,
            packetMs,
            packetsLost: send ? null : num(s.packetsLost),
            jitterMs: jitter !== null ? jitter * 1000 : null,
            width: num(s.frameWidth),
            height: num(s.frameHeight),
            fps: num(s.framesPerSecond),
            implementation: str(
                send ? s.encoderImplementation : s.decoderImplementation,
            ),
            hardware:
                typeof powerEfficient === "boolean" ? powerEfficient : null,
            qualityLimitation: str(s.qualityLimitationReason),
            scalabilityMode: str(s.scalabilityMode),
            frameTimeMs,
            framesDropped: num(s.framesDropped),
            nackCount: num(s.nackCount),
            pliCount: num(s.pliCount),
            keyFrames: num(send ? s.keyFramesEncoded : s.keyFramesDecoded),
            retransmitShare,
            retransmittedBytes,
            frames,
            framesTotalTime,
            at,
        });
    }
    return out;
}

function streamSource(v: unknown): StreamSource {
    return v === "microphone" ||
        v === "camera" ||
        v === "screen_share" ||
        v === "screen_share_audio"
        ? v
        : "unknown";
}

/** "opus 48 kHz stereo", "VP9 profile-id=2", "H264 42e01f". */
export function codecLabel(c: StreamCodec | null): string {
    if (!c) return "-";
    const name = c.mimeType.split("/")[1] ?? c.mimeType;
    const parts = [name];
    if (c.mimeType.toLowerCase().startsWith("audio/")) {
        if (c.clockRate) parts.push(`${c.clockRate / 1000} kHz`);
        // Opus always signals 2 channels in SDP; stereo=1 is the real flag.
        const stereo = /(^|;)\s*stereo=1/.test(c.fmtp ?? "");
        parts.push(stereo ? "stereo" : "mono");
    } else if (c.fmtp) {
        const profile =
            /profile-level-id=([0-9a-f]+)/i.exec(c.fmtp)?.[1] ??
            /profile-id=\d+/.exec(c.fmtp)?.[0] ??
            /profile=\d+/.exec(c.fmtp)?.[0];
        if (profile) parts.push(profile);
    }
    return parts.join(" ");
}

/** The Opus features an fmtp line turns on, for display: FEC, DTX, CBR. */
export function opusFeatures(fmtp: string | null): string[] {
    if (!fmtp) return [];
    const on = (k: string) => new RegExp(`(^|;)\\s*${k}=1`).test(fmtp);
    const out: string[] = [];
    if (on("useinbandfec")) out.push("FEC");
    if (on("usedtx")) out.push("DTX");
    if (on("cbr")) out.push("CBR");
    const ptime = /(^|;)\s*minptime=(\d+)/.exec(fmtp)?.[2];
    if (ptime) out.push(`minptime ${ptime} ms`);
    const max = /(^|;)\s*maxaveragebitrate=(\d+)/.exec(fmtp)?.[2];
    if (max) out.push(`max ${Math.round(Number(max) / 1000)} kbit/s`);
    return out;
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
