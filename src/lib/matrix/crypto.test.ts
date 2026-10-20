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
import { getCryptoDbName } from "$lib/utils/cryptoStore";

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
    // Returns the release; one per hold so a test can check it ran.
    holdSlidingSyncRoom: vi.fn((_roomId: string) => vi.fn()),
    onCryptoEvent: vi.fn<(room: unknown, event: unknown) => Promise<void>>(() =>
        Promise.resolve(),
    ),
    initRustCrypto: vi.fn(() => Promise.resolve()),
    roomEncryptors: {} as Record<string, unknown>,
    // The account's "encrypt new DMs" preference, read by startUserVerification
    // so a verification DM honours the same default the message UIs use. A
    // getter (below) reads this live, so a test can flip it before importing.
    encryptNewDms: true,
}));

vi.mock("$lib/matrix/client", () => ({
    createDirectMessage: h.createDirectMessage,
    holdSlidingSyncRoom: h.holdSlidingSyncRoom,
}));
vi.mock("$lib/matrix/runtime", () => ({
    getClient: h.getClient,
}));
vi.mock("$lib/stores/settings.svelte", () => ({
    settingsState: {
        get encryptNewDms() {
            return h.encryptNewDms;
        },
    },
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
    // ONE crypto object per client, not a fresh literal per getCrypto() call: a
    // test that stubs a crypto method (see the isEncryptionEnabledInRoom gate
    // test) has to be stubbing the same object the code under test reads, or the
    // assertion is vacuous.
    const cryptoObj: Record<string, unknown> = {
        onCryptoEvent: h.onCryptoEvent,
        roomEncryptors: h.roomEncryptors,
        setDeviceIsolationMode: vi.fn(),
    };
    return {
        initRustCrypto: h.initRustCrypto,
        on: vi.fn(),
        off: vi.fn(),
        getCrypto: () => cryptoObj,
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

    describe("discardRoomSession", () => {
        function withRoom(encrypted: boolean) {
            const client = makeClient() as ReturnType<typeof makeClient> & {
                getRoom?: () => unknown;
            };
            const forceDiscardSession = vi.fn(() => Promise.resolve());
            (
                client.getCrypto() as Record<string, unknown>
            ).forceDiscardSession = forceDiscardSession;
            const event = { fake: "m.room.encryption event" };
            client.getRoom = () => ({
                ...makeRoom(event),
                hasEncryptionStateEvent: () => encrypted,
            });
            h.getClient.mockReturnValue(client);
            return { forceDiscardSession };
        }

        // The SDK's discard is a silent no-op for a room whose encryptor
        // hasn't been built this run, so it is built first.
        it("configures the room, then drops its outgoing key", async () => {
            const { forceDiscardSession } = withRoom(true);
            await mod.discardRoomSession(ROOM_ID);
            expect(h.onCryptoEvent).toHaveBeenCalledTimes(1);
            expect(forceDiscardSession).toHaveBeenCalledWith(ROOM_ID);
        });

        it("refuses an unencrypted room", async () => {
            const { forceDiscardSession } = withRoom(false);
            await expect(mod.discardRoomSession(ROOM_ID)).rejects.toThrow(
                "isn't encrypted",
            );
            expect(forceDiscardSession).not.toHaveBeenCalled();
        });
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
        // Every attempt fails (initCrypto retries a passing failure).
        h.initRustCrypto
            .mockRejectedValueOnce(new Error("no WASM"))
            .mockRejectedValueOnce(new Error("no WASM"))
            .mockRejectedValueOnce(new Error("no WASM"));
        vi.useFakeTimers();
        try {
            const init = mod.initCrypto(
                client as never,
                "@me:example.org",
                "DEVICE1",
            );
            await vi.runAllTimersAsync();
            await init;
        } finally {
            vi.useRealTimers();
        }

        await mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
        expect(mod.isCryptoAvailable()).toBe(false);
    });

    it("retries a crypto start that fails once", async () => {
        const client = makeClient();
        h.getClient.mockReturnValue(client);
        const before = h.initRustCrypto.mock.calls.length;
        h.initRustCrypto.mockRejectedValueOnce(new Error("WASM fetch failed"));
        vi.useFakeTimers();
        try {
            const init = mod.initCrypto(
                client as never,
                "@me:example.org",
                "DEVICE1",
            );
            await vi.runAllTimersAsync();
            await init;
        } finally {
            vi.useRealTimers();
        }

        expect(h.initRustCrypto.mock.calls.length - before).toBe(2);
    });

    // The gate MUST be the in-memory roomEncryptors map, never
    // isEncryptionEnabledInRoom(): the room's algorithm is persisted in the
    // crypto store, so that call answers "yes, encrypted" for a room whose
    // encryptor — rebuilt from sync every session — was never created. Gating on
    // it would skip exactly the rooms that need configuring.
    it("configures a room the crypto store already calls encrypted", async () => {
        const client = makeClient();
        const crypto = client.getCrypto() as unknown as Record<string, unknown>;
        crypto.isEncryptionEnabledInRoom = vi.fn(() => Promise.resolve(true));
        h.getClient.mockReturnValue(client);

        const event = { fake: "m.room.encryption event" };
        await mod.ensureRoomCryptoConfigured(makeRoom(event) as never);

        expect(h.onCryptoEvent).toHaveBeenCalledTimes(1);
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
                setDeviceIsolationMode: vi.fn(),
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

    // MSC4153 isolation is opt-in (it makes messages from non-cross-signed
    // devices undecryptable); the mode is in-memory only in the SDK so
    // initCrypto must apply it every session.
    async function isolationKindAtInit(): Promise<number | undefined> {
        const mod = await import("./crypto");
        const client = makeShieldClient(vi.fn());
        const cryptoApi = client.getCrypto();
        client.getCrypto = () => cryptoApi;
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        const arg = cryptoApi.setDeviceIsolationMode.mock.calls[0]?.[0] as {
            kind: number;
        };
        return arg?.kind;
    }

    it("applies AllDevicesIsolationMode at init by default", async () => {
        expect(await isolationKindAtInit()).toBe(0); // AllDevices
    });

    it("applies OnlySignedDevicesIsolationMode when opted in", async () => {
        const { scopedKey } = await import("$lib/utils/scopedStorage");
        const key = scopedKey(
            "settings:excludeInsecureDevices",
            "@me:example.org",
        );
        localStorage.setItem(key, "true");
        try {
            expect(await isolationKindAtInit()).toBe(1); // OnlySigned
        } finally {
            localStorage.removeItem(key);
        }
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

    // rust-crypto reports our own device as locally trusted straight after
    // sign-in, so isVerified() is true before any verification happened.
    it("own status ignores local trust: a fresh session reads unverified", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(
            makeStatusClient({
                getDeviceVerificationStatus: () =>
                    Promise.resolve({
                        crossSigningVerified: false,
                        signedByOwner: false,
                        isVerified: () => true,
                    }),
            }),
        );
        const { deviceTrust, setupState } =
            await mod.getOwnVerificationStatusInputs();
        expect(setupState).toBe("partial");
        expect(deviceTrust?.isVerified).toBe(false);
    });

    it("own status reads verified once this session is cross-signed", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue(
            makeStatusClient({
                getDeviceVerificationStatus: () =>
                    Promise.resolve({
                        crossSigningVerified: true,
                        signedByOwner: true,
                        isVerified: () => true,
                    }),
            }),
        );
        const { deviceTrust, setupState } =
            await mod.getOwnVerificationStatusInputs();
        expect(setupState).toBe("ready");
        expect(deviceTrust?.isVerified).toBe(true);
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
            getAccountDataFromServer: vi.fn(() => Promise.resolve(null)),
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

    // matrix.org (MAS) has no password to check: the signing-key upload asks
    // for approval on the account page, and is retried once the user says so.
    describe("setupRecovery with account-page approval", () => {
        const url = "https://account.example.org/reset";
        function challenge() {
            return Object.assign(new Error("401"), {
                httpStatus: 401,
                data: {
                    session: "S1",
                    flows: [{ stages: ["m.oauth"] }],
                    params: { "m.oauth": { url } },
                },
            });
        }
        /** Upload that 401s until it has been retried `refusals` times. */
        function uploadingClient(refusals: number) {
            const sent: unknown[] = [];
            const { client } = makeResetClient({
                bootstrapCrossSigning: async (opts: {
                    authUploadDeviceSigningKeys: (
                        make: (auth: unknown) => Promise<void>,
                    ) => Promise<void>;
                }) =>
                    opts.authUploadDeviceSigningKeys(async (auth) => {
                        sent.push(auth);
                        if (auth === null || sent.length <= refusals + 1) {
                            throw challenge();
                        }
                    }),
            });
            return { client, sent };
        }

        it("retries with the stage's session once the user approves", async () => {
            const mod = await import("./crypto");
            const { client, sent } = uploadingClient(0);
            h.getClient.mockReturnValue(client);
            const approve = vi.fn(() => Promise.resolve(true));

            await mod.setupRecovery("", undefined, approve);

            expect(approve).toHaveBeenCalledWith(url, false);
            expect(sent).toEqual([null, { type: "m.oauth", session: "S1" }]);
        });

        it("asks again, flagged as a retry, while the server still refuses", async () => {
            const mod = await import("./crypto");
            const { client } = uploadingClient(1);
            h.getClient.mockReturnValue(client);
            const approve = vi.fn(() => Promise.resolve(true));

            await mod.setupRecovery("", undefined, approve);

            expect(approve.mock.calls).toEqual([
                [url, false],
                [url, true],
            ]);
        });

        it("stops when the user cancels", async () => {
            const mod = await import("./crypto");
            const { client, sent } = uploadingClient(0);
            h.getClient.mockReturnValue(client);

            const error = await mod
                .setupRecovery("", undefined, () => Promise.resolve(false))
                .catch((e) => e);

            expect(error.message).toBe(
                "Approval on your account page was cancelled.",
            );
            expect(sent).toEqual([null]);
        });
    });

    // An earlier reset leaves the cross-signing secrets as `{}` tombstones, and
    // the SDK's plain bootstrap throws "Content is not encrypted!" reading them.
    describe("setupRecovery over deleted cross-signing secrets", () => {
        function tombstoned(privateKeysCachedLocally: boolean) {
            const bootstrapCrossSigning = vi.fn(() => Promise.resolve());
            const { client } = makeResetClient({
                bootstrapCrossSigning,
                getCrossSigningStatus: () =>
                    Promise.resolve({
                        privateKeysCachedLocally: {
                            masterKey: privateKeysCachedLocally,
                            selfSigningKey: privateKeysCachedLocally,
                            userSigningKey: privateKeysCachedLocally,
                        },
                    }),
            });
            client.getAccountDataFromServer.mockImplementation(((
                type: string,
            ) =>
                Promise.resolve(
                    type === "m.cross_signing.master" ? {} : null,
                )) as never);
            return { client, bootstrapCrossSigning };
        }

        it("mints a new identity instead of reading the tombstones", async () => {
            const mod = await import("./crypto");
            const { client, bootstrapCrossSigning } = tombstoned(false);
            h.getClient.mockReturnValue(client);

            await expect(mod.setupRecovery("pw")).resolves.toMatchObject({
                recoveryKey: "EsTNEWKEY",
            });
            expect(bootstrapCrossSigning).toHaveBeenCalledTimes(1);
            expect(bootstrapCrossSigning).toHaveBeenCalledWith(
                expect.objectContaining({ setupNewCrossSigning: true }),
            );
        });

        it("keeps a locally held identity rather than replacing it", async () => {
            const mod = await import("./crypto");
            const { client, bootstrapCrossSigning } = tombstoned(true);
            h.getClient.mockReturnValue(client);

            await mod.setupRecovery("pw");
            // bootstrapSecretStorage exports the local keys into the new 4S.
            expect(bootstrapCrossSigning).not.toHaveBeenCalled();
        });

        it("uses the plain bootstrap when the secrets are intact", async () => {
            const mod = await import("./crypto");
            const bootstrapCrossSigning = vi.fn(() => Promise.resolve());
            const { client } = makeResetClient({ bootstrapCrossSigning });
            client.getAccountDataFromServer.mockResolvedValue({
                encrypted: {},
            } as never);
            h.getClient.mockReturnValue(client);

            await mod.setupRecovery("pw");
            expect(bootstrapCrossSigning).toHaveBeenCalledWith(
                expect.not.objectContaining({ setupNewCrossSigning: true }),
            );
        });
    });

    // Without `setupNewSecretStorage` the SDK keeps an existing default 4S key
    // and never calls `createSecretStorageKey`, so the key we hand the user to
    // save would unlock nothing.
    it("always installs the recovery key it returns", async () => {
        const mod = await import("./crypto");
        const bootstrapSecretStorage = vi.fn(() => Promise.resolve());
        const { client } = makeResetClient({ bootstrapSecretStorage });
        h.getClient.mockReturnValue(client);

        await mod.setupRecovery("pw");
        expect(bootstrapSecretStorage).toHaveBeenCalledWith(
            expect.objectContaining({ setupNewSecretStorage: true }),
        );
    });
});

describe("unlockWithRecoveryKey", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    async function makeUnlockClient(restoreKeyBackup: () => Promise<unknown>) {
        const { encodeRecoveryKey } =
            await import("matrix-js-sdk/lib/crypto-api");
        const calls: string[] = [];
        const crypto = {
            getKeyBackupInfo: vi.fn(() => Promise.resolve({ version: "1" })),
            loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(() =>
                Promise.resolve(),
            ),
            restoreKeyBackup: vi.fn(() => {
                calls.push("restoreKeyBackup");
                return restoreKeyBackup();
            }),
            bootstrapCrossSigning: vi.fn(() => {
                calls.push("bootstrapCrossSigning");
                return Promise.resolve();
            }),
        };
        const client = {
            getCrypto: () => crypto,
            secretStorage: {
                getKey: () => Promise.resolve(["KEYID", {}]),
                checkKey: () => Promise.resolve(true),
            },
        };
        const key = encodeRecoveryKey(new Uint8Array(32)) as string;
        return { client, calls, key };
    }

    // A large backup can take minutes or fail part way; the session must not
    // stay unverified because of it.
    it("cross-signs this session before restoring history", async () => {
        const mod = await import("./crypto");
        const { client, calls, key } = await makeUnlockClient(() =>
            Promise.resolve({ total: 3, imported: 3 }),
        );
        h.getClient.mockReturnValue(client);

        await expect(mod.unlockWithRecoveryKey(key)).resolves.toEqual({
            total: 3,
            imported: 3,
            sessionVerified: true,
        });
        expect(calls).toEqual(["bootstrapCrossSigning", "restoreKeyBackup"]);
    });

    it("still verifies the session when the restore fails", async () => {
        const mod = await import("./crypto");
        const { client, calls, key } = await makeUnlockClient(() =>
            Promise.reject(new Error("network")),
        );
        h.getClient.mockReturnValue(client);

        await expect(mod.unlockWithRecoveryKey(key)).rejects.toThrow("network");
        expect(calls[0]).toBe("bootstrapCrossSigning");
    });
});

// Two OlmMachines on one store corrupt it, so the page must never open the
// store while the push-notification decryptor holds its lock exclusively.
describe("crypto store lock", () => {
    let realLocks: PropertyDescriptor | undefined;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        realLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
    });
    afterEach(() => {
        vi.useRealTimers();
        if (realLocks) Object.defineProperty(navigator, "locks", realLocks);
        else delete (navigator as { locks?: unknown }).locks;
    });

    /** A lock manager whose lock is held elsewhere and never released. */
    function heldElsewhere() {
        const request = vi.fn(
            (_n: string, opts: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    opts.signal?.addEventListener("abort", () =>
                        reject(
                            Object.assign(new Error("aborted"), {
                                name: "AbortError",
                            }),
                        ),
                    );
                }),
        );
        Object.defineProperty(navigator, "locks", {
            value: { request },
            configurable: true,
        });
        return request;
    }

    it("does not open the store if the lock is never granted", async () => {
        vi.useFakeTimers();
        const mod = await import("./crypto");
        heldElsewhere();
        const client = makeClient();
        h.getClient.mockReturnValue(client);

        const init = mod.initCrypto(client as never, "@me:x.org", "DEV");
        await vi.advanceTimersByTimeAsync(31000);
        await init;

        expect(h.initRustCrypto).not.toHaveBeenCalled();
        expect(mod.isCryptoAvailable()).toBe(false);
    });

    it("waits for the lock instead of a timeout before opening the store", async () => {
        vi.useFakeTimers();
        const mod = await import("./crypto");
        let grant: () => void = () => {};
        Object.defineProperty(navigator, "locks", {
            value: {
                request: (_n: string, _o: unknown, cb: () => Promise<never>) =>
                    new Promise((resolve) => {
                        grant = () => resolve(cb());
                    }),
            },
            configurable: true,
        });
        const client = makeClient();
        h.getClient.mockReturnValue(client);

        const init = mod.initCrypto(client as never, "@me:x.org", "DEV");
        await vi.advanceTimersByTimeAsync(20000);
        expect(h.initRustCrypto).not.toHaveBeenCalled();
        grant();
        await init;
        expect(h.initRustCrypto).toHaveBeenCalledTimes(1);
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
    // Fires as the delete is issued, so a test can simulate another tab
    // writing to the record list in the middle of a sweep.
    onDelete?: (name: string) => void,
) {
    const seen: string[] = [];
    const factory = {
        deleteDatabase(name: string) {
            seen.push(name);
            onDelete?.(name);
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

/** A well-formed record: prefix derived from its own ids, as the wipe path
 *  writes it. `pending` above pins the literal that must produce. */
const wipeFor = (userId: string, deviceId: string) => ({
    userId,
    deviceId,
    cryptoDbPrefix: getCryptoDbName(userId, deviceId),
});
const dbsOf = (w: { cryptoDbPrefix: string }) => [
    `${w.cryptoDbPrefix}::matrix-sdk-crypto`,
    `${w.cryptoDbPrefix}::matrix-sdk-crypto-meta`,
];

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

    // "blocked" is not the only way a delete fails to delete: private-mode
    // Firefox REJECTS every deleteDatabase, even for a database that does not
    // exist. Retiring the record on an errored delete would drop the marker
    // while the plaintext key material is still on disk — the exact outcome
    // this module exists to prevent — so only "deleted" may retire it.
    it("KEEPS the record when the deletes are rejected rather than blocked", async () => {
        const { factory, seen } = fakeIndexedDB({}, "error");
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([]);

        // It really tried — this is a kept record, not a skipped one.
        expect(seen).toEqual(dbsOf(pending));
        expect(readPendingWipes()).toEqual([pending]);
    });

    it("KEEPS the record when only one of the two databases could be deleted", async () => {
        // Half a wipe is not a wipe: the meta database still names the store.
        const { factory, seen } = fakeIndexedDB({
            [dbsOf(pending)[1]]: "error",
        });
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([]);

        expect(seen).toEqual(dbsOf(pending));
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

    // The live-session guard matches on user + device, but the delete takes the
    // stored prefix. A record whose prefix does not derive from its own ids
    // aims the irreversible call at a database the guard never looked at —
    // possibly the ACTIVE account's store. It must never be issued.
    it("refuses a record whose prefix does not match its own ids", async () => {
        const { factory, seen } = fakeIndexedDB({});
        vi.stubGlobal("indexedDB", factory);
        const forged = {
            userId: "@a:example.org",
            deviceId: "DEV1",
            cryptoDbPrefix: "matrix-client:%40live%3Aexample.org:LIVE:crypto",
        };
        localStorage.setItem(PENDING_WIPE_KEY, serializePendingWipes([forged]));

        await retryPendingCryptoWipes([]);

        expect(seen).toEqual([]);
        // Skipped, not dropped — the same rule as a live session.
        expect(readPendingWipes()).toEqual([forged]);
    });

    it("sweeps every record, and retires only the device that is really gone", async () => {
        const gone = wipeFor("@a:example.org", "DEV1");
        const stillBlocked = wipeFor("@a:example.org", "DEV2");
        // Blocked record FIRST: a sweep that only ever handles the head of the
        // list would leave the deletable one untouched.
        const { factory, seen } = fakeIndexedDB({
            [dbsOf(stillBlocked)[0]]: "blocked",
        });
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([stillBlocked, gone]),
        );

        await retryPendingCryptoWipes([]);

        expect(seen).toEqual([...dbsOf(stillBlocked), ...dbsOf(gone)]);
        // Same user, different device: retiring DEV1 must not retire DEV2's
        // still-owed wipe.
        expect(readPendingWipes()).toEqual([stillBlocked]);
    });

    it("keeps a record another tab wrote while the sweep was running", async () => {
        const other = wipeFor("@b:example.org", "DEV9");
        let injected = false;
        const { factory } = fakeIndexedDB({}, "success", () => {
            if (injected) return;
            injected = true;
            // Another tab signs out mid-sweep and appends its own record.
            localStorage.setItem(
                PENDING_WIPE_KEY,
                serializePendingWipes([pending, other]),
            );
        });
        vi.stubGlobal("indexedDB", factory);
        localStorage.setItem(
            PENDING_WIPE_KEY,
            serializePendingWipes([pending]),
        );

        await retryPendingCryptoWipes([]);

        // Our finished wipe is retired against the CURRENT list, not the stale
        // copy we started from — the newcomer's key material is still owed.
        expect(readPendingWipes()).toEqual([other]);
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

    // A rejected delete leaves the store exactly as intact as a blocked one
    // does (private-mode Firefox rejects every deleteDatabase), so it has to
    // leave the same marker behind for the next boot.
    it("records a pending wipe when the delete is rejected outright", async () => {
        const { factory } = fakeIndexedDB({}, "error");
        vi.stubGlobal("indexedDB", factory);

        await deleteCryptoStore("@a:example.org", "DEV1");

        expect(readPendingWipes()).toEqual([pending]);
    });

    it("records a pending wipe when only one of the two deletes succeeds", async () => {
        const { factory } = fakeIndexedDB({
            [`${PREFIX}::matrix-sdk-crypto-meta`]: "error",
        });
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

// Sliding sync only gives an unviewed room its newest event per update, so an
// in-room verification holds its DM at full depth until it settles.
describe("verification room hold", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    function inRoomRequest(roomId: string | undefined) {
        const listeners: Array<() => void> = [];
        const request = {
            transactionId: "txn-hold",
            roomId,
            phase: 3, // Ready
            verifier: undefined,
            on: (_event: string, cb: () => void) => listeners.push(cb),
            off: vi.fn(),
            otherPartySupportsMethod: () => true,
            otherUserId: "@them:example.org",
            otherDeviceId: null,
            isSelfVerification: false,
            initiatedByMe: true,
        };
        const change = (phase: number) => {
            request.phase = phase;
            for (const cb of listeners) cb();
        };
        return { request, change };
    }

    async function wrap(request: unknown) {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({
            getCrypto: () => ({
                getVerificationRequestsToDeviceInProgress: () => [],
            }),
        });
        return mod;
    }

    it("holds the DM while the check runs and releases it once done", async () => {
        const { request, change } = inRoomRequest("!dm:example.org");
        const mod = await wrap(request);
        const requestVerificationDM = vi.fn(() => Promise.resolve(request));
        h.getClient.mockReturnValue({
            getCrypto: () => ({ requestVerificationDM }),
        });
        h.createDirectMessage.mockResolvedValue({
            roomId: "!dm:example.org",
            followUp: { status: "ok" },
        });

        await mod.startUserVerification("@them:example.org");

        expect(h.holdSlidingSyncRoom).toHaveBeenCalledWith("!dm:example.org");
        const release = h.holdSlidingSyncRoom.mock.results[0]
            .value as ReturnType<typeof vi.fn>;
        change(4); // Started: still running
        expect(release).not.toHaveBeenCalled();
        change(5); // Cancelled
        expect(release).toHaveBeenCalledTimes(1);
    });

    it("holds nothing for a to-device flow", async () => {
        const { request } = inRoomRequest(undefined);
        const mod = await wrap(request);
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => ({
                getUserDeviceInfo: () =>
                    Promise.resolve(
                        new Map([
                            ["@me:example.org", new Map([["OTHER", {}]])],
                        ]),
                    ),
                requestDeviceVerification: () => Promise.resolve(request),
            }),
        });

        const controller = await mod.startDeviceVerification("OTHER");
        controller.dispose();

        expect(h.holdSlidingSyncRoom).not.toHaveBeenCalled();
    });
});

// getUserDeviceInfo's downloadUncached never re-downloads our OWN list, so a
// session that signed in after our last device_lists update was "Not a known
// device" (reported 2026-10-17). The lookup now queries our own keys first.
describe("startDeviceVerification device lookup", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const known = new Map([["@me:example.org", new Map([["NEW", {}]])]]);
    const unknown = new Map([["@me:example.org", new Map()]]);

    function makeRequest() {
        return {
            transactionId: "txn",
            phase: 2,
            verifier: undefined,
            on: vi.fn(),
            off: vi.fn(),
            otherPartySupportsMethod: () => false,
            otherUserId: "@me:example.org",
            otherDeviceId: "NEW",
            isSelfVerification: true,
            initiatedByMe: true,
        };
    }

    /** RustCrypto stand-in with the internals the targeted query uses. */
    function makeRustCrypto(getUserDeviceInfo: ReturnType<typeof vi.fn>) {
        const ownUserId = { toString: () => "@me:example.org" };
        const keysQuery = { type: "KeysQuery" };
        const queryKeysForUsers = vi.fn(() => keysQuery);
        const makeOutgoingRequest = vi.fn(() => Promise.resolve());
        const markAllTrackedUsersAsDirty = vi.fn(() => Promise.resolve());
        const requestDeviceVerification = vi.fn(() =>
            Promise.resolve(makeRequest()),
        );
        return {
            crypto: {
                getUserDeviceInfo,
                olmMachine: { userId: ownUserId, queryKeysForUsers },
                outgoingRequestProcessor: { makeOutgoingRequest },
                markAllTrackedUsersAsDirty,
                requestDeviceVerification,
            },
            ownUserId,
            keysQuery,
            queryKeysForUsers,
            makeOutgoingRequest,
            markAllTrackedUsersAsDirty,
            requestDeviceVerification,
        };
    }

    it("queries only our own keys when the target isn't known yet", async () => {
        const mod = await import("./crypto");
        const r = makeRustCrypto(
            vi.fn().mockResolvedValueOnce(unknown).mockResolvedValue(known),
        );
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => r.crypto,
        });

        const controller = await mod.startDeviceVerification("NEW");
        controller.dispose();

        expect(r.queryKeysForUsers).toHaveBeenCalledWith([r.ownUserId]);
        expect(r.makeOutgoingRequest).toHaveBeenCalledWith(r.keysQuery);
        // Not everyone we share a room with: that's what made it time out.
        expect(r.markAllTrackedUsersAsDirty).not.toHaveBeenCalled();
        expect(r.requestDeviceVerification).toHaveBeenCalledWith(
            "@me:example.org",
            "NEW",
        );
    });

    it("says the session has no keys when the server has none either", async () => {
        const mod = await import("./crypto");
        const r = makeRustCrypto(vi.fn().mockResolvedValue(unknown));
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => r.crypto,
            downloadKeysForUsers: () =>
                Promise.resolve({
                    device_keys: { "@me:example.org": { OLD: {} } },
                }),
        });

        await expect(mod.startDeviceVerification("NEW")).rejects.toThrow(
            "hasn't published its encryption keys",
        );
        expect(r.requestDeviceVerification).not.toHaveBeenCalled();
    });

    it("says the keys were rejected when the server does have them", async () => {
        const mod = await import("./crypto");
        const r = makeRustCrypto(vi.fn().mockResolvedValue(unknown));
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => r.crypto,
            downloadKeysForUsers: () =>
                Promise.resolve({
                    device_keys: { "@me:example.org": { NEW: {} } },
                }),
        });

        await expect(mod.startDeviceVerification("NEW")).rejects.toThrow(
            "were rejected by this session",
        );
    });

    it("falls back to refreshing every device list without SDK internals", async () => {
        vi.useFakeTimers();
        try {
            const mod = await import("./crypto");
            const markAllTrackedUsersAsDirty = vi.fn(() => Promise.resolve());
            const onSyncCompleted = vi.fn();
            h.getClient.mockReturnValue({
                getUserId: () => "@me:example.org",
                getCrypto: () => ({
                    getUserDeviceInfo: () => Promise.resolve(unknown),
                    markAllTrackedUsersAsDirty,
                    onSyncCompleted,
                    requestDeviceVerification: vi.fn(),
                }),
                downloadKeysForUsers: () =>
                    Promise.reject(new Error("offline")),
            });

            const result = mod.startDeviceVerification("NEW");
            const assertion = expect(result).rejects.toThrow(
                "This session doesn't know about that one yet",
            );
            await vi.runAllTimersAsync();
            await assertion;
            expect(markAllTrackedUsersAsDirty).toHaveBeenCalledTimes(1);
            expect(onSyncCompleted).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("getKnownDevices", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const them = "@them:example.org";
    const devicesOf = (...ids: string[]) =>
        new Map([
            [
                them,
                new Map(
                    ids.map((id) => [
                        id,
                        { deviceId: id, displayName: `${id} phone` },
                    ]),
                ),
            ],
        ]);
    const trust: Record<string, { verified: boolean; signed: boolean }> = {
        A: { verified: true, signed: true },
        B: { verified: false, signed: false },
        C: { verified: false, signed: true },
    };
    const getDeviceVerificationStatus = (_u: string, id: string) =>
        Promise.resolve({
            isVerified: () => trust[id].verified,
            signedByOwner: trust[id].signed,
        });

    it("lists their sessions with trust, without asking the server", async () => {
        const mod = await import("./crypto");
        const queryKeysForUsers = vi.fn();
        const getUserDeviceInfo = vi.fn(() =>
            Promise.resolve(devicesOf("B", "A")),
        );
        h.getClient.mockReturnValue({
            getCrypto: () => ({
                getUserDeviceInfo,
                getDeviceVerificationStatus,
                olmMachine: { userId: {}, queryKeysForUsers },
                outgoingRequestProcessor: { makeOutgoingRequest: vi.fn() },
            }),
        });

        expect(await mod.getKnownDevices(them)).toEqual([
            {
                deviceId: "A",
                displayName: "A phone",
                isVerified: true,
                signedByOwner: true,
                keysChanged: false,
            },
            {
                deviceId: "B",
                displayName: "B phone",
                isVerified: false,
                signedByOwner: false,
                keysChanged: false,
            },
        ]);
        // Downloads the list if we don't track them yet.
        expect(getUserDeviceInfo).toHaveBeenCalledWith([them], true);
        expect(queryKeysForUsers).not.toHaveBeenCalled();
    });

    class FakeUserId {
        constructor(public readonly id: string) {}
    }

    it("re-queries their keys from the server on refresh", async () => {
        vi.doMock("@matrix-org/matrix-sdk-crypto-wasm", () => ({
            UserId: FakeUserId,
        }));
        const mod = await import("./crypto");
        const keysQuery = { type: "KeysQuery" };
        const order: string[] = [];
        const queryKeysForUsers = vi.fn(() => keysQuery);
        const makeOutgoingRequest = vi.fn(() => {
            order.push("query");
            return Promise.resolve();
        });
        h.getClient.mockReturnValue({
            getCrypto: () => ({
                getUserDeviceInfo: vi.fn(() => {
                    order.push("list");
                    return Promise.resolve(devicesOf("A", "C"));
                }),
                getDeviceVerificationStatus,
                olmMachine: { userId: {}, queryKeysForUsers },
                outgoingRequestProcessor: { makeOutgoingRequest },
            }),
        });

        const list = await mod.getKnownDevices(them, { refresh: true });

        expect(queryKeysForUsers).toHaveBeenCalledWith([new FakeUserId(them)]);
        expect(makeOutgoingRequest).toHaveBeenCalledWith(keysQuery);
        expect(order).toEqual(["query", "list"]);
        expect(list?.map((d) => d.deviceId)).toEqual(["A", "C"]);
        vi.doUnmock("@matrix-org/matrix-sdk-crypto-wasm");
    });

    // An untracked user's list is downloaded but not stored, so their trust
    // can't be read until a keys query stores it.
    it("queries their keys when their trust isn't in the store", async () => {
        vi.doMock("@matrix-org/matrix-sdk-crypto-wasm", () => ({
            UserId: FakeUserId,
        }));
        const mod = await import("./crypto");
        let stored = false;
        const makeOutgoingRequest = vi.fn(() => {
            stored = true;
            return Promise.resolve();
        });
        h.getClient.mockReturnValue({
            getCrypto: () => ({
                getUserDeviceInfo: () => Promise.resolve(devicesOf("C")),
                getDeviceVerificationStatus: (u: string, id: string) =>
                    stored
                        ? getDeviceVerificationStatus(u, id)
                        : Promise.resolve(null),
                olmMachine: { userId: {}, queryKeysForUsers: vi.fn() },
                outgoingRequestProcessor: { makeOutgoingRequest },
            }),
        });

        const list = await mod.getKnownDevices(them);

        expect(makeOutgoingRequest).toHaveBeenCalledTimes(1);
        expect(list?.[0].signedByOwner).toBe(true);
        vi.doUnmock("@matrix-org/matrix-sdk-crypto-wasm");
    });

    it("is null when crypto isn't ready", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({ getCrypto: () => undefined });
        expect(await mod.getKnownDevices(them)).toBeNull();
    });

    // The crypto engine never takes new identity keys for a session it
    // already knows, so a session that re-keyed under the same id can't read
    // anything we send. Compared against the server's copy directly.
    it("flags a session whose keys changed on the server", async () => {
        const mod = await import("./crypto");
        const device = (id: string, curve: string) => ({
            deviceId: id,
            displayName: null,
            getIdentityKey: () => curve,
            getFingerprint: () => `ed-${id}`,
        });
        h.getClient.mockReturnValue({
            getCrypto: () => ({
                getUserDeviceInfo: () =>
                    Promise.resolve(
                        new Map([
                            [
                                them,
                                new Map([
                                    ["A", device("A", "oldCurve")],
                                    ["C", device("C", "sameCurve")],
                                ]),
                            ],
                        ]),
                    ),
                getDeviceVerificationStatus,
            }),
            downloadKeysForUsers: () =>
                Promise.resolve({
                    device_keys: {
                        [them]: {
                            A: {
                                keys: {
                                    "curve25519:A": "newCurve",
                                    "ed25519:A": "ed-A",
                                },
                            },
                            C: {
                                keys: {
                                    "curve25519:C": "sameCurve",
                                    "ed25519:C": "ed-C",
                                },
                            },
                        },
                    },
                }),
        });

        const list = await mod.getKnownDevices(them);

        expect(list?.map((d) => [d.deviceId, d.keysChanged])).toEqual([
            ["A", true],
            ["C", false],
        ]);
    });
});

describe("ownDeviceKeysReplaced", () => {
    let mod: typeof import("./crypto");

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        h.initRustCrypto.mockImplementation(() => Promise.resolve());
        mod = await import("./crypto");
    });

    async function withServerKeys(server: Record<string, string> | null) {
        const client = {
            ...makeClient(),
            getUserId: () => "@me:example.org",
            getDeviceId: () => "DEVICE1",
            downloadKeysForUsers: () =>
                Promise.resolve({
                    device_keys: {
                        "@me:example.org": server
                            ? { DEVICE1: { keys: server } }
                            : {},
                    },
                }),
        };
        (client.getCrypto() as Record<string, unknown>).getOwnDeviceKeys = () =>
            Promise.resolve({ curve25519: "freshCurve", ed25519: "freshEd" });
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        return client;
    }

    it("is true when the server has another store's keys for this device", async () => {
        const client = await withServerKeys({
            "curve25519:DEVICE1": "lostCurve",
            "ed25519:DEVICE1": "lostEd",
        });
        expect(await mod.ownDeviceKeysReplaced(client as never)).toBe(true);
    });

    it("is false when the server has our own keys", async () => {
        const client = await withServerKeys({
            "curve25519:DEVICE1": "freshCurve",
            "ed25519:DEVICE1": "freshEd",
        });
        expect(await mod.ownDeviceKeysReplaced(client as never)).toBe(false);
    });

    // A new sign-in: nothing uploaded yet.
    it("is false when the server has no keys for this device", async () => {
        const client = await withServerKeys(null);
        expect(await mod.ownDeviceKeysReplaced(client as never)).toBe(false);
    });
});

describe("requestOwnVerification", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    function makeOwnRequest() {
        return {
            transactionId: "txn-own",
            phase: 2, // Requested: broadcast, nobody has answered yet
            verifier: undefined,
            on: vi.fn(),
            off: vi.fn(),
            otherPartySupportsMethod: () => false,
            otherUserId: "@me:example.org",
            otherDeviceId: undefined,
            isSelfVerification: true,
            initiatedByMe: true,
        };
    }

    it("refreshes our device list, then broadcasts to all our sessions", async () => {
        const calls: string[] = [];
        const getUserDeviceInfo = vi.fn(() => {
            calls.push("getUserDeviceInfo");
            return Promise.resolve(new Map());
        });
        const requestOwnUserVerification = vi.fn(() => {
            calls.push("requestOwnUserVerification");
            return Promise.resolve(makeOwnRequest());
        });
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => ({
                getUserDeviceInfo,
                requestOwnUserVerification,
            }),
        });

        const controller = await mod.requestOwnVerification();

        expect(getUserDeviceInfo).toHaveBeenCalledWith(
            ["@me:example.org"],
            true,
        );
        expect(calls).toEqual([
            "getUserDeviceInfo",
            "requestOwnUserVerification",
        ]);
        expect(controller.id).toBe("txn-own");
        const view = controller.view();
        expect(view.isSelfVerification).toBe(true);
        // No target device: any sibling may answer.
        expect(view.otherDeviceId).toBeNull();
        controller.dispose();
    });

    it("throws when crypto isn't ready", async () => {
        const mod = await import("./crypto");
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => undefined,
        });

        await expect(mod.requestOwnVerification()).rejects.toThrow();
    });
});

