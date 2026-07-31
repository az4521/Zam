import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    beforeEach,
    afterEach,
} from "vitest";
import {
    deleteCryptoStore,
    deleteDatabaseWithOutcome,
    retryPendingCryptoWipes,
} from "./crypto";
import {
    PENDING_WIPE_KEY,
    serializePendingWipes,
    readPendingWipes,
} from "$lib/utils/pendingCryptoWipe";

// Regression cover for the "Cannot encrypt event in unconfigured room" bug
// (2026-07-25, cross-server DM with a federated homeserver).
//
// The SDK only ever configures a room's RoomEncryptor from `onCryptoEvent`,
// which it calls from the SYNC LOOP alone (sync.ts, on m.room.encryption events
// in a /sync response). `seedRoomStateIfMissing()` injects state straight into
// the Room model to heal rooms continuwuity omits from sync, so a healed
// encrypted room is known-encrypted to the UI while crypto never learned about
// it — and every send throws. `ensureRoomCryptoConfigured` replays the event
// through the same hook the sync loop would have used.

const h = vi.hoisted(() => ({
    getClient: vi.fn(),
    createDirectMessage: vi.fn(),
    onCryptoEvent: vi.fn<(room: unknown, event: unknown) => Promise<void>>(() =>
        Promise.resolve(),
    ),
    initRustCrypto: vi.fn(() => Promise.resolve()),
    roomEncryptors: {} as Record<string, unknown>,
}));

vi.mock("$lib/matrix/client", () => ({
    getClient: h.getClient,
    createDirectMessage: h.createDirectMessage,
}));
vi.mock("$lib/stores/messages.svelte", () => ({ bumpTimelineTick: vi.fn() }));
vi.mock("$lib/stores/security.svelte", () => ({ bumpSecurityTick: vi.fn() }));

const ROOM_ID = "!healed:example.org";

/** Minimal Room stand-in: only the state lookup the helper performs. */
function makeRoom(encryptionEvent: unknown, roomId = ROOM_ID) {
    return {
        roomId,
        getLiveTimeline: () => ({
            getState: () => ({
                getStateEvents: (type: string, stateKey: string) =>
                    type === "m.room.encryption" && stateKey === ""
                        ? encryptionEvent
                        : null,
            }),
        }),
    };
}

function makeClient() {
    return {
        initRustCrypto: h.initRustCrypto,
        on: vi.fn(),
        off: vi.fn(),
        getCrypto: () => ({
            onCryptoEvent: h.onCryptoEvent,
            roomEncryptors: h.roomEncryptors,
        }),
    };
}

/**
 * Pay for the crypto module graph ONCE, before any test's clock starts.
 *
 * Importing ./crypto drags in matrix-js-sdk and half of $lib; on a cold vitest
 * cache that transform+import cost ran into seconds. Paid inside a test body it
 * could blow the 5s test timeout — and vitest cannot cancel the promise it just
 * gave up on, so the abandoned continuation kept going and fired
 * `onCryptoEvent` in the middle of a LATER test, after that test's beforeEach
 * had cleared the spy. The result was a pair of failures that only ever showed
 * up on a cold or loaded run ("Test timed out" here, "expected onCryptoEvent
 * not to have been called" one test down) and vanished on a re-run.
 *
 * Warming the graph in a hook keeps every test body down to microseconds of
 * real work. `vi.resetModules()` in the beforeEach hooks still hands each test
 * a fresh module instance — only the transform/dependency cache is shared.
 */
beforeAll(async () => {
    await import("./crypto");
});

