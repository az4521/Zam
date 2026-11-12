import { describe, it, expect, vi } from "vitest";
import {
    CONTROL_CHANNEL_ID,
    MAX_TOPIC_BYTES,
    SIGNALLING_TYPES,
    SeqOrderer,
    buildSignalling,
    decodeDataMessage,
    decodeDataTrackFrame,
    decodeEcDataMessage,
    encodeControlMessage,
    encodeDataMessage,
    encodeDataTrackFrame,
    parseCandidates,
    parseConsumptionMetadata,
    parseControlMessage,
    parseSignalling,
    parseTrackMetadata,
    type SignallingCommon,
} from "./protocol";

const enc = (s: string) => new TextEncoder().encode(s);

describe("constants", () => {
    it("uses the MSC identifiers and our own protocol names", () => {
        expect(SIGNALLING_TYPES.subscribe).toBe(
            "org.matrix.msc4575.rtc.full_mesh.subscribe",
        );
        expect(CONTROL_CHANNEL_ID).toBe(0);
        expect(MAX_TOPIC_BYTES).toBe(256);
    });
});

describe("parseTrackMetadata", () => {
    it("keeps purpose and a boolean muted", () => {
        expect(
            parseTrackMetadata({
                "0": { purpose: "m.usermedia" },
                "1": { purpose: "m.usermedia", muted: true },
                "2": { purpose: "m.screenshare", muted: "yes" },
            }),
        ).toEqual({
            "0": { purpose: "m.usermedia" },
            "1": { purpose: "m.usermedia", muted: true },
            "2": { purpose: "m.screenshare" },
        });
    });

    it("rejects non-objects", () => {
        expect(parseTrackMetadata(null)).toBeNull();
        expect(parseTrackMetadata([])).toBeNull();
        expect(parseTrackMetadata("x")).toBeNull();
        expect(parseTrackMetadata(3)).toBeNull();
    });

    it("drops malformed entries", () => {
        expect(
            parseTrackMetadata({
                "0": { purpose: 5 },
                "1": null,
                "2": "m.usermedia",
                "3": { purpose: "m.usermedia" },
            }),
        ).toEqual({ "3": { purpose: "m.usermedia" } });
    });

    it("does not let a __proto__ key touch the result", () => {
        const parsed = parseTrackMetadata(
            JSON.parse('{"__proto__":{"purpose":"m.usermedia"}}'),
        );
        expect(parsed).not.toBeNull();
        expect(Object.keys(parsed ?? {})).toEqual([]);
        expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    });

    it("caps at 64 entries", () => {
        const input: Record<string, { purpose: string }> = {};
        for (let i = 0; i < 100; i++)
            input[String(i)] = { purpose: "m.usermedia" };
        expect(Object.keys(parseTrackMetadata(input) ?? {})).toHaveLength(64);
    });
});

describe("parseConsumptionMetadata", () => {
    it("keeps in_use only when boolean", () => {
        expect(
            parseConsumptionMetadata({
                "1": { in_use: false },
                "2": { in_use: 0 },
            }),
        ).toEqual({ "1": { in_use: false }, "2": {} });
    });

    it("rounds and clamps sizes to 16384", () => {
        expect(
            parseConsumptionMetadata({
                "1": { max_width: 320.4, max_height: 99999.6 },
            }),
        ).toEqual({ "1": { max_width: 320, max_height: 16384 } });
    });

    it("drops sizes that are not finite positive numbers", () => {
        expect(
            parseConsumptionMetadata({
                "1": {
                    max_width: 0,
                    max_height: -5,
                },
                "2": { max_width: "320" },
                "3": { max_width: 0.2 },
                "4": { max_width: Number.NaN },
                "5": { max_width: Number.POSITIVE_INFINITY },
            }),
        ).toEqual({ "1": {}, "2": {}, "3": {}, "4": {}, "5": {} });
    });

    it("rejects non-objects and drops non-object entries", () => {
        expect(parseConsumptionMetadata(undefined)).toBeNull();
        expect(parseConsumptionMetadata([1])).toBeNull();
        expect(
            parseConsumptionMetadata({ "1": 4, "2": { in_use: true } }),
        ).toEqual({
            "2": { in_use: true },
        });
    });

    it("caps at 64 entries", () => {
        const input: Record<string, { in_use: boolean }> = {};
        for (let i = 0; i < 100; i++) input[String(i)] = { in_use: true };
        expect(Object.keys(parseConsumptionMetadata(input) ?? {})).toHaveLength(
            64,
        );
    });
});

