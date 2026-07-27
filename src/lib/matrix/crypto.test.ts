import { describe, it, expect, vi, beforeEach } from "vitest";

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

async function loadCryptoModule() {
    const mod = await import("./crypto");
    const client = makeClient();
    h.getClient.mockReturnValue(client);
    // initCrypto flips the module's cryptoAvailable flag.
    await mod.initCrypto(client as never, "@me:example.org", "DEVICE1");
    return mod;
}

describe("ensureRoomCryptoConfigured", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        for (const key of Object.keys(h.roomEncryptors)) {
            delete h.roomEncryptors[key];
        }
        h.onCryptoEvent.mockImplementation(() => Promise.resolve());
        h.initRustCrypto.mockImplementation(() => Promise.resolve());
    });

    it("replays a state-seeded m.room.encryption event through the crypto hook", async () => {
        const mod = await loadCryptoModule();
        const event = { fake: "m.room.encryption event" };
        const room = makeRoom(event);

        await mod.ensureRoomCryptoConfigured(room as never);

        expect(h.onCryptoEvent).toHaveBeenCalledTimes(1);
        expect(h.onCryptoEvent).toHaveBeenCalledWith(room, event);
    });

    it("no-ops when the sync loop already configured the room", async () => {
        const mod = await loadCryptoModule();
        h.roomEncryptors[ROOM_ID] = { alreadyThere: true };

        await mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
    });

    it("no-ops for an unencrypted room", async () => {
        const mod = await loadCryptoModule();

        await mod.ensureRoomCryptoConfigured(makeRoom(null) as never);

        expect(h.onCryptoEvent).not.toHaveBeenCalled();
    });

    it("never throws when the crypto layer rejects the event", async () => {
        const mod = await loadCryptoModule();
        h.onCryptoEvent.mockRejectedValueOnce(new Error("olm machine says no"));

        await expect(
            mod.ensureRoomCryptoConfigured(makeRoom({ e: 1 }) as never),
        ).resolves.toBeUndefined();
    });

    it("no-ops when rust-crypto failed to initialise", async () => {
        const mod = await import("./crypto");
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
        return mod;
    }

    const evt = (id: string) => ({ getId: () => id }) as never;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("reduces the SDK's EventEncryptionInfo to plain numbers", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 2 }),
        );
        const mod = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$a"))).resolves.toEqual({
            colour: 1,
            reason: 2,
        });
    });

    it("returns null when the event is unencrypted or not yet decrypted", async () => {
        const spy = vi.fn(() => Promise.resolve(null));
        const mod = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$b"))).resolves.toBeNull();
    });

    it("never throws when the crypto layer rejects", async () => {
        const spy = vi.fn(() => Promise.reject(new Error("boom")));
        const mod = await bootWithShield(spy);
        await expect(mod.getEventShield(evt("$c"))).resolves.toBeNull();
    });

    it("memoises a real result so a re-render costs no crypto call", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 2, shieldReason: 7 }),
        );
        const mod = await bootWithShield(spy);
        await mod.getEventShield(evt("$d"));
        await mod.getEventShield(evt("$d"));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does NOT memoise null — an undecrypted event must be re-checked", async () => {
        const spy = vi.fn(() => Promise.resolve(null));
        const mod = await bootWithShield(spy);
        await mod.getEventShield(evt("$e"));
        await mod.getEventShield(evt("$e"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("clearEventShieldCache forces a refetch after a trust change", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const mod = await bootWithShield(spy);
        await mod.getEventShield(evt("$f"));
        mod.clearEventShieldCache();
        await mod.getEventShield(evt("$f"));
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("returns null for an event with no id rather than poisoning the cache", async () => {
        const spy = vi.fn(() =>
            Promise.resolve({ shieldColour: 1, shieldReason: 1 }),
        );
        const mod = await bootWithShield(spy);
        await expect(
            mod.getEventShield({ getId: () => undefined } as never),
        ).resolves.toBeNull();
        expect(spy).not.toHaveBeenCalled();
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