describe("ensureRoomCryptoConfigured", () => {
    let mod: typeof import("./crypto");

    // The module load and initCrypto both live in the hook, not in the test
    // bodies: a test body here now holds nothing but the call under test, so
    // there is no in-flight work that could outlive the test that started it.
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        for (const key of Object.keys(h.roomEncryptors)) {
            delete h.roomEncryptors[key];
        }
        h.onCryptoEvent.mockImplementation(() => Promise.resolve());
        h.initRustCrypto.mockImplementation(() => Promise.resolve());

        mod = await import("./crypto");
        const client = makeClient();
        h.getClient.mockReturnValue(client);
        // initCrypto flips the module's cryptoAvailable flag.
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
    });

    it("replays a state-seeded m.room.encryption event through the crypto hook", async () => {
        const event = { fake: "m.room.encryption event" };
        const room = makeRoom(event);

        await mod.ensureRoomCryptoConfigured(room as never);

        expect(h.onCryptoEvent).toHaveBeenCalledTimes(1);
        expect(h.onCryptoEvent).toHaveBeenCalledWith(room, event);
    });

    it("no-ops when the sync loop already configured the room", async () => {
        h.roomEncryptors[ROOM_ID] = { alreadyThere: true };

        await mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
    });

    it("no-ops for an unencrypted room", async () => {
        await mod.ensureRoomCryptoConfigured(makeRoom(null) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
    });

    it("never throws when the crypto layer rejects the event", async () => {
        h.onCryptoEvent.mockRejectedValueOnce(new Error("olm machine says no"));

        await expect(
            mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never),
        ).resolves.toBeUndefined();
    });

    it("no-ops when rust-crypto failed to initialise", async () => {
        // Re-init the module the hook already booted, this time with rust-crypto
        // refusing to load: initCrypto clears cryptoAvailable on entry, so the
        // failed re-init leaves the module in the "no crypto" state under test.
        const client = makeClient();
        h.getClient.mockReturnValue(client);
        h.initRustCrypto.mockRejectedValueOnce(new Error("no WASM"));
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");

        await mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
    });
});