describe("parseControlMessage", () => {
    const offer = { type: "offer", sdp: "v=0" };
    const answer = { type: "answer", sdp: "v=0" };

    it("accepts an offer that carries track metadata", () => {
        const msg = parseControlMessage(
            JSON.stringify({
                type: "description",
                description: offer,
                track_metadata: { "0": { purpose: "m.usermedia" } },
            }),
        );
        expect(msg).toEqual({
            type: "description",
            description: offer,
            track_metadata: { "0": { purpose: "m.usermedia" } },
        });
    });

    it("rejects an offer without track metadata", () => {
        expect(
            parseControlMessage(
                JSON.stringify({ type: "description", description: offer }),
            ),
        ).toBeNull();
    });

    it("accepts an answer without track metadata", () => {
        expect(
            parseControlMessage(
                JSON.stringify({ type: "description", description: answer }),
            ),
        ).toEqual({ type: "description", description: answer });
    });

    it("rejects a description with a bad type or missing sdp", () => {
        expect(
            parseControlMessage(
                JSON.stringify({
                    type: "description",
                    description: { type: "pranswer", sdp: "v=0" },
                    track_metadata: {},
                }),
            ),
        ).toBeNull();
        expect(
            parseControlMessage(
                JSON.stringify({
                    type: "description",
                    description: { type: "answer" },
                }),
            ),
        ).toBeNull();
    });

    it("parses candidates and metadata updates", () => {
        expect(
            parseControlMessage(
                JSON.stringify({
                    type: "candidates",
                    candidates: [{ candidate: "a" }],
                }),
            ),
        ).toEqual({ type: "candidates", candidates: [{ candidate: "a" }] });
        expect(
            parseControlMessage(
                JSON.stringify({
                    type: "track_metadata",
                    track_metadata: { "0": { purpose: "m.screenshare" } },
                }),
            ),
        ).toEqual({
            type: "track_metadata",
            track_metadata: { "0": { purpose: "m.screenshare" } },
        });
        expect(
            parseControlMessage(
                JSON.stringify({
                    type: "consumption_metadata",
                    consumption_metadata: { "1": { max_width: 320 } },
                }),
            ),
        ).toEqual({
            type: "consumption_metadata",
            consumption_metadata: { "1": { max_width: 320 } },
        });
    });

    it("rejects a track_metadata message whose payload is not an object", () => {
        expect(
            parseControlMessage(
                JSON.stringify({ type: "track_metadata", track_metadata: [] }),
            ),
        ).toBeNull();
    });

    it("ignores unknown types", () => {
        expect(
            parseControlMessage(JSON.stringify({ type: "future_thing", x: 1 })),
        ).toBeNull();
    });

    it("rejects non-strings, invalid JSON and non-objects", () => {
        expect(parseControlMessage(new ArrayBuffer(2))).toBeNull();
        expect(parseControlMessage(42)).toBeNull();
        expect(parseControlMessage("{not json")).toBeNull();
        expect(parseControlMessage("null")).toBeNull();
        expect(parseControlMessage("[]")).toBeNull();
    });

    it("round-trips through encodeControlMessage", () => {
        const message = {
            type: "consumption_metadata" as const,
            consumption_metadata: { "3": { in_use: false } },
        };
        expect(parseControlMessage(encodeControlMessage(message))).toEqual(
            message,
        );
    });
});