describe("startUserVerification", () => {
    // Minimal VerificationRequest stand-in: only what createVerificationController
    // touches while wrapping it (it calls advance() once, synchronously).
    function makeRequest() {
        return {
            transactionId: "txn-1",
            phase: 1,
            verifier: undefined,
            on: vi.fn(),
            otherPartySupportsMethod: () => false,
            otherUserId: "@them:example.org",
            otherDeviceId: null,
            isSelfVerification: false,
            initiatedByMe: true,
        };
    }

    function makeVerificationClient(
        requestVerificationDM: ReturnType<typeof vi.fn>,
    ) {
        return {
            initRustCrypto: h.initRustCrypto,
            on: vi.fn(),
            off: vi.fn(),
            getCrypto: () => ({
                onCryptoEvent: h.onCryptoEvent,
                roomEncryptors: h.roomEncryptors,
                requestVerificationDM,
            }),
        };
    }

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    // The room id, not the whole creation result: createDirectMessage returns
    // `{roomId, followUp}` since TX-01, and handing that object to the SDK would
    // silently start verification against a bogus room.
    it("passes the created room's id to requestVerificationDM", async () => {
        const requestVerificationDM = vi.fn(() =>
            Promise.resolve(makeRequest()),
        );
        const mod = await import("./crypto");
        const client = makeVerificationClient(requestVerificationDM);
        h.getClient.mockReturnValue(client);
        h.createDirectMessage.mockResolvedValue({
            roomId: "!dm:example.org",
            followUp: { status: "ok" },
        });

        const controller = await mod.startUserVerification("@them:example.org");

        expect(requestVerificationDM).toHaveBeenCalledWith(
            "@them:example.org",
            "!dm:example.org",
        );
        expect(controller.id).toBe("txn-1");
    });

    // The DM verification rides in becomes the CANONICAL DM with this contact
    // (createDirectMessage dedupes on account+contact). With "encrypt new DMs"
    // on, it must be created encrypted — otherwise a later plain "Message" click
    // reuses a plaintext room the setting promised to encrypt, and encryption
    // cannot be added after the fact. The spec does not require the verification
    // channel itself to be encrypted (SAS is secure over cleartext); this is
    // about the room the user is left chatting in.
    it("creates the verification DM encrypted when the account default applies", async () => {
        h.encryptNewDms = true;
        const requestVerificationDM = vi.fn(() =>
            Promise.resolve(makeRequest()),
        );
        const mod = await import("./crypto");
        const client = makeVerificationClient(requestVerificationDM);
        h.getClient.mockReturnValue(client);
        h.createDirectMessage.mockResolvedValue({
            roomId: "!dm:example.org",
            followUp: { status: "ok" },
        });
        // Initialize crypto so isCryptoAvailable() returns true
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");

        await mod.startUserVerification("@them:example.org");

        expect(h.createDirectMessage).toHaveBeenCalledWith(
            "@them:example.org",
            true,
        );
    });

    it("creates the verification DM unencrypted when the user opted out", async () => {
        h.encryptNewDms = false;
        const requestVerificationDM = vi.fn(() =>
            Promise.resolve(makeRequest()),
        );
        const mod = await import("./crypto");
        const client = makeVerificationClient(requestVerificationDM);
        h.getClient.mockReturnValue(client);
        h.createDirectMessage.mockResolvedValue({
            roomId: "!dm:example.org",
            followUp: { status: "ok" },
        });
        // Initialize crypto so isCryptoAvailable() returns true
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");

        await mod.startUserVerification("@them:example.org");

        expect(h.createDirectMessage).toHaveBeenCalledWith(
            "@them:example.org",
            false,
        );
    });

    // A failed m.direct write leaves the room unfiled, not unusable — the
    // verification must still start in it rather than being reported as a
    // failed creation (which is what makes the user create a duplicate DM).
    it("still starts verification when the m.direct follow-up failed", async () => {
        const requestVerificationDM = vi.fn(() =>
            Promise.resolve(makeRequest()),
        );
        const mod = await import("./crypto");
        const client = makeVerificationClient(requestVerificationDM);
        h.getClient.mockReturnValue(client);
        h.createDirectMessage.mockResolvedValue({
            roomId: "!dm:example.org",
            followUp: {
                status: "failed",
                task: {
                    kind: "dm-account-data",
                    roomId: "!dm:example.org",
                    userId: "@them:example.org",
                },
                message: "The direct message was created, but…",
            },
        });

        await expect(
            mod.startUserVerification("@them:example.org"),
        ).resolves.toBeTruthy();
        expect(requestVerificationDM).toHaveBeenCalledWith(
            "@them:example.org",
            "!dm:example.org",
        );
    });
});