describe("getEventShield", () => {
    /**
     * Client stand-in whose crypto layer answers getEncryptionInfoForEvent.
     * Mirrors makeClient() above but adds the one method under test.
     */
    function makeShieldClient(
        getEncryptionInfoForEvent: ReturnType<typeof vi.fn>,
    ) {
        return {
            initRustCrypto: h.initRustCrypto,
            on: vi.fn(),
            off: vi.fn(),
            getCrypto: () => ({
                onCryptoEvent: h.onCryptoEvent,
                roomEncryptors: h.roomEncryptors,
                getEncryptionInfoForEvent,
            }),
        };
    }

    async function bootWithShield(
        getEncryptionInfoForEvent: ReturnType<typeof vi.fn>,
    ) {
        const mod = await import("./crypto");
        const client = makeShieldClient(getEncryptionInfoForEvent);
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        mod.clearEventShieldCache();
        // The client comes back too so a test can fish the handler the module
        // registered for a given crypto event out of `client.on.mock.calls`.
        return { mod, client };
    }

    // A remote (already-sent) event. `status` is null on everything that came
    // down /sync — only local echo carries an EventStatus, which the wrapper
    // refuses to memoise.
    const evt = (id: string) => ({ getId: () => id, status: null }) as never;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("reduces the SDK's EventEncryptionInfo to plain numbers", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 2 }),
        );
        const { mod } = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$a"))).resolves.toEqual({
            colour: 1,
            reason: 2,
        });
    });

    it("returns null when the event is unencrypted or not yet decrypted", async () => {
        const spy = vi.fn(() => Promise.resolve(null));
        const { mod } = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$b"))).resolves.toBeNull();
    });

    it("never throws when the crypto layer rejects", async () => {
        const spy = vi.fn(() => Promise.reject(new Error("boom")));
        const { mod } = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$c"))).resolves.toBeNull();
    });

    it("memoises a real result so a re-render costs no crypto call", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 2, shieldReason: 7 }),
        );
        const { mod } = await bootWithShield(spy);
        await mod.getEventShield(evt("$d"));
        await mod.getEventShield(evt("$d"));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does NOT memoise null — an undecrypted event must be re-checked", async () => {
        const spy = vi.fn(() => Promise.resolve(null));
        const { mod } = await bootWithShield(spy);
        await mod.getEventShield(evt("$e"));
        await mod.getEventShield(evt("$e"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("clearEventShieldCache forces a refetch after a trust change", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod } = await bootWithShield(spy);
        await mod.getEventShield(evt("$f"));
        mod.clearEventShieldCache();
        await mod.getEventShield(evt("$f"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("returns null for an event with no id rather than poisoning the cache", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod } = await bootWithShield(spy);
        await expect(
            mod.getEventShield({ getId: () => undefined } as never),
        ).resolves.toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    // The point of the feature: a shield must not survive the trust change that
    // invalidates it. Asserting the events are merely *subscribed* would still
    // pass if the handler stopped dropping the memo, so drive the real handler.
    it("drops the memo when a trust event actually fires", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod, client } = await bootWithShield(spy);
        await mod.getEventShield(evt("$g"));
        expect(spy).toHaveBeenCalledTimes(1);

        // The handler the module registered for a device verification.
        const handler = client.on.mock.calls.find(
            (c) => c[0] === "userTrustStatusChanged",
        )?.[1] as (() => void) | undefined;
        expect(handler).toBeTypeOf("function");
        handler?.();

        await mod.getEventShield(evt("$g"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("also drops the memo on a device-list update", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod, client } = await bootWithShield(spy);
        await mod.getEventShield(evt("$g2"));

        const handler = client.on.mock.calls.find(
            (c) => c[0] === "crypto.devicesUpdated",
        )?.[1] as (() => void) | undefined;
        expect(handler).toBeTypeOf("function");
        handler?.();

        await mod.getEventShield(evt("$g2"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    // Mirrors EVENT_SHIELD_CACHE_MAX in crypto.ts (not exported on purpose —
    // it's an implementation detail, but "bounded" is a hard requirement).
    it("evicts the oldest entry once the cache is full", async () => {
        const CAP = 1000;
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod } = await bootWithShield(spy);
        for (let i = 0; i <= CAP; i++) {
            await mod.getEventShield(evt(`$cap-${i}`));
        }
        expect(spy).toHaveBeenCalledTimes(CAP + 1);

        // The newest entry is still memoised...
        await mod.getEventShield(evt(`$cap-${CAP}`));
        expect(spy).toHaveBeenCalledTimes(CAP + 1);

        // ...but the oldest was evicted to make room for it.
        await mod.getEventShield(evt("$cap-0"));
        expect(spy).toHaveBeenCalledTimes(CAP + 2);
    });

    it("returns null when crypto isn't ready", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod } = await bootWithShield(spy);

        // Crypto went away (account switch / rust-crypto never initialised).
        h.getClient.mockReturnValue({ getCrypto: () => undefined });
        await expect(mod.getEventShield(evt("$h"))).resolves.toBeNull();

        // And with no client at all, the optional chain has to hold.
        h.getClient.mockReturnValue(null);
        await expect(mod.getEventShield(evt("$h2"))).resolves.toBeNull();

        expect(spy).not.toHaveBeenCalled();
    });

    it("passes a null shieldReason straight through", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: null }),
        );
        const { mod } = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$i"))).resolves.toEqual({
            colour: 1,
            reason: null,
        });
    });

    // The `?? null` normalisation: `reason` is typed `number | null` for the
    // pure view-model, so a missing/undefined reason must not leak through as
    // `undefined`. (The SDK types it `| null`, so this is belt-and-braces.)
    it("normalises a missing shieldReason to null", async () => {
        const spy = vi.fn(() => Promise.resolve({ shieldColour: 2 }));
        const { mod } = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$j"))).resolves.toEqual({
            colour: 2,
            reason: null,
        });
    });

    // The write happens after an await, so an invalidation can land mid-flight.
    // A verdict fetched before a trust change must not be written back into the
    // freshly-cleared map — that is exactly the identity-change case the shield
    // exists to surface, and a poisoned entry hides it until some unrelated
    // trust event fires.
    it("does not re-poison the cache with a fetch that was in flight when it was cleared", async () => {
        let settle: (info: unknown) => void = () => {};
        const inFlight = new Promise((resolve) => {
            settle = resolve;
        });
        const spy = vi.fn(() => inFlight);
        const { mod } = await bootWithShield(spy);

        const pending = mod.getEventShield(evt("$k"));
        // Trust changed while the crypto round trip was still outstanding.
        mod.clearEventShieldCache();
        settle({ shieldColour: 1, shieldReason: 1 });

        // The caller that asked still gets its answer...
        await expect(pending).resolves.toEqual({ colour: 1, reason: 1 });

        // ...but it must not have survived the invalidation boundary.
        await mod.getEventShield(evt("$k"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    // Session expiry returns to the login view IN PLACE with no reload
    // (+page.svelte), then re-inits crypto in the same JS context against a
    // fresh crypto store — one that knows nothing about sender devices. A memo
    // carried across that boundary serves pre-expiry verdicts and under-warns.
    it("drops the memo when crypto re-initialises in the same JS context", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const { mod, client } = await bootWithShield(spy);
        await mod.getEventShield(evt("$l"));
        expect(spy).toHaveBeenCalledTimes(1);

        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");

        await mod.getEventShield(evt("$l"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    // Local echo: the SDK short-circuits outgoing events to a NONE shield
    // without consulting the crypto store, and the id is a transaction id the
    // remote echo replaces. Caching it is dead weight that evicts real verdicts.
    it("does not memoise local echo, whose id is about to be replaced", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 0, shieldReason: null }),
        );
        const { mod } = await bootWithShield(spy);
        const echo = {
            getId: () => "~!room:example.org:txn1",
            status: "sending",
        } as never;

        await mod.getEventShield(echo);
        await mod.getEventShield(echo);

        expect(spy).toHaveBeenCalledTimes(2);
    });
});

// A failed read used to come back as "available, and nothing is set up" — the
// same shape a brand-new account has — so Settings offered "Set up recovery"
// and "Reset recovery" over working keys (audit CRYPTO-02). The read outcome is
// now reported in `read`, and these tests hold that distinction open.
describe("posture reads report their outcome", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    /** Client stand-in whose crypto layer answers the posture/backup reads. */
    function makeStatusClient(cryptoOverrides: Record<string, unknown> = {}) {
        return {
            getUserId: () => "@me:example.org",
            getDeviceId: () => "DEVICE1",
            secretStorage: { getKey: () => Promise.resolve(null) },
            getCrypto: () => ({
                isCrossSigningReady: () => Promise.resolve(true),
                getCrossSigningStatus: () =>
                    Promise.resolve({ privateKeysInSecretStorage: true }),
                isSecretStorageReady: () => Promise.resolve(true),
                getSecretStorageStatus: () =>
                    Promise.resolve({ defaultKeyId: "key1" }),
                getDeviceVerificationStatus: () =>
                    Promise.resolve({ crossSigningVerified: true }),
                getKeyBackupInfo: () =>
                    Promise.resolve({ version: "3", count: 12 }),
                getActiveSessionBackupVersion: () => Promise.resolve("3"),
                isKeyBackupTrusted: () =>
                    Promise.resolve({
                        trusted: true,
                        matchesDecryptionKey: true,
                    }),
                ...cryptoOverrides,
            }),
        };
    }

    it("getSecurityStatus reports ok on a read that landed", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(makeStatusClient());
        const status = await mod.getSecurityStatus();
        expect(status.read).toBe("ok");
        expect(status.secretStorageReady).toBe(true);
        expect(status.defaultKeyId).toBe("key1");
    });

    it("getSecurityStatus reports error — never ok — when a read throws", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(
            makeStatusClient({
                isSecretStorageReady: () =>
                    Promise.reject(new Error("IndexedDB is gone")),
            }),
        );
        const status = await mod.getSecurityStatus();
        expect(status.read).toBe("error");
        // The payload below a failed read is a placeholder, so the ONLY thing
        // that keeps it from reading as "brand-new account" is `read`.
        expect(status.secretStorageReady).toBe(false);
    });

    it("getSecurityStatus reports unavailable when crypto isn't ready", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({ getCrypto: () => undefined });
        expect((await mod.getSecurityStatus()).read).toBe("unavailable");
    });

    it("getBackupStatus reports ok on a read that landed", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(makeStatusClient());
        const backup = await mod.getBackupStatus();
        expect(backup.read).toBe("ok");
        expect(backup.exists).toBe(true);
        expect(backup.active).toBe(true);
    });

    it("getBackupStatus reports error — never ok — when a read throws", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(
            makeStatusClient({
                getKeyBackupInfo: () =>
                    Promise.reject(new Error("backup read blew up")),
            }),
        );
        const backup = await mod.getBackupStatus();
        expect(backup.read).toBe("error");
        // `exists: false` here means "we don't know", not "no backup".
        expect(backup.exists).toBe(false);
    });

    it("getBackupStatus reports unavailable when crypto isn't ready", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({ getCrypto: () => undefined });
        expect((await mod.getBackupStatus()).read).toBe("unavailable");
    });
});

