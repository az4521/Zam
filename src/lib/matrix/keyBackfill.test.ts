import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

const h = vi.hoisted(() => ({
    blocked: new Set<string>(),
    scoped: new Map<string, string>(),
}));

vi.mock("$lib/stores/ignoredUsers.svelte", () => ({
    isUserBlocked: (id: string) => h.blocked.has(id),
}));
vi.mock("$lib/utils/scopedStorage", () => ({
    readScoped: (key: string) => h.scoped.get(key) ?? null,
}));

import {
    answerRefusal,
    responseRefusal,
    createRateLimit,
    attachKeyBackfill,
    KEY_REQUEST_TYPE,
    KEY_RESPONSE_TYPE,
    REQUEST_DELAY_MS,
} from "./keyBackfill";

const ok = {
    fromKnownDevice: true,
    requesterBlocked: false,
    requesterJoined: true,
    historyVisibility: "shared",
    ownKey: true,
    deviceAllowed: true,
};

describe("answerRefusal", () => {
    it("re-sends to a joined member of a shared-history room", () => {
        expect(answerRefusal(ok)).toBeNull();
        expect(
            answerRefusal({ ...ok, historyVisibility: "world_readable" }),
        ).toBeNull();
    });

    // The export starts at the key's first message: someone who joined later
    // must not get messages from before they joined.
    it.each(["joined", "invited", null])(
        "refuses when history visibility is %s",
        (historyVisibility) => {
            expect(answerRefusal({ ...ok, historyVisibility })).toMatch(
                /history visibility/,
            );
        },
    );

    it.each([
        ["fromKnownDevice", false],
        ["requesterBlocked", true],
        ["requesterJoined", false],
        ["ownKey", false],
        ["deviceAllowed", false],
    ] as const)("refuses when %s is %s", (field, value) => {
        expect(answerRefusal({ ...ok, [field]: value })).not.toBeNull();
    });
});

describe("responseRefusal", () => {
    const asked = { roomId: "!r", sender: "@alice:x" };
    const good = {
        asked,
        roomId: "!r",
        fromUser: "@alice:x",
        fromDevice: "ALICEDEV",
        fromCurve25519: "aliceCurve",
        key: { session_id: "S1", room_id: "!r", sender_key: "aliceCurve" },
        sessionId: "S1",
    };

    it("accepts the key we asked for, from the device that made it", () => {
        expect(responseRefusal(good)).toBeNull();
    });

    it("refuses a key we never asked for", () => {
        expect(responseRefusal({ ...good, asked: undefined })).toMatch(
            /didn't ask|not a key we asked/,
        );
    });

    it("refuses a key from someone other than the sender", () => {
        expect(responseRefusal({ ...good, fromUser: "@mallory:x" })).toMatch(
            /sender we asked/,
        );
    });

    // Another device of the same user can't hand us a session it didn't
    // create: that would let it impersonate the creating device.
    it("refuses a key created by a different device", () => {
        expect(
            responseRefusal({ ...good, fromCurve25519: "otherCurve" }),
        ).toMatch(/not created by the device/);
    });

    it("refuses a key for another session or room", () => {
        expect(
            responseRefusal({
                ...good,
                key: { ...good.key, session_id: "S2" },
            }),
        ).toMatch(/session id/);
        expect(
            responseRefusal({ ...good, key: { ...good.key, room_id: "!x" } }),
        ).toMatch(/room/);
    });

    it("refuses a message from an unknown device", () => {
        expect(responseRefusal({ ...good, fromDevice: undefined })).toMatch(
            /known device/,
        );
    });
});

describe("createRateLimit", () => {
    it("allows N per minute", () => {
        let now = 0;
        const allow = createRateLimit(2, () => now);
        expect(allow()).toBe(true);
        expect(allow()).toBe(true);
        expect(allow()).toBe(false);
        now = 60_000;
        expect(allow()).toBe(true);
    });
});

