import { describe, it, expect } from "vitest";
import {
    DIRECT_LOW_WATER,
    DIRECT_MAX_BUFFERED,
    isRelayCandidate,
    isValidSdp,
    parseCandidates,
    stripCandidateLines,
} from "./fileTransferDirect";

const HOST =
    "candidate:1 1 udp 2122260223 192.168.1.5 54321 typ host generation 0";
const SRFLX =
    "candidate:2 1 udp 1686052607 203.0.113.7 54322 typ srflx raddr 192.168.1.5 rport 54321";
const RELAY =
    "candidate:3 1 udp 41885439 198.51.100.9 3478 typ relay raddr 203.0.113.7 rport 54322";

describe("stripCandidateLines", () => {
    it("removes candidate and end-of-candidates lines from LF SDP", () => {
        const sdp = [
            "v=0",
            "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
            "a=candidate:1 1 udp 1 10.0.0.1 1 typ host",
            "a=end-of-candidates",
            "a=mid:0",
            "",
        ].join("\n");
        expect(stripCandidateLines(sdp)).toBe(
            [
                "v=0",
                "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
                "a=mid:0",
                "",
            ].join("\n"),
        );
    });

    it("keeps CRLF line endings on the lines that remain", () => {
        const sdp =
            "v=0\r\na=candidate:1 1 udp 1 10.0.0.1 1 typ relay\r\na=end-of-candidates\r\na=mid:0\r\n";
        const out = stripCandidateLines(sdp);
        expect(out).toBe("v=0\r\na=mid:0\r\n");
        expect(out).not.toContain("a=candidate:");
        expect(out.split("\r\n").length).toBe(3);
    });

    it("leaves an SDP without candidate lines untouched", () => {
        const sdp = "v=0\r\na=setup:actpass\r\n";
        expect(stripCandidateLines(sdp)).toBe(sdp);
    });
});

describe("isRelayCandidate", () => {
    it("is true only for the relay type", () => {
        expect(isRelayCandidate(RELAY)).toBe(true);
        expect(isRelayCandidate(HOST)).toBe(false);
        expect(isRelayCandidate(SRFLX)).toBe(false);
    });

    it("reads the token after typ, not a relay word elsewhere", () => {
        const tricky =
            "candidate:4 1 udp 1 relay.example.org 1 typ host raddr relay";
        expect(isRelayCandidate(tricky)).toBe(false);
    });

    it("is false for a candidate with no typ token", () => {
        expect(isRelayCandidate("candidate:5 1 udp 1 10.0.0.1 1")).toBe(false);
        expect(isRelayCandidate("")).toBe(false);
    });
});