// MSC4153: a changed cross-signing identity must raise an alert.
describe("refreshIdentityAlert", () => {
    const status = (over: Record<string, unknown>) => ({
        known: true,
        needsUserApproval: false,
        isVerified: () => false,
        wasCrossSigningVerified: () => false,
        ...over,
    });
    async function run(userId: string, st: unknown) {
        vi.resetModules();
        h.getClient.mockReturnValue({
            getUserId: () => "@me:example.org",
            getCrypto: () => ({ getUserVerificationStatus: async () => st }),
        });
        const mod = await import("./crypto");
        const store = await import("$lib/stores/identityAlerts.svelte");
        await mod.refreshIdentityAlert(userId);
        return store.identityAlertState.alerts;
    }

    it("alerts when another user's identity needs approval", async () => {
        const alerts = await run(
            "@bob:example.org",
            status({ needsUserApproval: true }),
        );
        expect(alerts).toEqual([
            { userId: "@bob:example.org", own: false, wasVerified: false },
        ]);
    });

    it("alerts when our own verified identity is replaced", async () => {
        const alerts = await run(
            "@me:example.org",
            status({ wasCrossSigningVerified: () => true }),
        );
        expect(alerts[0]).toMatchObject({ own: true, wasVerified: true });
    });

    it("raises nothing for an unchanged identity", async () => {
        expect(await run("@bob:example.org", status({}))).toEqual([]);
    });
});