describe("parseCandidates", () => {
    it("rejects a non-array", () => {
        expect(parseCandidates({ candidate: "a" })).toBeNull();
        expect(parseCandidates(undefined)).toBeNull();
    });

    it("keeps valid candidates and drops invalid ones", () => {
        expect(
            parseCandidates([
                {
                    candidate: "a",
                    sdpMid: "0",
                    sdpMLineIndex: 0,
                    usernameFragment: "u",
                },
                { candidate: "b", sdpMid: null },
                { candidate: 5 },
                { sdpMid: "0" },
                { candidate: "c", sdpMid: 7 },
                { candidate: "d", sdpMLineIndex: "0" },
                { candidate: "e", usernameFragment: 1 },
                null,
            ]),
        ).toEqual([
            {
                candidate: "a",
                sdpMid: "0",
                sdpMLineIndex: 0,
                usernameFragment: "u",
            },
            { candidate: "b", sdpMid: null },
        ]);
    });

    it("keeps the empty end-of-candidates marker", () => {
        expect(parseCandidates([{ candidate: "" }])).toEqual([
            { candidate: "" },
        ]);
    });

    it("caps at 100 entries", () => {
        const input = Array.from({ length: 150 }, (_, i) => ({
            candidate: `c${i}`,
        }));
        expect(parseCandidates(input)).toHaveLength(100);
    });
});

const common: SignallingCommon = {
    room_id: "!room:example.org",
    slot_id: "m.call#room",
    member_id: "bob",
    claimed_device_id: "BOBDEV",
    target_member_id: "alice",
    connection_id: "conn1",
    seq: 7,
};

