import { describe, expect, it } from "vitest";
import {
    classifyPath,
    pathIsTcp,
    summarizeAudioIn,
    summarizeTransport,
    rttTone,
    lossTone,
    type RawStat,
} from "./callStats";

function chromiumReport(opts: {
    protocol?: string;
    candidateType?: string;
    relayProtocol?: string;
    bytesSent?: number;
    bytesReceived?: number;
    packetsReceived?: number;
    packetsLost?: number;
}): RawStat[] {
    return [
        {
            id: "T01",
            type: "transport",
            selectedCandidatePairId: "CP1",
        },
        {
            id: "CP1",
            type: "candidate-pair",
            localCandidateId: "L1",
            remoteCandidateId: "R1",
            state: "succeeded",
            currentRoundTripTime: 0.042,
            availableOutgoingBitrate: 1_500_000,
            bytesSent: opts.bytesSent ?? 1000,
            bytesReceived: opts.bytesReceived ?? 2000,
        },
        // A losing pair that must not be picked.
        {
            id: "CP2",
            type: "candidate-pair",
            localCandidateId: "L2",
            remoteCandidateId: "R1",
            state: "failed",
            currentRoundTripTime: 9,
        },
        {
            id: "L1",
            type: "local-candidate",
            protocol: opts.protocol ?? "udp",
            candidateType: opts.candidateType ?? "srflx",
            relayProtocol: opts.relayProtocol,
        },
        { id: "L2", type: "local-candidate", protocol: "tcp" },
        {
            id: "R1",
            type: "remote-candidate",
            address: "203.0.113.5",
            port: 7882,
            candidateType: "host",
        },
        {
            id: "IA",
            type: "inbound-rtp",
            kind: "audio",
            packetsReceived: opts.packetsReceived ?? 500,
            packetsLost: opts.packetsLost ?? 5,
            jitter: 0.012,
            jitterBufferDelay: 40,
            jitterBufferEmittedCount: 1000,
            concealedSamples: 480,
            totalSamplesReceived: 48000,
        },
        {
            id: "IV",
            type: "inbound-rtp",
            kind: "video",
            packetsReceived: 9999,
            packetsLost: 999,
        },
        {
            id: "RIA",
            type: "remote-inbound-rtp",
            kind: "audio",
            roundTripTime: 0.05,
            fractionLost: 0.01,
        },
    ];
}

describe("classifyPath", () => {
    it.each([
        [{ protocol: "udp", candidateType: "host" }, "udp"],
        [{ protocol: "tcp", candidateType: "host" }, "tcp"],
        [
            { protocol: "udp", candidateType: "relay", relayProtocol: "udp" },
            "relay-udp",
        ],
        [
            { protocol: "udp", candidateType: "relay", relayProtocol: "tls" },
            "relay-tls",
        ],
        [
            { protocol: "udp", candidateType: "relay", relayProtocol: "tcp" },
            "relay-tcp",
        ],
        [{ protocol: "udp", candidateType: "relay" }, "unknown"],
    ])("%o -> %s", (fields, expected) => {
        expect(
            classifyPath({ id: "L", type: "local-candidate", ...fields }),
        ).toBe(expected);
    });

    it("is unknown with no candidate", () => {
        expect(classifyPath(null)).toBe("unknown");
    });
});

describe("pathIsTcp", () => {
    it("flags every TCP-carried path", () => {
        expect(pathIsTcp("tcp")).toBe(true);
        expect(pathIsTcp("relay-tcp")).toBe(true);
        expect(pathIsTcp("relay-tls")).toBe(true);
        expect(pathIsTcp("udp")).toBe(false);
        expect(pathIsTcp("relay-udp")).toBe(false);
        expect(pathIsTcp("unknown")).toBe(false);
    });
});