describe("restartCrypto", () => {
    // Mirrors what matrix-js-sdk's initRustCrypto does to the client: refuses
    // while an engine exists, else installs one and binds three client events
    // to it. Each engine records whether it was called after being replaced.
    function makeRestartableClient() {
        const listeners = new Map<string, ((...a: unknown[]) => void)[]>();
        const engines: { id: number; calls: number }[] = [];
        const client = {
            cryptoBackend: undefined as unknown,
            listeners: (e: string) => [...(listeners.get(e) ?? [])],
            on: (e: string, l: (...a: unknown[]) => void) => {
                listeners.set(e, [...(listeners.get(e) ?? []), l]);
            },
            off: (e: string, l: (...a: unknown[]) => void) => {
                listeners.set(
                    e,
                    (listeners.get(e) ?? []).filter((x) => x !== l),
                );
            },
            emit: (e: string) => {
                for (const l of listeners.get(e) ?? []) l();
            },
            getCrypto: () =>
                client.cryptoBackend
                    ? { setDeviceIsolationMode: vi.fn() }
                    : undefined,
            initRustCrypto: vi.fn(async () => {
                if (client.cryptoBackend) return; // the SDK just warns
                const engine = { id: engines.length, calls: 0 };
                engines.push(engine);
                client.cryptoBackend = engine;
                for (const e of [
                    "RoomMember.membership",
                    "RoomState.events",
                    "event",
                ])
                    client.on(e, () => engine.calls++);
            }),
        };
        return { client, engines };
    }

    let mod: typeof import("./crypto");
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        mod = await import("./crypto");
    });

    it("swaps the engine and its client handlers, leaving none on the old one", async () => {
        const { client, engines } = makeRestartableClient();
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        expect(engines).toHaveLength(1);

        const ok = await mod.restartCrypto(
            client as never,
            "@me:example.org",
            "DEVICE1",
        );

        expect(ok).toBe(true);
        expect(engines).toHaveLength(2);
        for (const e of [
            "RoomMember.membership",
            "RoomState.events",
            "event",
        ]) {
            expect(client.listeners(e)).toHaveLength(1);
            client.emit(e);
        }
        expect(engines[0].calls).toBe(0); // the closed engine is never called
        expect(engines[1].calls).toBe(3);
    });

    it("reports failure when the new engine won't start", async () => {
        const { client } = makeRestartableClient();
        h.getClient.mockReturnValue(client);
        await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
        client.initRustCrypto
            .mockRejectedValueOnce(new Error("no WASM"))
            .mockRejectedValueOnce(new Error("no WASM"))
            .mockRejectedValueOnce(new Error("no WASM"));

        vi.useFakeTimers();
        try {
            const restarted = mod.restartCrypto(
                client as never,
                "@me:example.org",
                "DEVICE1",
            );
            await vi.runAllTimersAsync();
            expect(await restarted).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});

// A device that ran out of space: the crypto store refused its writes, so
// rust-crypto never came up and no device keys were published. That must be
// said (sessionHealth + storageHealth), and must leave nothing behind that
// stops the next launch, with space again, from starting crypto on this
// device and uploading its keys rather than signing the device out.
describe("crypto start on a full disk", () => {
    const quotaError = () =>
        new DOMException("The quota has been exceeded.", "QuotaExceededError");

    // Like matrix-js-sdk: initRustCrypto only sets the engine once it has
    // come up, and the server has no keys for a device that never had any.
    function makeClient() {
        const client = {
            cryptoBackend: undefined as unknown,
            on: vi.fn(),
            off: vi.fn(),
            getUserId: () => "@me:example.org",
            getDeviceId: () => "DEVICE1",
            downloadKeysForUsers: vi.fn(() =>
                Promise.resolve({ device_keys: { "@me:example.org": {} } }),
            ),
            getCrypto: () => client.cryptoBackend,
            initRustCrypto: vi.fn(async () => {
                if (client.cryptoBackend) return;
                client.cryptoBackend = {
                    setDeviceIsolationMode: vi.fn(),
                    getOwnDeviceKeys: () =>
                        Promise.resolve({ curve25519: "c", ed25519: "e" }),
                };
            }),
        };
        return client;
    }

    // A fresh page: new module instances of crypto and both health stores.
    async function freshPage() {
        vi.resetModules();
        return {
            mod: await import("./crypto"),
            health: await import("$lib/stores/sessionHealth.svelte"),
            storage: await import("$lib/stores/storageHealth.svelte"),
        };
    }

    // initCrypto's retries wait on setTimeout, which is faked; nothing else
    // is, so its lazy import of the crypto WASM still completes. The clock is
    // stepped until init settles, whenever it reaches the retries.
    async function initWithTimers(
        mod: typeof import("./crypto"),
        client: ReturnType<typeof makeClient>,
    ) {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
            let settled = false;
            const init = mod
                .initCrypto(client as never, "@me:example.org", "DEVICE1")
                .finally(() => (settled = true));
            while (!settled) {
                await vi.advanceTimersByTimeAsync(1000);
                await new Promise((r) => setImmediate(r));
            }
            await init;
        } finally {
            vi.useRealTimers();
        }
    }

    // Re-importing the crypto module graph is slow on a loaded run (the
    // whole suite in parallel), so the first page loads in the hook and both
    // get room for the second.
    const SLOW_IMPORT_MS = 30_000;
    let page: Awaited<ReturnType<typeof freshPage>>;
    beforeEach(async () => {
        vi.clearAllMocks();
        page = await freshPage();
    }, SLOW_IMPORT_MS);

    it(
        "reports encryption off for lack of space, and the next launch starts it",
        async () => {
            // First launch: every attempt hits the full disk.
            let { mod, health, storage } = page;
            let client = makeClient();
            h.getClient.mockReturnValue(client);
            client.initRustCrypto.mockRejectedValue(quotaError());
            await initWithTimers(mod, client);

            expect(mod.isCryptoAvailable()).toBe(false);
            expect(client.getCrypto()).toBeUndefined();
            expect(mod.getCryptoInitError()).toMatch(/QuotaExceededError/);
            expect(health.sessionHealthState.cryptoAvailable).toBe(false);
            expect(health.sessionHealthState.cryptoFailureKind).toBe("storage");
            expect(storage.storageHealthState.full).toBe(true);
            // Nothing came up, so nothing to compare: never a reason to sign out.
            expect(await mod.ownDeviceKeysReplaced(client as never)).toBe(
                false,
            );

            // Next launch, with space: a fresh page and a fresh client.
            ({ mod, health, storage } = await freshPage());
            expect(storage.storageHealthState.full).toBe(false);
            client = makeClient();
            h.getClient.mockReturnValue(client);
            await initWithTimers(mod, client);

            expect(client.initRustCrypto).toHaveBeenCalledTimes(1);
            expect(mod.isCryptoAvailable()).toBe(true);
            expect(mod.getCryptoInitError()).toBeNull();
            expect(health.sessionHealthState.cryptoFailureKind).toBeNull();
            // The server has no keys for this device: boot keeps the device and
            // the first sync uploads the new engine's keys.
            expect(await mod.ownDeviceKeysReplaced(client as never)).toBe(
                false,
            );
            expect(client.downloadKeysForUsers).toHaveBeenCalled();
        },
        SLOW_IMPORT_MS,
    );

    it(
        "starts in place once space is back (restartCrypto)",
        async () => {
            const { mod } = page;
            const client = makeClient();
            h.getClient.mockReturnValue(client);
            client.initRustCrypto
                .mockRejectedValueOnce(quotaError())
                .mockRejectedValueOnce(quotaError())
                .mockRejectedValueOnce(quotaError());
            await initWithTimers(mod, client);
            expect(mod.isCryptoAvailable()).toBe(false);

            // The failed start left no engine or lock behind to refuse this.
            const ok = await mod.restartCrypto(
                client as never,
                "@me:example.org",
                "DEVICE1",
            );
            expect(ok).toBe(true);
            expect(mod.isCryptoAvailable()).toBe(true);
            expect(mod.getCryptoInitError()).toBeNull();
        },
        SLOW_IMPORT_MS,
    );
});