// `resetRecovery` destroys the old recovery key and backup BEFORE it mints the
// replacement, so "it threw" is two completely different situations: a failure
// in the first half leaves the account as it was and the reset is the right
// retry, while a failure in the second half leaves the account with NO recovery
// and re-running the reset would wipe again. The caller can't tell them apart
// from outside, so the second one gets its own error type (audit CRYPTO-01).
describe("resetRecovery reports which half failed", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    /**
     * Client stand-in for the reset path: `resetEncryption` plus the three
     * crypto calls `setupRecovery` makes afterwards. Every one is overridable
     * so a test can fail exactly one of them.
     */
    function makeResetClient(cryptoOverrides: Record<string, unknown> = {}) {
        const calls: string[] = [];
        const client = {
            getUserId: () => "@me:example.org",
            getDeviceId: () => "DEVICE1",
            getCrypto: () => ({
                resetEncryption: vi.fn(() => {
                    calls.push("resetEncryption");
                    return Promise.resolve();
                }),
                bootstrapCrossSigning: vi.fn(() => {
                    calls.push("bootstrapCrossSigning");
                    return Promise.resolve();
                }),
                createRecoveryKeyFromPassphrase: vi.fn(() => {
                    calls.push("createRecoveryKeyFromPassphrase");
                    return Promise.resolve({
                        encodedPrivateKey: "EsTNEWKEY",
                        keyInfo: {},
                    });
                }),
                bootstrapSecretStorage: vi.fn(() => {
                    calls.push("bootstrapSecretStorage");
                    return Promise.resolve();
                }),
                ...cryptoOverrides,
            }),
        };
        return { client, calls };
    }

    it("mints and returns a new recovery key when both halves succeed", async () => {
        const mod = await import("./crypto");
        const { client, calls } = makeResetClient();
        h.getClient.mockReturnValue(client);

        await expect(mod.resetRecovery("pw")).resolves.toEqual({
            recoveryKey: "EsTNEWKEY",
            hasPassphrase: false,
        });
        // Destroy first, then set up — the ordering the whole hazard rests on.
        expect(calls[0]).toBe("resetEncryption");
        expect(calls).toContain("bootstrapSecretStorage");
    });

    it("flags a failure AFTER the destructive step as an incomplete setup", async () => {
        const mod = await import("./crypto");
        const cause = new Error("secret storage upload rejected");
        const { client, calls } = makeResetClient({
            bootstrapSecretStorage: () => Promise.reject(cause),
        });
        h.getClient.mockReturnValue(client);

        const error = await mod.resetRecovery("pw").catch((e) => e);

        // The destruction did happen, so this must NOT look like a plain
        // retryable error: the only safe retry is the setup half alone.
        expect(calls).toContain("resetEncryption");
        expect(mod.isRecoverySetupIncomplete(error)).toBe(true);
        expect(error).toBeInstanceOf(mod.RecoverySetupIncompleteError);
        // The underlying reason survives for the UI to show...
        expect(error.message).toBe("secret storage upload rejected");
        // ...and so does the original, for logs.
        expect(error.cause).toBe(cause);
    });

    it("falls back to plain copy when the inner failure has no message", async () => {
        const mod = await import("./crypto");
        const { client } = makeResetClient({
            bootstrapSecretStorage: () => Promise.reject(new Error("   ")),
        });
        h.getClient.mockReturnValue(client);

        const error = await mod.resetRecovery("pw").catch((e) => e);
        expect(mod.isRecoverySetupIncomplete(error)).toBe(true);
        expect(error.message).toBe(
            "Your old recovery was reset, but setting up the new one failed.",
        );
    });

    it("leaves a failure BEFORE the destructive step an ordinary error", async () => {
        const mod = await import("./crypto");
        const { client, calls } = makeResetClient({
            resetEncryption: () =>
                Promise.reject(new Error("Incorrect password")),
        });
        h.getClient.mockReturnValue(client);

        const error = await mod.resetRecovery("pw").catch((e) => e);

        expect(error.message).toBe("Incorrect password");
        // Nothing was destroyed and nothing was set up, so re-running the reset
        // is the right retry — the UI must not be pushed into repair.
        expect(mod.isRecoverySetupIncomplete(error)).toBe(false);
        expect(calls).not.toContain("bootstrapCrossSigning");
    });

    it("does not mistake an unrelated error for an incomplete setup", async () => {
        const mod = await import("./crypto");
        expect(mod.isRecoverySetupIncomplete(new Error("nope"))).toBe(false);
        expect(mod.isRecoverySetupIncomplete("nope")).toBe(false);
        expect(mod.isRecoverySetupIncomplete(null)).toBe(false);
    });

    it("refuses before touching anything when crypto isn't ready", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => undefined,
        });
        const error = await mod.resetRecovery("pw").catch((e) => e);
        expect(error.message).toBe("Encryption is not ready on this session");
        expect(mod.isRecoverySetupIncomplete(error)).toBe(false);
    });
});