describe("parseCandidates", () => {
    it("returns an empty list for non-array input", () => {
        expect(parseCandidates(undefined, false)).toEqual([]);
        expect(parseCandidates("candidate:1", false)).toEqual([]);
        expect(parseCandidates({ candidate: HOST }, false)).toEqual([]);
        expect(parseCandidates(null, false)).toEqual([]);
    });

    it("keeps a well-formed candidate with its optional fields", () => {
        const out = parseCandidates(
            [
                {
                    candidate: RELAY,
                    sdpMid: "0",
                    sdpMLineIndex: 0,
                    usernameFragment: "abcd",
                },
            ],
            false,
        );
        expect(out).toEqual([
            {
                candidate: RELAY,
                sdpMid: "0",
                sdpMLineIndex: 0,
                usernameFragment: "abcd",
            },
        ]);
    });

    it("treats null optional fields as absent, as toJSON() produces them", () => {
        const out = parseCandidates(
            [
                {
                    candidate: RELAY,
                    sdpMid: null,
                    sdpMLineIndex: null,
                    usernameFragment: null,
                },
            ],
            false,
        );
        expect(out).toEqual([{ candidate: RELAY }]);
    });

    it("drops entries that are not objects or lack a candidate string", () => {
        const out = parseCandidates(
            [
                null,
                "candidate:1",
                42,
                {},
                { candidate: 7 },
                { candidate: "" },
                { candidate: "a=candidate:1 1 udp 1 1.1.1.1 1 typ relay" },
                { candidate: RELAY },
            ],
            false,
        );
        expect(out).toEqual([{ candidate: RELAY }]);
    });

    it("drops entries with malformed optional fields", () => {
        const out = parseCandidates(
            [
                { candidate: RELAY, sdpMid: 5 },
                { candidate: RELAY, sdpMLineIndex: -1 },
                { candidate: RELAY, sdpMLineIndex: 1.5 },
                { candidate: RELAY, sdpMLineIndex: "0" },
                { candidate: RELAY, usernameFragment: [] },
                { candidate: RELAY, sdpMid: "ok" },
            ],
            false,
        );
        expect(out).toEqual([{ candidate: RELAY, sdpMid: "ok" }]);
    });

    it("drops candidates longer than 1024 characters", () => {
        const long = "candidate:" + "x".repeat(1100);
        expect(parseCandidates([{ candidate: long }], false)).toEqual([]);
        const edge = "candidate:" + "x".repeat(1024 - 10);
        expect(edge.length).toBe(1024);
        expect(parseCandidates([{ candidate: edge }], false)).toHaveLength(1);
    });

    it("considers at most 64 entries", () => {
        const many = Array.from({ length: 100 }, () => ({ candidate: RELAY }));
        expect(parseCandidates(many, false)).toHaveLength(64);
    });

    it("drops non-relay candidates when relayOnly is set", () => {
        const input = [
            { candidate: HOST },
            { candidate: SRFLX },
            { candidate: RELAY },
        ];
        expect(parseCandidates(input, true)).toEqual([{ candidate: RELAY }]);
        expect(parseCandidates(input, false)).toHaveLength(3);
    });

    it("never throws on hostile input, and keeps the good entries", () => {
        const hostile = [
            {
                get candidate() {
                    throw new Error("boom");
                },
            },
            { candidate: RELAY },
        ];
        expect(parseCandidates(hostile, true)).toEqual([{ candidate: RELAY }]);
    });
});

describe("isValidSdp", () => {
    it("accepts a session description starting with v=0", () => {
        expect(isValidSdp("v=0\r\no=- 1 2 IN IP4 0.0.0.0\r\n", "offer")).toBe(
            true,
        );
        expect(isValidSdp("v=0\n", "answer")).toBe(true);
    });

    it("rejects non-strings", () => {
        expect(isValidSdp(undefined, "offer")).toBe(false);
        expect(isValidSdp(12, "answer")).toBe(false);
        expect(isValidSdp({ sdp: "v=0" }, "offer")).toBe(false);
    });

    it("rejects an SDP that does not start with v=0", () => {
        expect(isValidSdp("o=- 1 2 IN IP4 0.0.0.0\r\n", "offer")).toBe(false);
        expect(isValidSdp("", "offer")).toBe(false);
    });

    it("rejects an SDP carrying candidate lines, CRLF or LF", () => {
        expect(
            isValidSdp(
                "v=0\r\na=candidate:1 1 udp 1 1.1.1.1 1 typ relay\r\n",
                "offer",
            ),
        ).toBe(false);
        expect(
            isValidSdp(
                "v=0\na=candidate:1 1 udp 1 1.1.1.1 1 typ relay\n",
                "answer",
            ),
        ).toBe(false);
    });

    it("rejects an SDP over 64 KiB", () => {
        const atLimit = "v=0" + "a".repeat(64 * 1024 - 3);
        expect(isValidSdp(atLimit, "offer")).toBe(true);
        expect(isValidSdp(atLimit + "a", "offer")).toBe(false);
    });
});

describe("constants", () => {
    it("sets the flow-control thresholds", () => {
        expect(DIRECT_MAX_BUFFERED).toBe(4 * 1024 * 1024);
        expect(DIRECT_LOW_WATER).toBe(1024 * 1024);
        expect(DIRECT_LOW_WATER).toBeLessThan(DIRECT_MAX_BUFFERED);
    });
});