describe("summarizeTransport", () => {
    it("reads the pair the transport selected", () => {
        const s = summarizeTransport(chromiumReport({}), 1000);
        expect(s.pairState).toBe("succeeded");
        expect(s.path).toBe("udp");
        expect(s.localCandidateType).toBe("srflx");
        expect(s.remoteCandidateType).toBe("host");
        expect(s.remoteAddress).toBe("203.0.113.5:7882");
        expect(s.iceRttMs).toBeCloseTo(42);
        expect(s.mediaRttMs).toBeCloseTo(50);
        expect(s.outgoingLoss).toBeCloseTo(0.01);
        expect(s.availableOutgoingKbps).toBe(1500);
        expect(s.sendKbps).toBeNull();
        expect(s.intervalAudioLoss).toBeNull();
    });

    it("reports a TCP path", () => {
        const s = summarizeTransport(
            chromiumReport({ protocol: "tcp", candidateType: "host" }),
            0,
        );
        expect(s.path).toBe("tcp");
    });

    it("computes interval rates against the previous summary", () => {
        const a = summarizeTransport(chromiumReport({}), 1000);
        const b = summarizeTransport(
            chromiumReport({
                bytesSent: 1000 + 12_500,
                bytesReceived: 2000 + 25_000,
                packetsReceived: 590,
                packetsLost: 15,
            }),
            2000,
            a,
        );
        expect(b.sendKbps).toBeCloseTo(100);
        expect(b.recvKbps).toBeCloseTo(200);
        // 90 received + 10 lost in the interval.
        expect(b.intervalAudioLoss).toBeCloseTo(0.1);
    });

    it("drops rates when a counter goes backwards (new transport)", () => {
        const a = summarizeTransport(
            chromiumReport({ bytesSent: 50_000 }),
            1000,
        );
        const b = summarizeTransport(
            chromiumReport({ bytesSent: 10 }),
            2000,
            a,
        );
        expect(b.sendKbps).toBeNull();
    });

    it("falls back to the Firefox selected flag and transport bytes", () => {
        const s = summarizeTransport(
            [
                {
                    id: "T",
                    type: "transport",
                    bytesSent: 77,
                    bytesReceived: 88,
                },
                {
                    id: "P",
                    type: "candidate-pair",
                    selected: true,
                    state: "succeeded",
                    localCandidateId: "L",
                    remoteCandidateId: "R",
                    bytesSent: 0,
                    bytesReceived: 0,
                },
                {
                    id: "L",
                    type: "local-candidate",
                    protocol: "udp",
                    candidateType: "relay",
                    relayProtocol: "tls",
                },
                { id: "R", type: "remote-candidate", ip: "198.51.100.1" },
            ],
            0,
        );
        expect(s.path).toBe("relay-tls");
        expect(s.remoteAddress).toBe("198.51.100.1");
        expect(s.bytesSent).toBe(77);
        expect(s.bytesReceived).toBe(88);
    });

    it("is empty but well-formed before ICE connects", () => {
        const s = summarizeTransport([], 0);
        expect(s.path).toBe("unknown");
        expect(s.pairState).toBeNull();
        expect(s.iceRttMs).toBeNull();
        expect(s.bytesSent).toBe(0);
    });
});

describe("summarizeAudioIn", () => {
    it("aggregates audio only", () => {
        const a = summarizeAudioIn(chromiumReport({}));
        expect(a.packetsReceived).toBe(500);
        expect(a.packetsLost).toBe(5);
        expect(a.jitterMs).toBeCloseTo(12);
        expect(a.jitterBufferMs).toBeCloseTo(40);
        expect(a.concealedSamples).toBe(480);
    });
});

describe("tones", () => {
    it("grades rtt and loss", () => {
        expect(rttTone(null)).toBe("ok");
        expect(rttTone(80)).toBe("ok");
        expect(rttTone(200)).toBe("warn");
        expect(rttTone(400)).toBe("bad");
        expect(lossTone(0.01)).toBe("ok");
        expect(lossTone(0.05)).toBe("warn");
        expect(lossTone(0.2)).toBe("bad");
    });
});