describe("buildSignalling / parseSignalling", () => {
    const offer = { type: "offer" as const, sdp: "v=0\r\n" };

    it("round-trips subscribe", () => {
        const built = buildSignalling(common, { type: "subscribe" });
        expect(built.eventType).toBe(SIGNALLING_TYPES.subscribe);
        expect(parseSignalling(built.eventType, built.content)).toEqual({
            common,
            payload: { type: "subscribe" },
        });
    });

    it("round-trips description with metadata", () => {
        const payload = {
            type: "description" as const,
            description: offer,
            track_metadata: { "0": { purpose: "m.usermedia" } },
        };
        const built = buildSignalling(common, payload);
        expect(built.eventType).toBe(SIGNALLING_TYPES.description);
        expect(built.content.seq).toBe(7);
        expect(parseSignalling(built.eventType, built.content)).toEqual({
            common,
            payload,
        });
    });

    it("round-trips candidates", () => {
        const payload = {
            type: "candidates" as const,
            candidates: [{ candidate: "x", sdpMid: "0", sdpMLineIndex: 0 }],
        };
        const built = buildSignalling(common, payload);
        expect(built.eventType).toBe(SIGNALLING_TYPES.candidates);
        expect(parseSignalling(built.eventType, built.content)).toEqual({
            common,
            payload,
        });
    });

    it("round-trips close with and without a reason", () => {
        const withReason = buildSignalling(common, {
            type: "close",
            reason: "left",
        });
        expect(withReason.eventType).toBe(SIGNALLING_TYPES.close);
        expect(
            parseSignalling(withReason.eventType, withReason.content),
        ).toEqual({
            common,
            payload: { type: "close", reason: "left" },
        });
        const bare = buildSignalling(common, { type: "close" });
        expect(parseSignalling(bare.eventType, bare.content)).toEqual({
            common,
            payload: { type: "close" },
        });
    });

    it("uses snake_case on the wire", () => {
        const { content } = buildSignalling(common, { type: "subscribe" });
        expect(content).toEqual({
            room_id: "!room:example.org",
            slot_id: "m.call#room",
            member_id: "bob",
            claimed_device_id: "BOBDEV",
            target_member_id: "alice",
            connection_id: "conn1",
            seq: 7,
        });
    });

    it("rejects an unknown event type", () => {
        expect(
            parseSignalling(
                "m.room.message",
                buildSignalling(common, { type: "subscribe" }).content,
            ),
        ).toBeNull();
    });

    it("rejects a missing or wrongly typed common field", () => {
        const { content } = buildSignalling(common, { type: "subscribe" });
        expect(
            parseSignalling(SIGNALLING_TYPES.subscribe, {
                ...content,
                room_id: 1,
            }),
        ).toBeNull();
        const { connection_id: _omit, ...withoutConnection } = content;
        expect(
            parseSignalling(SIGNALLING_TYPES.subscribe, withoutConnection),
        ).toBeNull();
    });

    it("rejects a bad seq", () => {
        const { content } = buildSignalling(common, { type: "subscribe" });
        for (const seq of [-1, 1.5, "3", Number.MAX_SAFE_INTEGER + 2, null]) {
            expect(
                parseSignalling(SIGNALLING_TYPES.subscribe, {
                    ...content,
                    seq,
                }),
            ).toBeNull();
        }
        expect(
            parseSignalling(SIGNALLING_TYPES.subscribe, { ...content, seq: 0 }),
        ).not.toBeNull();
    });

    it("rejects an offer without valid track metadata", () => {
        const { content } = buildSignalling(common, {
            type: "description",
            description: offer,
        });
        expect(
            parseSignalling(SIGNALLING_TYPES.description, content),
        ).toBeNull();
        expect(
            parseSignalling(SIGNALLING_TYPES.description, {
                ...content,
                track_metadata: "nope",
            }),
        ).toBeNull();
    });

    it("accepts an answer without track metadata", () => {
        const answer = { type: "answer" as const, sdp: "v=0" };
        const { content } = buildSignalling(common, {
            type: "description",
            description: answer,
        });
        expect(parseSignalling(SIGNALLING_TYPES.description, content)).toEqual({
            common,
            payload: { type: "description", description: answer },
        });
    });

    it("rejects a description with a bad sdp", () => {
        expect(
            parseSignalling(SIGNALLING_TYPES.description, {
                ...buildSignalling(common, {
                    type: "description",
                    description: offer,
                    track_metadata: {},
                }).content,
                description: { type: "offer", sdp: 3 },
            }),
        ).toBeNull();
    });

    it("rejects candidates that are not an array", () => {
        expect(
            parseSignalling(SIGNALLING_TYPES.candidates, {
                ...buildSignalling(common, {
                    type: "candidates",
                    candidates: [],
                }).content,
                candidates: "x",
            }),
        ).toBeNull();
    });

    it("keeps a reason only when it is a string, truncated to 500 characters", () => {
        const { content } = buildSignalling(common, { type: "close" });
        expect(
            parseSignalling(SIGNALLING_TYPES.close, { ...content, reason: 5 }),
        ).toEqual({ common, payload: { type: "close" } });
        const parsed = parseSignalling(SIGNALLING_TYPES.close, {
            ...content,
            reason: "x".repeat(900),
        });
        expect(parsed?.payload).toEqual({
            type: "close",
            reason: "x".repeat(500),
        });
    });
});