describe("SECURITY_EVENTS trust wiring", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("subscribes to the two trust events that invalidate shields", async () => {
        const mod = await import("./crypto");
        const client = makeClient();
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        const subscribed = client.on.mock.calls.map((c) => c[0]);
        expect(subscribed).toContain("userTrustStatusChanged");
        expect(subscribed).toContain("crypto.devicesUpdated");
    });
});

// A fake IDBFactory: each name is scripted with the event to fire. "hang"
// fires nothing, which is exactly what a blocked delete does in the SDK.
type FakeMode = "success" | "error" | "blocked" | "hang" | "throw";

function fakeIndexedDB(
    modes: Record<string, FakeMode>,
    fallback: FakeMode = "success",
) {
    const seen: string[] = [];
    const factory = {
        deleteDatabase(name: string) {
            seen.push(name);
            const mode = modes[name] ?? fallback;
            if (mode === "throw") throw new Error("nope");
            const req: Record<string, (() => void) | null> = {
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            queueMicrotask(() => {
                if (mode === "success") req.onsuccess?.();
                if (mode === "error") req.onerror?.();
                if (mode === "blocked") req.onblocked?.();
            });
            return req;
        },
    };
    return { factory: factory as unknown as IDBFactory, seen };
}

const PREFIX = "matrix-client:%40a%3Aexample.org:DEV1:crypto";
const pending = {
    userId: "@a:example.org",
    deviceId: "DEV1",
    cryptoDbPrefix: PREFIX,
};

describe("deleteDatabaseWithOutcome", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reports a completed delete", async () => {
        const { factory } = fakeIndexedDB({});
        await expect(
            deleteDatabaseWithOutcome(factory, "db", 50),
        ).resolves.toBe("deleted");
    });

    it("reports a rejected delete without throwing", async () => {
        const { factory } = fakeIndexedDB({ db: "error" });
        await expect(
            deleteDatabaseWithOutcome(factory, "db", 50),
        ).resolves.toBe("failed");
    });

    it("reports a blocked delete as blocked, not as done", async () => {
        const { factory } = fakeIndexedDB({ db: "blocked" });
        await expect(
            deleteDatabaseWithOutcome(factory, "db", 50),
        ).resolves.toBe("blocked");
    });

    it("gives up on a delete that never settles, so boot can never hang", async () => {
        const { factory } = fakeIndexedDB({ db: "hang" });
        await expect(deleteDatabaseWithOutcome(factory, "db", 5)).resolves.toBe(
            "blocked",
        );
    });

    it("reports a throwing factory as failed", async () => {
        const { factory } = fakeIndexedDB({ db: "throw" });
        await expect(deleteDatabaseWithOutcome(factory, "db", 5)).resolves.toBe(
            "failed",
        );
    });
});

