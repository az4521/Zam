import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

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
    // ONE crypto object per client, not a fresh literal per getCrypto() call: a
    // test that stubs a crypto method (see the isEncryptionEnabledInRoom gate
    // test) has to be stubbing the same object the code under test reads, or the
    // assertion is vacuous.
    const cryptoObj: Record<string, unknown> = {
        onCryptoEvent: h.onCryptoEvent,
        roomEncryptors: h.roomEncryptors,
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
