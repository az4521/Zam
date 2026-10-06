import { describe, it, expect } from "vitest";
import {
    NATIVE_SESSION_KEY,
    NATIVE_SESSION_VERSION,
    LEGACY_NATIVE_SESSION_KEYS,
    parseNativeAccount,
    parseNativeSession,
    serializeNativeAccounts,
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

    it("stores a padded homeserver url trimmed, not padded-but-valid", () => {
        // `new URL()` tolerates surrounding whitespace, so without the trim
        // the padding survives into storage — and the Java mirror builds its
        // request URLs by concatenation (`hs + "/_matrix/…"`).
        const raw = serializeNativeSession({
            ...GOOD,
            homeserverUrl: "  https://matrix.example.org  ",
        });
        expect(JSON.parse(raw as string).homeserverUrl).toBe(
            "https://matrix.example.org",
        );
        expect(parseNativeSession(raw)?.homeserverUrl).toBe(
            "https://matrix.example.org",
        );
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

    it("trims a padded homeserver stored by an older writer", () => {
        // Records written before the trim landed are still at rest on device;
        // hand them back usable rather than propagating the padding.
        expect(
            parseNativeSession(
                JSON.stringify({
                    ...GOOD,
                    v: 1,
                    homeserverUrl: "\n https://matrix.example.org \t",
                }),
            )?.homeserverUrl,
        ).toBe("https://matrix.example.org");
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

describe("OAuth metadata in the native record", () => {
    const OAUTH = {
        oauth: { clientId: "client-1", issuer: "https://auth.example/" },
        accessTokenExpiresAt: 1_800_000_000_000,
    };

    it("carries client id, issuer and expiry, and round-trips them", () => {
        const raw = serializeNativeSession({ ...GOOD, ...OAUTH })!;
        expect(JSON.parse(raw)).toMatchObject(OAUTH);
        expect(parseNativeSession(raw)).toMatchObject(OAUTH);
    });

    it("never carries a refresh token, even if one is passed in", () => {
        const raw = serializeNativeSession({
            ...GOOD,
            ...OAUTH,
            refreshToken: "secret-refresh",
        } as never)!;
        expect(raw).not.toContain("secret-refresh");
        expect(raw).not.toContain("refreshToken");
    });

    it("leaves password sessions byte-identical to before", () => {
        const raw = serializeNativeSession(GOOD)!;
        expect(Object.keys(JSON.parse(raw)).sort()).toEqual(
            ["accessToken", "deviceId", "homeserverUrl", "userId", "v"].sort(),
        );
        expect(parseNativeSession(raw)?.oauth).toBeUndefined();
    });

    it("drops a malformed oauth block without discarding the credentials", () => {
        for (const oauth of [{ clientId: "c" }, { issuer: "i" }, "x", null]) {
            const raw = serializeNativeSession({ ...GOOD, oauth } as never)!;
            expect(parseNativeSession(raw)).toMatchObject({
                accessToken: GOOD.accessToken,
            });
            expect(parseNativeSession(raw)?.oauth).toBeUndefined();
        }
    });
});

describe("native account map", () => {
    const BOB = {
        homeserverUrl: "https://hs.example.net",
        accessToken: "syt_token_bbb",
        userId: "@bob:example.net",
        deviceId: "DEVICEBBB",
    };

    it("stores each account's record under its user id", () => {
        const raw = serializeNativeAccounts([GOOD, BOB]);
        expect(parseNativeAccount(raw, GOOD.userId)).toMatchObject(GOOD);
        expect(parseNativeAccount(raw, BOB.userId)).toMatchObject(BOB);
        // Each entry is the exact single-record string.
        expect(JSON.parse(raw)[BOB.userId]).toBe(serializeNativeSession(BOB));
    });

    it("leaves out accounts without a whole credential tuple", () => {
        const raw = serializeNativeAccounts([
            GOOD,
            { ...BOB, accessToken: "" },
        ]);
        expect(Object.keys(JSON.parse(raw))).toEqual([GOOD.userId]);
    });

    it("returns null for a missing account or a malformed map", () => {
        const raw = serializeNativeAccounts([GOOD]);
        expect(parseNativeAccount(raw, BOB.userId)).toBeNull();
        expect(parseNativeAccount("not json", GOOD.userId)).toBeNull();
        expect(parseNativeAccount("[]", GOOD.userId)).toBeNull();
        expect(parseNativeAccount(null, GOOD.userId)).toBeNull();
    });

    it("refuses a record filed under another user id", () => {
        const raw = JSON.stringify({
            [BOB.userId]: serializeNativeSession(GOOD),
        });
        expect(parseNativeAccount(raw, BOB.userId)).toBeNull();
    });
});