describe("retryPendingCryptoWipes", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("deletes both databases and clears the record when they are gone", async () => {
        const { factory, seen } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([]);

        expect(seen).toEqual([
            `${PREFIX}::matrix-sdk-crypto`,
            `${PREFIX}::matrix-sdk-crypto-meta`,
        ]);
        expect(readPendingWipes()).toEqual([]);
    });

    it("KEEPS the record when a delete is still blocked", async () => {
        const { factory } = fakeIndexedDB({
            [`${PREFIX}::matrix-sdk-crypto`]: "blocked",
        });
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([]);

        expect(readPendingWipes()).toEqual([pending]);
    });

    it("never touches the store of a session still known to this device", async () => {
        const { factory, seen } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([
            { userId: pending.userId, deviceId: pending.deviceId },
        ]);

        expect(seen).toEqual([]);
        // Skipped, not dropped: it must still be there when that session goes.
        expect(readPendingWipes()).toEqual([pending]);
    });

    it("resolves without touching storage when there is nothing to do", async () => {
        const { factory, seen } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);
        await expect(retryPendingCryptoWipes([])).resolves.toBeUndefined();
        expect(seen).toEqual([]);
    });

    it("resolves when there is no IndexedDB at all", async () => {
        vi.stubGlobal("indexedDB", undefined);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );
        await expect(retryPendingCryptoWipes([])).resolves.toBeUndefined();
        expect(readPendingWipes()).toEqual([pending]);
    });

    // Boot calls this fire-and-forget; a second caller (a re-render, a second
    // account restoring) must not re-issue deletes that are already in flight.
    it("is a no-op while a sweep is already running", async () => {
        const { factory, seen } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await Promise.all([
            retryPendingCryptoWipes([]),
            retryPendingCryptoWipes([]),
        ]);

        expect(seen).toEqual([
            `${PREFIX}::matrix-sdk-crypto`,
            `${PREFIX}::matrix-sdk-crypto-meta`,
        ]);
    });
});

describe("deleteCryptoStore", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it("records a pending wipe when the delete does not complete", async () => {
        const { factory } = fakeIndexedDB({}, "blocked");
        vi.stubGlobal("indexedDB", factory);

        await deleteCryptoStore("@a:example.org", "DEV1");

        expect(readPendingWipes()).toEqual([pending]);
    });

    it("records nothing when both databases are gone", async () => {
        const { factory } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);

        await deleteCryptoStore("@a:example.org", "DEV1");

        expect(readPendingWipes()).toEqual([]);
    });
});
