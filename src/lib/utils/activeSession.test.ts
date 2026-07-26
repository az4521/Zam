import { describe, it, expect } from "vitest";
import {
    ACTIVE_SESSION_KEY,
    DEFAULT_GRACE_MS,
    MAX_FUTURE_SKEW_MS,
    buildHeartbeat,
    normalizeGraceMs,
    parseActiveSession,
    shouldSuppressForActiveDevice,
    shouldWriteHeartbeat,
    type ActiveSessionHeartbeat,
} from "./activeSession";

const NOW = 1_700_000_000_000;

function hb(
    over: Partial<ActiveSessionHeartbeat> = {},
): ActiveSessionHeartbeat {
    return { deviceId: "OTHERDEV", ts: NOW - 1_000, graceMs: 60_000, ...over };
}

describe("ACTIVE_SESSION_KEY", () => {
    it("is the agreed account-data type", () => {
        expect(ACTIVE_SESSION_KEY).toBe("moe.crafty.matrix.active_session");
    });
});

describe("parseActiveSession", () => {
    it("parses a well-formed blob", () => {
        expect(
            parseActiveSession({ deviceId: "ABC", ts: 123, graceMs: 60_000 }),
        ).toEqual({ deviceId: "ABC", ts: 123, graceMs: 60_000 });
    });

    it("ignores unknown extra keys", () => {
        expect(
            parseActiveSession({
                deviceId: "ABC",
                ts: 123,
                graceMs: 0,
                junk: true,
            }),
        ).toEqual({ deviceId: "ABC", ts: 123, graceMs: 0 });
    });

    it.each([
        ["null", null],
        ["undefined", undefined],
        ["a string", "nope"],
        ["an empty object", {}],
        ["a blank deviceId", { deviceId: "", ts: 1, graceMs: 1 }],
        ["a non-string deviceId", { deviceId: 5, ts: 1, graceMs: 1 }],
        ["a non-numeric ts", { deviceId: "A", ts: "1", graceMs: 1 }],
        ["a NaN ts", { deviceId: "A", ts: NaN, graceMs: 1 }],
        ["a missing graceMs", { deviceId: "A", ts: 1 }],
        ["a negative graceMs", { deviceId: "A", ts: 1, graceMs: -1 }],
    ])("returns null for %s (fail open)", (_label, input) => {
        expect(parseActiveSession(input)).toBeNull();
    });
});

describe("shouldSuppressForActiveDevice", () => {
    it("suppresses when another device is inside the grace window", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb(),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });

    it("never suppresses on the device that wrote the heartbeat", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ deviceId: "MYDEV" }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress once the heartbeat is older than the grace window", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - 60_001 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress exactly at the grace boundary", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - 60_000 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when there is no heartbeat", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: null,
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when we do not know our own device id", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb(),
                myDeviceId: null,
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when the feature is Off (graceMs 0)", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ graceMs: 0 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("fails open on a wildly future timestamp (clock skew)", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + MAX_FUTURE_SKEW_MS + 1 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("tolerates small clock skew inside the allowance", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + 1_000 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });
});

describe("shouldWriteHeartbeat", () => {
    it("writes on the first call while focused", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: null,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });

    it("never writes while unfocused", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: null,
                now: NOW,
                hasFocus: false,
                intervalMs: 30_000,
            }),
        ).toBe(false);
    });

    it("does not write again inside the interval", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW - 29_999,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(false);
    });

    it("writes once the interval has elapsed", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW - 30_000,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });

    it("writes when the clock jumped backwards", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW + 5_000,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });
});

describe("buildHeartbeat", () => {
    it("produces exactly the three blob fields", () => {
        expect(
            buildHeartbeat({ deviceId: "ABC", now: NOW, graceMs: 15_000 }),
        ).toEqual({ deviceId: "ABC", ts: NOW, graceMs: 15_000 });
    });

    it("round-trips through parseActiveSession", () => {
        const built = buildHeartbeat({
            deviceId: "ABC",
            now: NOW,
            graceMs: DEFAULT_GRACE_MS,
        });
        expect(parseActiveSession(built)).toEqual(built);
    });
});

describe("normalizeGraceMs", () => {
    it("keeps a known option", () => {
        expect(normalizeGraceMs(15_000)).toBe(15_000);
    });

    it("keeps Off", () => {
        expect(normalizeGraceMs(0)).toBe(0);
    });

    it("accepts a numeric string (localStorage round-trip)", () => {
        expect(normalizeGraceMs("30000")).toBe(30_000);
    });

    it.each([[undefined], [null], ["abc"], [-5], [NaN]])(
        "falls back to the default for %p",
        (input) => {
            expect(normalizeGraceMs(input)).toBe(DEFAULT_GRACE_MS);
        },
    );
});