describe("SeqOrderer", () => {
    it("delivers in-order items immediately", () => {
        const got: number[] = [];
        const orderer = new SeqOrderer<number>((n) => got.push(n));
        orderer.push(0, 0);
        orderer.push(1, 1);
        orderer.push(2, 2);
        expect(got).toEqual([0, 1, 2]);
        orderer.dispose();
    });

    it("buffers out-of-order items until the gap is filled", () => {
        const got: string[] = [];
        const orderer = new SeqOrderer<string>((s) => got.push(s));
        orderer.push(2, "c");
        orderer.push(1, "b");
        expect(got).toEqual([]);
        orderer.push(0, "a");
        expect(got).toEqual(["a", "b", "c"]);
        orderer.dispose();
    });

    it("skips a gap after the timeout and jumps to the lowest buffered seq", () => {
        vi.useFakeTimers();
        try {
            const got: number[] = [];
            const orderer = new SeqOrderer<number>((n) => got.push(n), 1000);
            orderer.push(0, 0);
            orderer.push(2, 2);
            orderer.push(3, 3);
            vi.advanceTimersByTime(999);
            expect(got).toEqual([0]);
            vi.advanceTimersByTime(1);
            expect(got).toEqual([0, 2, 3]);
            orderer.dispose();
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not postpone the skip when more out-of-order items arrive", () => {
        vi.useFakeTimers();
        try {
            const got: number[] = [];
            const orderer = new SeqOrderer<number>((n) => got.push(n), 1000);
            orderer.push(1, 1);
            vi.advanceTimersByTime(600);
            orderer.push(3, 3);
            vi.advanceTimersByTime(400);
            expect(got).toEqual([1]);
            orderer.dispose();
        } finally {
            vi.useRealTimers();
        }
    });

    it("drops an item that arrives after its seq was passed", () => {
        vi.useFakeTimers();
        try {
            const got: number[] = [];
            const orderer = new SeqOrderer<number>((n) => got.push(n), 1000);
            orderer.push(0, 0);
            orderer.push(2, 2);
            vi.advanceTimersByTime(1000);
            orderer.push(1, 1);
            expect(got).toEqual([0, 2]);
            orderer.dispose();
        } finally {
            vi.useRealTimers();
        }
    });

    it("drops duplicates of a buffered item", () => {
        const got: string[] = [];
        const orderer = new SeqOrderer<string>((s) => got.push(s));
        orderer.push(1, "first");
        orderer.push(1, "second");
        orderer.push(0, "a");
        expect(got).toEqual(["a", "first"]);
        orderer.dispose();
    });

    it("bounds the buffer at 256 entries", () => {
        vi.useFakeTimers();
        try {
            const got: number[] = [];
            const orderer = new SeqOrderer<number>((n) => got.push(n), 1000);
            for (let seq = 1; seq <= 300; seq++) orderer.push(seq, seq);
            vi.advanceTimersByTime(1000);
            expect(got).toHaveLength(256);
            expect(got[0]).toBe(1);
            expect(got[255]).toBe(256);
            orderer.dispose();
        } finally {
            vi.useRealTimers();
        }
    });

    it("dispose clears the buffer and the timer, and ignores later pushes", () => {
        vi.useFakeTimers();
        try {
            const got: number[] = [];
            const orderer = new SeqOrderer<number>((n) => got.push(n), 1000);
            orderer.push(1, 1);
            orderer.dispose();
            vi.advanceTimersByTime(5000);
            expect(vi.getTimerCount()).toBe(0);
            orderer.push(0, 0);
            expect(got).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("data message framing", () => {
    it("round-trips with a topic and a binary payload containing zeros", () => {
        const payload = new Uint8Array([0, 1, 0, 255, 0, 0]);
        const encoded = encodeDataMessage(payload, "chat");
        const decoded = decodeDataMessage(encoded);
        expect(decoded?.topic).toBe("chat");
        expect(decoded?.payload).toEqual(payload);
    });

    it("writes a zero length prefix when there is no topic", () => {
        const payload = new Uint8Array([9, 8]);
        const encoded = encodeDataMessage(payload);
        expect(encoded.byteLength).toBe(4);
        expect(encoded[0]).toBe(0);
        expect(encoded[1]).toBe(0);
        const decoded = decodeDataMessage(encoded);
        expect(decoded?.topic).toBeUndefined();
        expect(decoded?.payload).toEqual(payload);
    });

    it("writes the topic length big-endian", () => {
        const encoded = encodeDataMessage(
            new Uint8Array(0),
            "x".repeat(258 - 2),
        );
        expect(encoded[0]).toBe(1);
        expect(encoded[1]).toBe(0);
    });

    it("counts the topic limit in UTF-8 bytes", () => {
        expect(() =>
            encodeDataMessage(new Uint8Array(0), "a".repeat(256)),
        ).not.toThrow();
        expect(() =>
            encodeDataMessage(new Uint8Array(0), "a".repeat(257)),
        ).toThrow(RangeError);
        // Three bytes per character, so 86 characters is 258 bytes.
        expect(() =>
            encodeDataMessage(new Uint8Array(0), "€".repeat(86)),
        ).toThrow(RangeError);
    });

    it("treats an empty topic like no topic", () => {
        const decoded = decodeDataMessage(
            encodeDataMessage(new Uint8Array([1]), ""),
        );
        expect(decoded?.topic).toBeUndefined();
    });

    it("rejects input that is too short or whose topic overruns", () => {
        expect(decodeDataMessage(new Uint8Array([0]))).toBeNull();
        expect(decodeDataMessage(new Uint8Array([0, 5, 65, 66]))).toBeNull();
    });

    it("rejects a topic longer than the limit", () => {
        const bytes = new Uint8Array(2 + 300);
        new DataView(bytes.buffer).setUint16(0, 300, false);
        expect(decodeDataMessage(bytes)).toBeNull();
    });

    it("rejects invalid UTF-8 in the topic", () => {
        expect(decodeDataMessage(new Uint8Array([0, 1, 0xff, 1]))).toBeNull();
    });

    it("accepts an ArrayBuffer and copies the payload out of it", () => {
        const encoded = encodeDataMessage(new Uint8Array([7, 7]), "t");
        const decoded = decodeDataMessage(encoded.buffer);
        expect(decoded?.topic).toBe("t");
        expect(decoded?.payload).toEqual(new Uint8Array([7, 7]));
        encoded[encoded.length - 1] = 0;
        expect(decoded?.payload).toEqual(new Uint8Array([7, 7]));
    });
});

describe("decodeEcDataMessage", () => {
    it("returns the topic and the UTF-8 bytes of the text", () => {
        const decoded = decodeEcDataMessage(
            JSON.stringify({ topic: "chat", text: "hé" }),
        );
        expect(decoded?.topic).toBe("chat");
        expect(decoded?.payload).toEqual(enc("hé"));
    });

    it("rejects malformed messages", () => {
        expect(decodeEcDataMessage("{")).toBeNull();
        expect(decodeEcDataMessage(JSON.stringify({ topic: "t" }))).toBeNull();
        expect(
            decodeEcDataMessage(JSON.stringify({ topic: 1, text: "x" })),
        ).toBeNull();
        expect(decodeEcDataMessage(new Uint8Array([1, 2]))).toBeNull();
        expect(decodeEcDataMessage(null)).toBeNull();
    });
});

describe("data track frames", () => {
    it("round-trips without a timestamp", () => {
        const payload = new Uint8Array([0, 0, 3]);
        const encoded = encodeDataTrackFrame(payload);
        expect(encoded.byteLength).toBe(1 + payload.byteLength);
        expect(encoded[0]).toBe(0);
        const decoded = decodeDataTrackFrame(encoded);
        expect(decoded?.payload).toEqual(payload);
        expect(decoded?.userTimestamp).toBeUndefined();
    });

    it("round-trips with a timestamp, including the largest u64", () => {
        const payload = new Uint8Array([4, 0]);
        const max = (1n << 64n) - 1n;
        for (const ts of [0n, 123456789n, max]) {
            const encoded = encodeDataTrackFrame(payload, ts);
            expect(encoded.byteLength).toBe(9 + payload.byteLength);
            expect(encoded[0]).toBe(1);
            const decoded = decodeDataTrackFrame(encoded);
            expect(decoded?.userTimestamp).toBe(ts);
            expect(decoded?.payload).toEqual(payload);
        }
    });

    it("rejects a timestamp that does not fit in u64", () => {
        expect(() => encodeDataTrackFrame(new Uint8Array(0), -1n)).toThrow(
            RangeError,
        );
        expect(() =>
            encodeDataTrackFrame(new Uint8Array(0), 1n << 64n),
        ).toThrow(RangeError);
    });

    it("rejects an empty frame and a truncated timestamp", () => {
        expect(decodeDataTrackFrame(new Uint8Array(0))).toBeNull();
        expect(decodeDataTrackFrame(new Uint8Array([1, 0, 0, 0]))).toBeNull();
    });

    it("ignores unknown flag bits", () => {
        const decoded = decodeDataTrackFrame(new Uint8Array([0x02, 5]));
        expect(decoded?.payload).toEqual(new Uint8Array([5]));
        expect(decoded?.userTimestamp).toBeUndefined();
    });
});
