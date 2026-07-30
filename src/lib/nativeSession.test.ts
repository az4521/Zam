/**
 * Tests for the web→native session mirror.
 *
 * The property worth pinning is ORDER, not content. `clearNativeSession` runs
 * on logout, and Capacitor Preferences offers no transaction: if the removals
 * happen in the wrong order — or if one failure aborts the rest — an access
 * token survives logout at rest, readable by the push service on the next cold
 * start. So the token-bearing record must be removed FIRST and every removal
 * must be independently guarded. Mirrored on the write side: the legacy sweep
 * must run only AFTER the record has landed, so a crash in between leaves a
 * working session rather than none.
 *
 * Capacitor is mocked with an ORDERED CALL LOG rather than per-call spies —
 * "which key, in what order" is exactly the assertion, and a set of spies
 * cannot express it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    LEGACY_NATIVE_SESSION_KEYS,
    NATIVE_SESSION_KEY,
    NATIVE_SESSION_VERSION,
    parseNativeSession,
} from "$lib/utils/nativeSessionRecord";
import {
    clearNativeSession,
    readNativeSession,
    syncNativeNotificationPrivacy,
    syncNativeSession,
} from "./nativeSession";

// `vi.hoisted` so the mock factories below (which vitest lifts above the
// imports) can reach this state without hitting its temporal dead zone.
const mocks = vi.hoisted(() => ({
    native: { value: true },
    /** Every Preferences call in order, e.g. "remove:matrix_session_record". */
    calls: [] as string[],
    /** Keys whose set()/remove() should reject, to test partial failure. */
    rejectSet: new Set<string>(),
    rejectRemove: new Set<string>(),
    /** The fake store, so a written record can be parsed back. */
    store: new Map<string, string>(),
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => mocks.native.value },
}));

vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        async set({ key, value }: { key: string; value: string }) {
            mocks.calls.push(`set:${key}`);
            if (mocks.rejectSet.has(key)) throw new Error(`set ${key} failed`);
            mocks.store.set(key, value);
        },
        async remove({ key }: { key: string }) {
            mocks.calls.push(`remove:${key}`);
            if (mocks.rejectRemove.has(key))
                throw new Error(`remove ${key} failed`);
            mocks.store.delete(key);
        },
        async get({ key }: { key: string }) {
            mocks.calls.push(`get:${key}`);
            return { value: mocks.store.get(key) ?? null };
        },
    },
}));

// Not exported from the module under test (it is a device-global setting, not
// part of the credential tuple), so the test re-types it.
const KEY_HIDE_BODY = "matrix_hide_notification_body";

const COMPLETE = {
    homeserverUrl: "https://hs.example.org",
    accessToken: "syt_token",
    userId: "@alice:hs.example.org",
    deviceId: "DEVICE1",
};

const setCalls = () => mocks.calls.filter((c) => c.startsWith("set:"));

