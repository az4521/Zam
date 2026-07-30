import { describe, it, expect } from "vitest";
import {
    NATIVE_SESSION_KEY,
    NATIVE_SESSION_VERSION,
    LEGACY_NATIVE_SESSION_KEYS,
    parseNativeSession,
    serializeNativeSession,
} from "./nativeSessionRecord";

const GOOD = {
    homeserverUrl: "https://matrix.example.org",
    accessToken: "syt_token_aaa",
    userId: "@alice:example.org",
    deviceId: "DEVICEAAA",
};

describe("serializeNativeSession", () => {
    it("produces one versioned record carrying every field", () => {
        const raw = serializeNativeSession(GOOD);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string)).toEqual({
            v: NATIVE_SESSION_VERSION,
            homeserverUrl: GOOD.homeserverUrl,
            accessToken: GOOD.accessToken,
            userId: GOOD.userId,
            deviceId: GOOD.deviceId,
        });
    });

    it("round-trips through the parser unchanged", () => {
        expect(parseNativeSession(serializeNativeSession(GOOD))).toEqual({
            v: NATIVE_SESSION_VERSION,
            ...GOOD,
        });
    });

    it("stores a missing device id as null rather than omitting it", () => {
        const parsed = parseNativeSession(
            serializeNativeSession({ ...GOOD, deviceId: null }),
        );
        expect(parsed?.deviceId).toBeNull();
        expect(parsed?.accessToken).toBe(GOOD.accessToken);
    });

    it("stores an undefined device id as null too", () => {
        const parsed = parseNativeSession(
            serializeNativeSession({
                homeserverUrl: GOOD.homeserverUrl,
                accessToken: GOOD.accessToken,
                userId: GOOD.userId,
            }),
        );
        expect(parsed?.deviceId).toBeNull();
    });

    it("writes NOTHING when a required field is missing or blank", () => {
        expect(serializeNativeSession({ ...GOOD, accessToken: "" })).toBeNull();
        expect(
            serializeNativeSession({ ...GOOD, accessToken: "  " }),
        ).toBeNull();
        expect(
            serializeNativeSession({ ...GOOD, homeserverUrl: "" }),
        ).toBeNull();
        expect(
            serializeNativeSession({ ...GOOD, homeserverUrl: "   " }),
        ).toBeNull();
        expect(serializeNativeSession({ ...GOOD, userId: "" })).toBeNull();
        expect(serializeNativeSession({ ...GOOD, userId: "   " })).toBeNull();
        expect(serializeNativeSession({ ...GOOD, userId: "alice" })).toBeNull();
        expect(serializeNativeSession({ ...GOOD, userId: "@" })).toBeNull();
        expect(
            serializeNativeSession({ ...GOOD, homeserverUrl: "not-a-url" }),
        ).toBeNull();
        expect(
            serializeNativeSession({ ...GOOD, homeserverUrl: "ftp://x.org" }),
        ).toBeNull();
    });

    it("never emits a partial 'best effort' record", () => {
        // Whatever the reason for a rejection, the answer is "no credentials"
        // — never a record with a hole in it.
        for (const bad of [
            { ...GOOD, accessToken: "" },
            { ...GOOD, homeserverUrl: "" },
            { ...GOOD, userId: "" },
        ]) {
            const raw = serializeNativeSession(bad);
            expect(raw).toBeNull();
            expect(parseNativeSession(raw)).toBeNull();
        }
    });
});

