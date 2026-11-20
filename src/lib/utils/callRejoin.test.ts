import { describe, it, expect } from "vitest";
import {
    CALL_RECORD_MAX_AGE_MS,
    buildCallRecord,
    hasOtherCallParticipants,
    isCallRecordExpired,
    parseCallRecord,
    shouldOfferRejoin,
    type CallRecord,
} from "./callRejoin";

const NOW = 1_000_000_000;
const record: CallRecord = {
    roomId: "!room:x",
    joinedAt: NOW - 3_600_000,
    heartbeat: NOW - 60_000,
    kind: "voice",
};
const ready = {
    record,
    now: NOW,
    roomJoined: true,
    othersInCall: true,
    alreadyInCall: false,
};

describe("parseCallRecord", () => {
    it("reads a valid record back", () => {
        expect(parseCallRecord(JSON.stringify(record))).toEqual(record);
    });

    it("returns null for absent, non-JSON, or malformed records", () => {
        expect(parseCallRecord(null)).toBeNull();
        expect(parseCallRecord("")).toBeNull();
        expect(parseCallRecord("nope")).toBeNull();
        expect(parseCallRecord("null")).toBeNull();
        expect(
            parseCallRecord(
                '{"roomId":"","joinedAt":1,"heartbeat":1,"kind":"voice"}',
            ),
        ).toBeNull();
        expect(
            parseCallRecord(
                '{"roomId":"!r:x","joinedAt":"1","heartbeat":1,"kind":"voice"}',
            ),
        ).toBeNull();
        expect(
            parseCallRecord(
                '{"roomId":"!r:x","joinedAt":1,"heartbeat":1,"kind":"screen"}',
            ),
        ).toBeNull();
    });
});

describe("buildCallRecord", () => {
    it("stamps the heartbeat and maps video to kind", () => {
        expect(
            buildCallRecord({
                roomId: "!r:x",
                joinedAt: 5,
                now: 9,
                video: true,
            }),
        ).toEqual({ roomId: "!r:x", joinedAt: 5, heartbeat: 9, kind: "video" });
        expect(
            buildCallRecord({
                roomId: "!r:x",
                joinedAt: 5,
                now: 9,
                video: false,
            }).kind,
        ).toBe("voice");
    });
});

describe("hasOtherCallParticipants", () => {
    const self = { userId: "@me:x", deviceId: "DEV1" };

    it("ignores only our own device's membership", () => {
        expect(
            hasOtherCallParticipants(
                [{ userId: "@me:x", deviceId: "DEV1" }],
                self,
            ),
        ).toBe(false);
        expect(hasOtherCallParticipants([], self)).toBe(false);
    });

    it("counts our other devices and other users", () => {
        expect(
            hasOtherCallParticipants(
                [{ userId: "@me:x", deviceId: "DEV2" }],
                self,
            ),
        ).toBe(true);
        expect(
            hasOtherCallParticipants(
                [
                    { userId: "@me:x", deviceId: "DEV1" },
                    { userId: "@bob:x", deviceId: "B1" },
                ],
                self,
            ),
        ).toBe(true);
    });

    it("is false when we do not know who we are", () => {
        expect(
            hasOtherCallParticipants([{ userId: "@bob:x", deviceId: "B1" }], {
                userId: null,
                deviceId: null,
            }),
        ).toBe(true);
    });
});

describe("isCallRecordExpired", () => {
    it("expires a heartbeat older than the window, not one inside it", () => {
        expect(
            isCallRecordExpired(
                { ...record, heartbeat: NOW - CALL_RECORD_MAX_AGE_MS },
                NOW,
            ),
        ).toBe(false);
        expect(
            isCallRecordExpired(
                { ...record, heartbeat: NOW - CALL_RECORD_MAX_AGE_MS - 1 },
                NOW,
            ),
        ).toBe(true);
    });

    it("treats a heartbeat from the future (clock moved back) as expired", () => {
        expect(
            isCallRecordExpired({ ...record, heartbeat: NOW + 5 }, NOW),
        ).toBe(true);
    });
});

describe("shouldOfferRejoin", () => {
    it("offers when the record is recent, the room is joined and others are in the call", () => {
        expect(shouldOfferRejoin(ready)).toBe(true);
    });

    it("does not offer without a record", () => {
        expect(shouldOfferRejoin({ ...ready, record: null })).toBe(false);
    });

    it("does not offer for a stale record (app gone too long)", () => {
        const stale = {
            ...record,
            heartbeat: NOW - CALL_RECORD_MAX_AGE_MS - 1,
        };
        expect(shouldOfferRejoin({ ...ready, record: stale })).toBe(false);
    });

    it("does not offer once we have left the room", () => {
        expect(shouldOfferRejoin({ ...ready, roomJoined: false })).toBe(false);
    });

    it("does not offer when the call has nobody else in it", () => {
        expect(shouldOfferRejoin({ ...ready, othersInCall: false })).toBe(
            false,
        );
    });

    it("does not offer over a call this session is already in", () => {
        expect(shouldOfferRejoin({ ...ready, alreadyInCall: true })).toBe(
            false,
        );
    });
});