/** A client stand-in with just what the backfill touches. */
function makeClient(opts: {
    userId: string;
    deviceId: string;
    curve25519: string;
    room?: {
        members: Record<string, string>;
        historyVisibility: string;
    };
    sessions?: {
        sessionId: string;
        roomId: string;
        senderKey: string;
        imported?: boolean;
    }[];
}) {
    const emitter = new EventEmitter();
    const queueToDevice = vi.fn(() => Promise.resolve());
    const importRoomKeys = vi.fn(() => Promise.resolve());
    const encryptToDeviceMessages = vi.fn(
        (
            type: string,
            devices: { userId: string; deviceId: string }[],
            payload: object,
        ) =>
            Promise.resolve({
                eventType: "m.room.encrypted",
                batch: devices.map((d) => ({
                    ...d,
                    payload: { type, payload },
                })),
            }),
    );
    const crypto = {
        globalBlacklistUnverifiedDevices: false,
        getOwnDeviceKeys: () =>
            Promise.resolve({ ed25519: "e", curve25519: opts.curve25519 }),
        getUserDeviceInfo: (users: string[]) =>
            Promise.resolve(
                new Map(users.map((u) => [u, new Map([["DEV", {}]])])),
            ),
        getDeviceVerificationStatus: () =>
            Promise.resolve({ isVerified: () => false, signedByOwner: true }),
        encryptToDeviceMessages,
        importRoomKeys,
        olmMachine: {
            exportRoomKeys: async (
                predicate: (s: {
                    sessionId: string;
                    roomId: { toString(): string };
                    senderKey: { toBase64(): string };
                    hasBeenImported(): boolean;
                }) => boolean,
            ) =>
                JSON.stringify(
                    (opts.sessions ?? [])
                        .filter((s) =>
                            predicate({
                                sessionId: s.sessionId,
                                roomId: { toString: () => s.roomId },
                                senderKey: { toBase64: () => s.senderKey },
                                hasBeenImported: () => !!s.imported,
                            }),
                        )
                        .map((s) => ({
                            session_id: s.sessionId,
                            room_id: s.roomId,
                            sender_key: s.senderKey,
                        })),
                ),
        },
    };
    const room = opts.room && {
        getMember: (id: string) =>
            opts.room!.members[id]
                ? { membership: opts.room!.members[id] }
                : null,
        getHistoryVisibility: () => opts.room!.historyVisibility,
    };
    const client = Object.assign(emitter, {
        getCrypto: () => crypto,
        getUserId: () => opts.userId,
        getDeviceId: () => opts.deviceId,
        getRoom: () => room ?? null,
        queueToDevice,
    });
    return { client, crypto, queueToDevice, importRoomKeys };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("attachKeyBackfill: answering", () => {
    beforeEach(() => {
        h.blocked.clear();
        h.scoped.clear();
    });

    const request = (
        sender = "@bob:x",
        device: string | undefined = "BOB",
    ) => ({
        message: {
            type: KEY_REQUEST_TYPE,
            content: { room_id: "!r", session_id: "S1" },
        },
        encryptionInfo: {
            sender,
            senderDevice: device,
            senderCurve25519KeyBase64: "bobCurve",
            senderVerified: false,
        },
    });

    it("re-sends a key this session created to a member who asks", async () => {
        const c = makeClient({
            userId: "@alice:x",
            deviceId: "ALICE",
            curve25519: "aliceCurve",
            room: {
                members: { "@bob:x": "join" },
                historyVisibility: "shared",
            },
            sessions: [
                { sessionId: "S1", roomId: "!r", senderKey: "aliceCurve" },
            ],
        });
        const detach = attachKeyBackfill(c.client as never);
        c.client.emit("receivedToDeviceMessage", request());
        await flush();
        detach();

        expect(c.crypto.encryptToDeviceMessages).toHaveBeenCalledWith(
            KEY_RESPONSE_TYPE,
            [{ userId: "@bob:x", deviceId: "BOB" }],
            {
                room_id: "!r",
                session_id: "S1",
                key: {
                    session_id: "S1",
                    room_id: "!r",
                    sender_key: "aliceCurve",
                },
            },
        );
        expect(c.queueToDevice).toHaveBeenCalledTimes(1);
    });

    it("doesn't re-send a key some other session created", async () => {
        const c = makeClient({
            userId: "@alice:x",
            deviceId: "ALICE",
            curve25519: "aliceCurve",
            room: {
                members: { "@bob:x": "join" },
                historyVisibility: "shared",
            },
            sessions: [
                { sessionId: "S1", roomId: "!r", senderKey: "carolCurve" },
            ],
        });
        const detach = attachKeyBackfill(c.client as never);
        c.client.emit("receivedToDeviceMessage", request());
        await flush();
        detach();
        expect(c.queueToDevice).not.toHaveBeenCalled();
    });

    it("doesn't answer someone who isn't in the room", async () => {
        const c = makeClient({
            userId: "@alice:x",
            deviceId: "ALICE",
            curve25519: "aliceCurve",
            room: {
                members: { "@bob:x": "leave" },
                historyVisibility: "shared",
            },
            sessions: [
                { sessionId: "S1", roomId: "!r", senderKey: "aliceCurve" },
            ],
        });
        const detach = attachKeyBackfill(c.client as never);
        c.client.emit("receivedToDeviceMessage", request());
        await flush();
        detach();
        expect(c.queueToDevice).not.toHaveBeenCalled();
    });

    it("ignores an unencrypted request", async () => {
        const c = makeClient({
            userId: "@alice:x",
            deviceId: "ALICE",
            curve25519: "aliceCurve",
            room: {
                members: { "@bob:x": "join" },
                historyVisibility: "shared",
            },
            sessions: [
                { sessionId: "S1", roomId: "!r", senderKey: "aliceCurve" },
            ],
        });
        const detach = attachKeyBackfill(c.client as never);
        c.client.emit("receivedToDeviceMessage", {
            ...request(),
            encryptionInfo: null,
        });
        await flush();
        detach();
        expect(c.queueToDevice).not.toHaveBeenCalled();
    });
});

describe("attachKeyBackfill: asking", () => {
    afterEach(() => vi.useRealTimers());

    function utd(sessionId = "S1") {
        let failed = true;
        return {
            event: {
                isDecryptionFailure: () => failed,
                decryptionFailureReason: "MEGOLM_UNKNOWN_INBOUND_SESSION_ID",
                getWireContent: () => ({ session_id: sessionId }),
                getRoomId: () => "!r",
                getSender: () => "@alice:x",
                attemptDecryption: vi.fn(() => {
                    failed = false;
                    return Promise.resolve();
                }),
            },
            arrive: () => {
                failed = false;
            },
        };
    }

    it("asks the sender, then imports the key they send back", async () => {
        vi.useFakeTimers();
        const c = makeClient({
            userId: "@bob:x",
            deviceId: "BOB",
            curve25519: "bobCurve",
        });
        const detach = attachKeyBackfill(c.client as never);
        const { event } = utd();
        c.client.emit("Event.decrypted", event);
        await vi.advanceTimersByTimeAsync(REQUEST_DELAY_MS);

        expect(c.crypto.encryptToDeviceMessages).toHaveBeenCalledWith(
            KEY_REQUEST_TYPE,
            [{ userId: "@alice:x", deviceId: "DEV" }],
            { room_id: "!r", session_id: "S1" },
        );

        const key = {
            session_id: "S1",
            room_id: "!r",
            sender_key: "aliceCurve",
        };
        c.client.emit("receivedToDeviceMessage", {
            message: {
                type: KEY_RESPONSE_TYPE,
                content: { room_id: "!r", session_id: "S1", key },
            },
            encryptionInfo: {
                sender: "@alice:x",
                senderDevice: "DEV",
                senderCurve25519KeyBase64: "aliceCurve",
                senderVerified: false,
            },
        });
        await vi.advanceTimersByTimeAsync(0);
        detach();

        expect(c.importRoomKeys).toHaveBeenCalledWith([key]);
        expect(event.attemptDecryption).toHaveBeenCalled();
    });

    it("doesn't ask when the key arrives on its own meanwhile", async () => {
        vi.useFakeTimers();
        const c = makeClient({
            userId: "@bob:x",
            deviceId: "BOB",
            curve25519: "bobCurve",
        });
        const detach = attachKeyBackfill(c.client as never);
        const { event, arrive } = utd();
        c.client.emit("Event.decrypted", event);
        arrive();
        await vi.advanceTimersByTimeAsync(REQUEST_DELAY_MS);
        detach();
        expect(c.crypto.encryptToDeviceMessages).not.toHaveBeenCalled();
    });

    it("asks once per session, however many messages use it", async () => {
        vi.useFakeTimers();
        const c = makeClient({
            userId: "@bob:x",
            deviceId: "BOB",
            curve25519: "bobCurve",
        });
        const detach = attachKeyBackfill(c.client as never);
        for (let i = 0; i < 5; i++)
            c.client.emit("Event.decrypted", utd().event);
        await vi.advanceTimersByTimeAsync(REQUEST_DELAY_MS);
        detach();
        expect(c.crypto.encryptToDeviceMessages).toHaveBeenCalledTimes(1);
    });

    it("ignores an unasked-for key", async () => {
        const c = makeClient({
            userId: "@bob:x",
            deviceId: "BOB",
            curve25519: "bobCurve",
        });
        const detach = attachKeyBackfill(c.client as never);
        c.client.emit("receivedToDeviceMessage", {
            message: {
                type: KEY_RESPONSE_TYPE,
                content: {
                    room_id: "!r",
                    session_id: "S9",
                    key: { session_id: "S9", room_id: "!r", sender_key: "c" },
                },
            },
            encryptionInfo: {
                sender: "@alice:x",
                senderDevice: "DEV",
                senderCurve25519KeyBase64: "c",
                senderVerified: false,
            },
        });
        await flush();
        detach();
        expect(c.importRoomKeys).not.toHaveBeenCalled();
    });
});