describe("parseNativeSession", () => {
    it("rejects anything that is not a JSON object string", () => {
        expect(parseNativeSession(null)).toBeNull();
        expect(parseNativeSession(undefined)).toBeNull();
        expect(parseNativeSession("")).toBeNull();
        expect(parseNativeSession("   ")).toBeNull();
        expect(parseNativeSession("not json")).toBeNull();
        expect(parseNativeSession("[]")).toBeNull();
        expect(parseNativeSession('"a string"')).toBeNull();
        expect(parseNativeSession("42")).toBeNull();
        expect(parseNativeSession("null")).toBeNull();
        expect(parseNativeSession("true")).toBeNull();
        expect(parseNativeSession(42)).toBeNull();
        expect(parseNativeSession({ v: 1, ...GOOD })).toBeNull(); // object, not string
    });

    it("rejects an unknown or missing version", () => {
        expect(parseNativeSession(JSON.stringify({ ...GOOD }))).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ v: 2, ...GOOD })),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ v: 0, ...GOOD })),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ v: "1", ...GOOD })),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ v: null, ...GOOD })),
        ).toBeNull();
    });

    it("rejects a torn record that is missing any credential field", () => {
        // The SEC-01 scenario in record form: whatever survived a partial
        // write must never be usable as a credential tuple.
        expect(
            parseNativeSession(
                JSON.stringify({
                    v: 1,
                    homeserverUrl: "https://other.example.org",
                    accessToken: GOOD.accessToken,
                }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ v: 1, homeserverUrl: GOOD.homeserverUrl }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({
                    v: 1,
                    accessToken: GOOD.accessToken,
                    userId: GOOD.userId,
                }),
            ),
        ).toBeNull(); // no homeserver
        expect(
            parseNativeSession(
                JSON.stringify({
                    v: 1,
                    homeserverUrl: GOOD.homeserverUrl,
                    userId: GOOD.userId,
                }),
            ),
        ).toBeNull(); // no token
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, accessToken: "   " }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, accessToken: 42 }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, homeserverUrl: "   " }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ ...GOOD, v: 1, userId: "  " })),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, userId: "alice:example.org" }),
            ),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ ...GOOD, v: 1, userId: "@" })),
        ).toBeNull();
        expect(
            parseNativeSession(JSON.stringify({ ...GOOD, v: 1, userId: 42 })),
        ).toBeNull();
    });

    it("rejects a homeserver that is not an absolute http(s) URL", () => {
        for (const homeserverUrl of [
            "ftp://matrix.example.org",
            "/_matrix",
            "matrix.example.org",
            "javascript:alert(1)",
            42,
        ]) {
            expect(
                parseNativeSession(
                    JSON.stringify({ ...GOOD, v: 1, homeserverUrl }),
                ),
            ).toBeNull();
        }
    });

    it("accepts a plain-http homeserver (LAN servers work today)", () => {
        const parsed = parseNativeSession(
            JSON.stringify({
                ...GOOD,
                v: 1,
                homeserverUrl: "http://10.0.0.5:8008",
            }),
        );
        expect(parsed?.homeserverUrl).toBe("http://10.0.0.5:8008");
    });

    it("normalises a blank device id to null but rejects a non-string one", () => {
        expect(
            parseNativeSession(JSON.stringify({ ...GOOD, v: 1, deviceId: "" }))
                ?.deviceId,
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, deviceId: "  " }),
            )?.deviceId,
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, deviceId: null }),
            )?.deviceId,
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({
                    v: 1,
                    homeserverUrl: GOOD.homeserverUrl,
                    accessToken: GOOD.accessToken,
                    userId: GOOD.userId,
                }),
            )?.deviceId,
        ).toBeNull(); // absent
        expect(
            parseNativeSession(JSON.stringify({ ...GOOD, v: 1, deviceId: 42 })),
        ).toBeNull();
        expect(
            parseNativeSession(
                JSON.stringify({ ...GOOD, v: 1, deviceId: { a: 1 } }),
            ),
        ).toBeNull();
    });

    it("returns no credentials at all rather than a half-filled object", () => {
        // Every rejection must be indistinguishable from "nothing stored";
        // a caller must never see a record with one field silently empty.
        const torn = parseNativeSession(
            JSON.stringify({ ...GOOD, v: 1, accessToken: "" }),
        );
        expect(torn).toBeNull();
    });

    it("does not accept the legacy per-key shape as a record", () => {
        expect(
            parseNativeSession(
                JSON.stringify({
                    matrix_hs_url: GOOD.homeserverUrl,
                    matrix_access_token: GOOD.accessToken,
                    matrix_user_id: GOOD.userId,
                }),
            ),
        ).toBeNull();
    });
});

describe("key names", () => {
    it("pins the storage key sw.js and the Java service hand-mirror", () => {
        // Two hand-written copies of this string exist outside TypeScript;
        // changing it here silently orphans whatever they already stored.
        expect(NATIVE_SESSION_KEY).toBe("matrix_session_record");
    });

    it("does not reuse the legacy web localStorage session key", () => {
        // `accounts.svelte.ts` migrates and then DELETES localStorage
        // "matrix_session" on boot. Sharing the name invites a future reader
        // to wire the record into that store and have it erased.
        expect(NATIVE_SESSION_KEY).not.toBe("matrix_session");
    });

    it("keeps the record key distinct from every legacy key", () => {
        expect(LEGACY_NATIVE_SESSION_KEYS as readonly string[]).not.toContain(
            NATIVE_SESSION_KEY,
        );
    });

    it("lists the access token first so clear removes it first", () => {
        // Typed, not merely compared: with the `as const` tuple element 0 has
        // the literal type, so a reorder breaks the BUILD here as well as this
        // assertion. `expect(...).toBe(...)` alone would not catch it —
        // vitest's matcher accepts a wider argument than the asserted value.
        const first: "matrix_access_token" = LEGACY_NATIVE_SESSION_KEYS[0];
        expect(first).toBe("matrix_access_token");
    });

    it("stays assignable where a readonly string[] is expected", () => {
        // The `as const` tuple must not force consumers (task 2's clear loop,
        // the debug screen) to widen it by hand — this line is the real
        // assertion; it fails at COMPILE time if the type regresses.
        const keys: readonly string[] = LEGACY_NATIVE_SESSION_KEYS;
        expect(keys).toHaveLength(4);
    });

    it("covers every pre-record key the native side used to write", () => {
        expect([...LEGACY_NATIVE_SESSION_KEYS].sort()).toEqual([
            "matrix_access_token",
            "matrix_device_id",
            "matrix_hs_url",
            "matrix_user_id",
        ]);
    });
});