beforeEach(() => {
    mocks.native.value = true;
    mocks.calls.length = 0;
    mocks.rejectSet.clear();
    mocks.rejectRemove.clear();
    mocks.store.clear();
    // The module warns on the refusal / failure paths on purpose; keep the
    // test output readable without swallowing anything the code asserts on.
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("clearNativeSession", () => {
    it("removes the credential record before anything else", async () => {
        await clearNativeSession();

        // The security property: whatever else logout does, the token-bearing
        // record is gone first, so a throw anywhere later cannot strand it.
        expect(mocks.calls[0]).toBe(`remove:${NATIVE_SESSION_KEY}`);
        for (const key of LEGACY_NATIVE_SESSION_KEYS) {
            expect(mocks.calls.indexOf(`remove:${key}`)).toBeGreaterThan(0);
        }
        expect(mocks.calls.indexOf(`remove:${KEY_HIDE_BODY}`)).toBeGreaterThan(
            0,
        );
    });

    it("removes exactly the record, the legacy keys and the privacy flag", async () => {
        await clearNativeSession();

        expect(mocks.calls).toEqual([
            `remove:${NATIVE_SESSION_KEY}`,
            ...LEGACY_NATIVE_SESSION_KEYS.map((k) => `remove:${k}`),
            `remove:${KEY_HIDE_BODY}`,
        ]);
    });

    it("keeps going when the first removal rejects", async () => {
        // The regression this guards: four removals once shared ONE try block,
        // so a throw on the first left every later key — including a second
        // copy of the token — at rest after logout.
        mocks.rejectRemove.add(NATIVE_SESSION_KEY);

        await expect(clearNativeSession()).resolves.toBeUndefined();

        expect(mocks.calls).toEqual([
            `remove:${NATIVE_SESSION_KEY}`,
            ...LEGACY_NATIVE_SESSION_KEYS.map((k) => `remove:${k}`),
            `remove:${KEY_HIDE_BODY}`,
        ]);
    });

    it("keeps going when a legacy removal rejects", async () => {
        mocks.rejectRemove.add(LEGACY_NATIVE_SESSION_KEYS[0]);

        await expect(clearNativeSession()).resolves.toBeUndefined();

        expect(mocks.calls).toEqual([
            `remove:${NATIVE_SESSION_KEY}`,
            ...LEGACY_NATIVE_SESSION_KEYS.map((k) => `remove:${k}`),
            `remove:${KEY_HIDE_BODY}`,
        ]);
    });
});

describe("syncNativeSession", () => {
    it("writes the whole tuple in exactly one set()", async () => {
        await syncNativeSession(COMPLETE);

        // One write is the entire point: Preferences has no transaction, so
        // two writes are two chances for the reader to see a torn tuple.
        expect(setCalls()).toEqual([`set:${NATIVE_SESSION_KEY}`]);
        expect(parseNativeSession(mocks.store.get(NATIVE_SESSION_KEY))).toEqual(
            {
                v: NATIVE_SESSION_VERSION,
                homeserverUrl: COMPLETE.homeserverUrl,
                accessToken: COMPLETE.accessToken,
                userId: COMPLETE.userId,
                deviceId: COMPLETE.deviceId,
            },
        );
    });

    it("sweeps the legacy keys only after the record has landed", async () => {
        await syncNativeSession(COMPLETE);

        expect(mocks.calls).toEqual([
            `set:${NATIVE_SESSION_KEY}`,
            ...LEGACY_NATIVE_SESSION_KEYS.map((k) => `remove:${k}`),
        ]);
    });

    it("does not sweep the legacy keys when the record write rejects", async () => {
        // Sweeping after a failed write would strip a working (if old-shaped)
        // session and leave the device with none at all.
        mocks.rejectSet.add(NATIVE_SESSION_KEY);

        await expect(syncNativeSession(COMPLETE)).resolves.toBeUndefined();

        expect(mocks.calls).toEqual([`set:${NATIVE_SESSION_KEY}`]);
    });

    it("writes nothing at all for an incomplete session", async () => {
        await syncNativeSession({ ...COMPLETE, accessToken: "   " });

        // Not a partial record, not a fallback, not a clear: nothing. A
        // three-field mirror is the exact tear this record exists to prevent.
        expect(setCalls()).toEqual([]);
        expect(mocks.calls).toEqual([]);
    });

    it("leaves a previously written record untouched when it refuses", async () => {
        await syncNativeSession(COMPLETE);
        const before = mocks.store.get(NATIVE_SESSION_KEY);
        mocks.calls.length = 0;

        await syncNativeSession({ ...COMPLETE, userId: "not-a-user-id" });

        expect(mocks.calls).toEqual([]);
        expect(mocks.store.get(NATIVE_SESSION_KEY)).toBe(before);
    });
});

describe("off-native", () => {
    it("makes every function a no-op", async () => {
        mocks.native.value = false;

        await syncNativeSession(COMPLETE);
        await syncNativeNotificationPrivacy(true);
        await clearNativeSession();
        const state = await readNativeSession();

        expect(mocks.calls).toEqual([]);
        expect(state).toEqual({
            native: false,
            homeserverUrl: null,
            userId: null,
            deviceId: null,
            hasToken: false,
            hideNotificationBody: false,
        });
    });
});
