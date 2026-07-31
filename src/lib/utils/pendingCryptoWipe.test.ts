import { describe, expect, it } from "vitest";
import {
    MAX_PENDING_WIPES,
    PENDING_WIPE_VERSION,
    addPendingWipe,
    cryptoDbNames,
    parsePendingWipes,
    removePendingWipe,
    serializePendingWipes,
    wipesToRetry,
    type PendingWipe,
} from "./pendingCryptoWipe";

const wipe: PendingWipe = {
    userId: "@a:example.org",
    deviceId: "DEV1",
    cryptoDbPrefix: "matrix-client:%40a%3Aexample.org:DEV1:crypto",
};

describe("parsePendingWipes", () => {
    it("is empty for null, junk, non-objects and non-arrays", () => {
        expect(parsePendingWipes(null)).toEqual([]);
        expect(parsePendingWipes("")).toEqual([]);
        expect(parsePendingWipes("not json")).toEqual([]);
        expect(parsePendingWipes("null")).toEqual([]);
        expect(parsePendingWipes('{"v":1}')).toEqual([]);
        expect(parsePendingWipes(JSON.stringify({ v: 1, wipes: {} }))).toEqual(
            [],
        );
    });

    it("rejects a record from a different version", () => {
        const raw = JSON.stringify({
            v: PENDING_WIPE_VERSION + 1,
            wipes: [wipe],
        });
        expect(parsePendingWipes(raw)).toEqual([]);
    });

    it("drops entries missing, blank or mistyped fields instead of half-using them", () => {
        const raw = JSON.stringify({
            v: PENDING_WIPE_VERSION,
            wipes: [
                wipe,
                { userId: "@b:example.org", deviceId: "DEV2" },
                { ...wipe, userId: "" },
                { ...wipe, deviceId: 7 },
                { ...wipe, cryptoDbPrefix: null },
                "nope",
                null,
            ],
        });
        expect(parsePendingWipes(raw)).toEqual([wipe]);
    });

    it("keeps only the three known fields, never anything extra a writer smuggled in", () => {
        const raw = JSON.stringify({
            v: PENDING_WIPE_VERSION,
            wipes: [{ ...wipe, accessToken: "syt_secret" }],
        });
        expect(parsePendingWipes(raw)).toEqual([wipe]);
        expect(Object.keys(parsePendingWipes(raw)[0])).toEqual([
            "userId",
            "deviceId",
            "cryptoDbPrefix",
        ]);
    });

    it("round-trips a valid record", () => {
        expect(parsePendingWipes(serializePendingWipes([wipe]))).toEqual([
            wipe,
        ]);
    });
});

describe("addPendingWipe", () => {
    it("dedupes on user + device", () => {
        expect(addPendingWipe([wipe], { ...wipe })).toEqual([wipe]);
    });

    it("replaces a same-session entry rather than keeping a stale prefix", () => {
        const moved = { ...wipe, cryptoDbPrefix: "new-prefix" };
        expect(addPendingWipe([wipe], moved)).toEqual([moved]);
    });

    it("keeps records for other sessions", () => {
        const other = { ...wipe, deviceId: "DEV2" };
        expect(addPendingWipe([wipe], other)).toEqual([wipe, other]);
    });

    it("caps the list, dropping the oldest", () => {
        let list: PendingWipe[] = [];
        for (let i = 0; i < MAX_PENDING_WIPES + 3; i++) {
            list = addPendingWipe(list, { ...wipe, deviceId: `DEV${i}` });
        }
        expect(list).toHaveLength(MAX_PENDING_WIPES);
        expect(list[0].deviceId).toBe("DEV3");
        expect(list[list.length - 1].deviceId).toBe(
            `DEV${MAX_PENDING_WIPES + 2}`,
        );
    });
});

describe("removePendingWipe", () => {
    it("removes only the matching session", () => {
        const other = { ...wipe, deviceId: "DEV2" };
        expect(removePendingWipe([wipe, other], wipe)).toEqual([other]);
    });

    it("is a no-op for an unknown session", () => {
        expect(removePendingWipe([wipe], { ...wipe, userId: "@z:x" })).toEqual([
            wipe,
        ]);
    });
});

describe("wipesToRetry", () => {
    it("returns everything when no session is known to this device", () => {
        expect(wipesToRetry([wipe], [])).toEqual([wipe]);
    });

    it("never wipes the store of a session still known to this device", () => {
        expect(
            wipesToRetry(
                [wipe],
                [{ userId: wipe.userId, deviceId: wipe.deviceId }],
            ),
        ).toEqual([]);
    });

    it("still wipes another device of the same user", () => {
        expect(
            wipesToRetry([wipe], [{ userId: wipe.userId, deviceId: "DEV9" }]),
        ).toEqual([wipe]);
    });

    it("treats a live session with an unknown device as covering all of that user's records", () => {
        expect(wipesToRetry([wipe], [{ userId: wipe.userId }])).toEqual([]);
        expect(
            wipesToRetry([wipe], [{ userId: wipe.userId, deviceId: null }]),
        ).toEqual([]);
        expect(
            wipesToRetry([wipe], [{ userId: wipe.userId, deviceId: "" }]),
        ).toEqual([]);
    });

    it("does not let one user's live session protect another user's record", () => {
        expect(
            wipesToRetry([wipe], [{ userId: "@other:example.org" }]),
        ).toEqual([wipe]);
    });
});

describe("cryptoDbNames", () => {
    it("names both databases matrix-js-sdk creates for a prefix", () => {
        expect(cryptoDbNames("p")).toEqual([
            "p::matrix-sdk-crypto",
            "p::matrix-sdk-crypto-meta",
        ]);
    });
});
