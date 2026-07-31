import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MAX_PENDING_WIPES,
    PENDING_WIPE_KEY,
    PENDING_WIPE_VERSION,
    addPendingWipe,
    cryptoDbNames,
    forgetPendingWipe,
    parsePendingWipes,
    readPendingWipes,
    rememberPendingWipe,
    removePendingWipe,
    serializePendingWipes,
    wipesToRetry,
    writePendingWipes,
    type PendingWipe,
} from "./pendingCryptoWipe";

const wipe: PendingWipe = {
    userId: "@a:example.org",
    deviceId: "DEV1",
    cryptoDbPrefix: "matrix-client:%40a%3Aexample.org:DEV1:crypto",
};

/** `n` distinct sessions, oldest first: DEV0 … DEV(n-1). */
function manyWipes(n: number): PendingWipe[] {
    return Array.from({ length: n }, (_, i) => ({
        ...wipe,
        deviceId: `DEV${i}`,
    }));
}

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

    it("caps a stored envelope that holds more entries than we ever write", () => {
        // `addPendingWipe` only bounds writers we control. The array length
        // comes off disk, so the read path has to bound it too.
        const raw = JSON.stringify({
            v: PENDING_WIPE_VERSION,
            wipes: manyWipes(20),
        });
        const parsed = parsePendingWipes(raw);
        expect(parsed).toHaveLength(MAX_PENDING_WIPES);
        // the NEWEST survive, matching what `addPendingWipe` would have kept
        expect(parsed[parsed.length - 1].deviceId).toBe("DEV19");
        expect(parsed[0].deviceId).toBe(`DEV${20 - MAX_PENDING_WIPES}`);
    });
});

describe("serializePendingWipes", () => {
    it("writes only the three known fields, never a smuggled secret", () => {
        // The dangerous call TypeScript will NOT catch: excess-property
        // checking does not fire through a spread, and the account records in
        // `matrix_accounts` carry an `accessToken`. Structure, not the type
        // checker, is what has to keep a token out of localStorage.
        const accountLike = { ...wipe, accessToken: "syt_secret_never_stored" };
        const smuggled: PendingWipe = { ...accountLike };
        const raw = serializePendingWipes([smuggled]);
        expect(raw).not.toContain("syt_secret_never_stored");
        expect(raw).not.toContain("accessToken");
        expect(parsePendingWipes(raw)).toEqual([wipe]);
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

    it("keeps the cap big enough to hold a real multi-account device", () => {
        // Pinned with a literal floor on purpose: every other cap assertion
        // derives its bound from the constant, so they all stay green if it
        // collapses to 1 — which would silently forget every session's owed
        // wipe but the last one.
        expect(MAX_PENDING_WIPES).toBeGreaterThanOrEqual(8);
    });

    it("keeps the newest 8 of a literal 20 sessions", () => {
        let list: PendingWipe[] = [];
        for (const w of manyWipes(20)) list = addPendingWipe(list, w);
        expect(list).toHaveLength(MAX_PENDING_WIPES);
        expect(list[0].deviceId).toBe(`DEV${20 - MAX_PENDING_WIPES}`);
        expect(list[list.length - 1].deviceId).toBe("DEV19");
        expect(list.map((w) => w.deviceId)).toContain("DEV12");
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

describe("storage accessors", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("round-trips through localStorage under the versioned key", () => {
        writePendingWipes([wipe]);
        expect(localStorage.getItem(PENDING_WIPE_KEY)).toBe(
            serializePendingWipes([wipe]),
        );
        expect(readPendingWipes()).toEqual([wipe]);
    });

    it("reads an absent or corrupt value as no records", () => {
        expect(readPendingWipes()).toEqual([]);
        localStorage.setItem(PENDING_WIPE_KEY, "{{{");
        expect(readPendingWipes()).toEqual([]);
    });

    it("remember adds without losing other sessions, and dedupes", () => {
        const other = { ...wipe, deviceId: "DEV2" };
        rememberPendingWipe(wipe);
        rememberPendingWipe(other);
        rememberPendingWipe(wipe);
        expect(readPendingWipes()).toEqual([other, wipe]);
    });

    it("forget removes only the named session, and clears the key when empty", () => {
        const other = { ...wipe, deviceId: "DEV2" };
        writePendingWipes([wipe, other]);
        forgetPendingWipe(wipe);
        expect(readPendingWipes()).toEqual([other]);
        forgetPendingWipe(other);
        expect(readPendingWipes()).toEqual([]);
        expect(localStorage.getItem(PENDING_WIPE_KEY)).toBeNull();
    });

    it("never throws when storage itself throws", () => {
        vi.stubGlobal("localStorage", {
            getItem() {
                throw new Error("private mode");
            },
            setItem() {
                throw new Error("private mode");
            },
            removeItem() {
                throw new Error("private mode");
            },
        });
        expect(readPendingWipes()).toEqual([]);
        expect(() => writePendingWipes([wipe])).not.toThrow();
        expect(() => rememberPendingWipe(wipe)).not.toThrow();
        expect(() => forgetPendingWipe(wipe)).not.toThrow();
    });
});
