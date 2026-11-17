import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import type { PluginCallTransportFactory } from "$lib/plugins/types";
import {
    MAX_DATA_TOPIC_BYTES,
    MAX_DESCRIPTOR_DATA_BYTES,
    PLUGIN_TRANSPORT_TYPE,
    PluginTransportInstance,
    decodePluginTransportData,
    encodePluginTransportData,
    ownPluginTransport,
    pickedPluginTransport,
    pluginPublications,
    pluginTransportKey,
    pluginTransportProblem,
    registerPluginCallTransport,
    registeredPluginTransports,
    onPluginTransportsChange,
    type PluginTransportMember,
    type RegisteredTransport,
} from "./pluginTransport";
import type { MeshLocalMedia, MeshPublication } from "./fullMesh/connection";
import type { CallTransportListener } from "./transport";

function factory(
    overrides: Partial<PluginCallTransportFactory> = {},
): PluginCallTransportFactory {
    return {
        id: "i2p",
        label: "I2P",
        privacy: { exposesIp: false, thirdParty: null },
        create: () => ({ setMembers: () => {}, close: () => {} }),
        ...overrides,
    };
}

// Registrations made by a test; disposed after each so tests stay independent.
let disposers: Array<() => void> = [];
function register(pluginId: string, f: PluginCallTransportFactory) {
    const dispose = registerPluginCallTransport(pluginId, f);
    disposers.push(dispose);
    return dispose;
}

beforeEach(() => {
    disposers = [];
});

afterEach(() => {
    for (const d of disposers) d();
    disposers = [];
    vi.restoreAllMocks();
});

describe("pluginTransportProblem", () => {
    it("accepts a good factory", () => {
        expect(pluginTransportProblem(factory())).toBeNull();
        expect(
            pluginTransportProblem(
                factory({
                    id: "tor.relay-1_x",
                    privacy: { exposesIp: true, thirdParty: "Tor" },
                }),
            ),
        ).toBeNull();
    });

    it("rejects a bad id", () => {
        expect(pluginTransportProblem(factory({ id: "" }))).toEqual(
            expect.any(String),
        );
        expect(pluginTransportProblem(factory({ id: "a b" }))).toEqual(
            expect.any(String),
        );
        expect(pluginTransportProblem(factory({ id: "x".repeat(65) }))).toEqual(
            expect.any(String),
        );
        expect(pluginTransportProblem(factory({ id: "a/b" }))).toEqual(
            expect.any(String),
        );
    });

    it("rejects an empty or blank label", () => {
        expect(pluginTransportProblem(factory({ label: "" }))).toEqual(
            expect.any(String),
        );
        expect(pluginTransportProblem(factory({ label: "   " }))).toEqual(
            expect.any(String),
        );
    });

    it("rejects a bad privacy block", () => {
        expect(
            pluginTransportProblem(
                factory({
                    privacy: {
                        exposesIp: "no" as unknown as boolean,
                        thirdParty: null,
                    },
                }),
            ),
        ).toEqual(expect.any(String));
        expect(
            pluginTransportProblem(
                factory({
                    privacy: {
                        exposesIp: false,
                        thirdParty: 3 as unknown as string,
                    },
                }),
            ),
        ).toEqual(expect.any(String));
        expect(
            pluginTransportProblem(
                factory({
                    privacy: undefined as unknown as {
                        exposesIp: boolean;
                        thirdParty: null;
                    },
                }),
            ),
        ).toEqual(expect.any(String));
    });

    it("rejects a missing create", () => {
        const f = factory();
        delete (f as Partial<PluginCallTransportFactory>).create;
        expect(pluginTransportProblem(f)).toEqual(expect.any(String));
    });

    it("rejects a non-object", () => {
        expect(
            pluginTransportProblem(
                null as unknown as PluginCallTransportFactory,
            ),
        ).toEqual(expect.any(String));
    });
});

describe("registerPluginCallTransport", () => {
    it("registers, then the dispose removes it", () => {
        const dispose = register("com.example.a", factory());
        const keys = registeredPluginTransports().map((r) => r.key);
        expect(keys).toContain("com.example.a/i2p");
        dispose();
        expect(registeredPluginTransports().map((r) => r.key)).not.toContain(
            "com.example.a/i2p",
        );
    });

    it("throws on a duplicate id for the same plugin", () => {
        register("com.example.a", factory());
        expect(() => register("com.example.a", factory())).toThrow(
            /registered/,
        );
    });

    it("allows the same factory id under a different plugin", () => {
        register("com.example.a", factory());
        expect(() => register("com.example.b", factory())).not.toThrow();
    });

    it("a stale dispose does not remove a re-registered transport", () => {
        const first = register("com.example.a", factory());
        first();
        register("com.example.a", factory());
        first();
        expect(registeredPluginTransports().map((r) => r.key)).toContain(
            "com.example.a/i2p",
        );
    });

    it("fires onPluginTransportsChange on register and dispose", () => {
        const cb = vi.fn();
        const off = onPluginTransportsChange(cb);
        const dispose = register("com.example.a", factory());
        expect(cb).toHaveBeenCalledTimes(1);
        dispose();
        expect(cb).toHaveBeenCalledTimes(2);
        off();
        register("com.example.a", factory());
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it("throws a TypeError for an invalid factory", () => {
        expect(() =>
            registerPluginCallTransport(
                "com.example.a",
                factory({ label: "" }),
            ),
        ).toThrow(TypeError);
        expect(() =>
            registerPluginCallTransport(
                "com.example.a",
                factory({ create: undefined as unknown as () => never }),
            ),
        ).toThrow(TypeError);
        expect(registeredPluginTransports().map((r) => r.key)).not.toContain(
            "com.example.a/i2p",
        );
    });

    it("pluginTransportKey joins plugin and factory id", () => {
        expect(pluginTransportKey("p", "f")).toBe("p/f");
    });
});

describe("ownPluginTransport", () => {
    it("fills the descriptor fields", () => {
        expect(ownPluginTransport("com.x", "i2p", "DEV1", undefined)).toEqual({
            type: PLUGIN_TRANSPORT_TYPE,
            plugin: "com.x",
            transport: "i2p",
            device_id: "DEV1",
        });
    });

    it("keeps small JSON data", () => {
        const d = ownPluginTransport("com.x", "i2p", "DEV1", {
            addr: "abc.b32.i2p",
            port: 7,
        });
        expect(d.data).toEqual({ addr: "abc.b32.i2p", port: 7 });
    });

    it("ignores data that is not a record", () => {
        expect(
            ownPluginTransport("com.x", "i2p", "DEV1", "a string").data,
        ).toBeUndefined();
        expect(
            ownPluginTransport("com.x", "i2p", "DEV1", [1]).data,
        ).toBeUndefined();
    });

    it("drops data over MAX_DESCRIPTOR_DATA_BYTES", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const big = { blob: "x".repeat(MAX_DESCRIPTOR_DATA_BYTES) };
        const d = ownPluginTransport("com.x", "i2p", "DEV1", big);
        expect(d).not.toHaveProperty("data");
        expect(warn).toHaveBeenCalled();
    });

    it("keeps data right at the byte limit", () => {
        // {"blob":"..."} adds 11 bytes of framing around the string.
        const fill = "x".repeat(MAX_DESCRIPTOR_DATA_BYTES - 11);
        const d = ownPluginTransport("com.x", "i2p", "DEV1", { blob: fill });
        expect(d.data).toEqual({ blob: fill });
    });

    it("drops data that cannot be serialised", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        const d = ownPluginTransport("com.x", "i2p", "DEV1", cyclic);
        expect(d).not.toHaveProperty("data");
        expect(warn).toHaveBeenCalled();
    });
});

describe("pickedPluginTransport", () => {
    const picked = {
        type: PLUGIN_TRANSPORT_TYPE,
        plugin: "com.x",
        transport: "i2p",
        device_id: "DEV1",
        data: { addr: "a" },
    };

    it("matches the key and data for our device", () => {
        expect(pickedPluginTransport(picked, "DEV1")).toEqual({
            key: "com.x/i2p",
            data: { addr: "a" },
        });
    });

    it("returns null data when data is missing or not a record", () => {
        expect(
            pickedPluginTransport({ ...picked, data: "nope" }, "DEV1"),
        ).toEqual({ key: "com.x/i2p", data: null });
        const { data: _omit, ...noData } = picked;
        void _omit;
        expect(pickedPluginTransport(noData, "DEV1")?.data).toBeNull();
    });

    it("ignores a descriptor naming another device", () => {
        expect(pickedPluginTransport(picked, "DEV2")).toBeNull();
    });

    it("ignores another transport type", () => {
        expect(
            pickedPluginTransport({ ...picked, type: "m.other" }, "DEV1"),
        ).toBeNull();
    });

    it("ignores non-object input", () => {
        expect(pickedPluginTransport(null, "DEV1")).toBeNull();
        expect(pickedPluginTransport("i2p", "DEV1")).toBeNull();
        expect(pickedPluginTransport(42, "DEV1")).toBeNull();
        expect(pickedPluginTransport([picked], "DEV1")).toBeNull();
    });

    it("ignores a descriptor with a non-string plugin or transport", () => {
        expect(
            pickedPluginTransport({ ...picked, plugin: 1 }, "DEV1"),
        ).toBeNull();
        expect(
            pickedPluginTransport({ ...picked, transport: null }, "DEV1"),
        ).toBeNull();
    });
});

describe("call data frames", () => {
    const bytes = (...b: number[]) => new Uint8Array(b);

    it("round-trips a topic and payload", () => {
        const payload = bytes(1, 2, 3, 255, 0);
        const frame = encodePluginTransportData("zam.soundboard", payload);
        expect(decodePluginTransportData(frame)).toEqual({
            topic: "zam.soundboard",
            payload,
        });
    });

    it("writes the documented layout", () => {
        const frame = encodePluginTransportData("ab", bytes(9));
        expect(Array.from(frame)).toEqual([1, 0, 2, 0x61, 0x62, 9]);
    });

    it("round-trips an empty topic and an empty payload", () => {
        const frame = encodePluginTransportData("", bytes());
        expect(frame.byteLength).toBe(3);
        expect(decodePluginTransportData(frame)).toEqual({
            topic: "",
            payload: bytes(),
        });
    });

    it("round-trips a unicode topic by UTF-8 bytes", () => {
        const topic = "звук/🔊";
        const frame = encodePluginTransportData(topic, bytes(7));
        expect(decodePluginTransportData(frame)).toEqual({
            topic,
            payload: bytes(7),
        });
    });

    it("accepts a topic at the byte limit and rejects one over it", () => {
        const atLimit = "a".repeat(MAX_DATA_TOPIC_BYTES);
        expect(
            decodePluginTransportData(
                encodePluginTransportData(atLimit, bytes()),
            )?.topic,
        ).toBe(atLimit);
        expect(() => encodePluginTransportData(atLimit + "a", bytes())).toThrow(
            RangeError,
        );
        // Multi-byte characters count as bytes, not characters.
        expect(() =>
            encodePluginTransportData(
                "é".repeat(MAX_DATA_TOPIC_BYTES / 2 + 1),
                bytes(),
            ),
        ).toThrow(RangeError);
    });

    it("decodes a truncated frame to null", () => {
        expect(decodePluginTransportData(bytes())).toBeNull();
        expect(decodePluginTransportData(bytes(1, 0))).toBeNull();
        // Says the topic is 5 bytes, but only 2 follow.
        expect(
            decodePluginTransportData(bytes(1, 0, 5, 0x61, 0x62)),
        ).toBeNull();
    });

    it("decodes an unknown version to null", () => {
        const frame = encodePluginTransportData("t", bytes(1));
        frame[0] = 2;
        expect(decodePluginTransportData(frame)).toBeNull();
        frame[0] = 0;
        expect(decodePluginTransportData(frame)).toBeNull();
    });

    it("decodes invalid UTF-8 in the topic to null", () => {
        expect(decodePluginTransportData(bytes(1, 0, 1, 0xff, 9))).toBeNull();
    });

    it("decodes a topic length over the limit to null", () => {
        // 0x0401 = 1025 bytes: one over MAX_DATA_TOPIC_BYTES.
        const frame = new Uint8Array(3 + 1025);
        frame[0] = 1;
        frame[1] = 0x04;
        frame[2] = 0x01;
        expect(decodePluginTransportData(frame)).toBeNull();
    });

    it("decodes a non-byte value to null", () => {
        expect(decodePluginTransportData("abc")).toBeNull();
        expect(decodePluginTransportData(null)).toBeNull();
    });
});

describe("pluginPublications", () => {
    const track = { kind: "audio" } as unknown as MediaStreamTrack;
    const pub = (
        id: string,
        kind: "audio" | "video",
        purpose: MeshPublication["purpose"],
        muted = false,
    ): MeshPublication =>
        ({
            id,
            kind,
            purpose,
            track,
            muted,
            stream: {} as MediaStream,
        }) as MeshPublication;

    it("maps the four sources", () => {
        const local = {
            publications: () => [
                pub("a", "audio", "m.usermedia"),
                pub("v", "video", "m.usermedia", true),
                pub("s", "video", "m.screenshare"),
                pub("sa", "audio", "m.screenshare"),
            ],
            onChange: () => () => {},
        } as unknown as MeshLocalMedia;

        const out = pluginPublications(local);
        expect(out.map((p) => [p.id, p.kind, p.source, p.muted])).toEqual([
            ["a", "audio", "microphone", false],
            ["v", "video", "camera", true],
            ["s", "video", "screen_share", false],
            ["sa", "audio", "screen_share_audio", false],
        ]);
        expect(out[0].track).toBe(track);
    });

    it("returns [] with no local media", () => {
        expect(pluginPublications(null)).toEqual([]);
    });
});

describe("PluginTransportInstance", () => {
    function fakeClient() {
        return {
            on: vi.fn(),
            off: vi.fn(),
            getCrypto: vi.fn(() => undefined),
            queueToDevice: vi.fn(),
        };
    }

    function fakeListener() {
        return {
            audioSubscribed: vi.fn(),
            audioUnsubscribed: vi.fn(),
            videoSubscribed: vi.fn(),
            changed: vi.fn(),
            speakers: vi.fn(),
        } as unknown as CallTransportListener & {
            audioSubscribed: ReturnType<typeof vi.fn>;
            audioUnsubscribed: ReturnType<typeof vi.fn>;
            videoSubscribed: ReturnType<typeof vi.fn>;
            changed: ReturnType<typeof vi.fn>;
            speakers: ReturnType<typeof vi.fn>;
        };
    }

    function member(
        memberId: string,
        userId: string,
        deviceId: string,
    ): PluginTransportMember {
        return { userId, deviceId, memberId, publishes: true, data: null };
    }

    /** Registers a factory whose create() captures the context. */
    function setup() {
        let ctx: Parameters<PluginCallTransportFactory["create"]>[0] | null =
            null;
        const plugin = { setMembers: vi.fn(), close: vi.fn() };
        const f = factory({
            create: (c) => {
                ctx = c;
                return plugin;
            },
        });
        register("com.example.call", f);
        const entry = registeredPluginTransports().find(
            (r) => r.pluginId === "com.example.call",
        ) as RegisteredTransport;
        const client = fakeClient();
        const listener = fakeListener();
        const inst = new PluginTransportInstance(entry, {
            client: client as unknown as MatrixClient,
            roomId: "!room:example.org",
            slotId: "slot",
            own: { userId: "@me:example.org", deviceId: "ME", memberId: "me" },
            local: null,
            listener,
        });
        return {
            inst,
            listener,
            plugin,
            client,
            ctx: () => {
                if (!ctx) throw new Error("create was not called");
                return ctx;
            },
        };
    }

    const audioTrack = () => ({ kind: "audio" }) as unknown as MediaStreamTrack;

    it("starts the plugin's instance once with the call's ids", () => {
        const { inst, plugin, ctx } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        inst.start();
        expect(inst.started).toBe(true);
        // Members set before start() reach the plugin once it exists.
        expect(plugin.setMembers).toHaveBeenCalledTimes(1);
        expect(ctx().roomId).toBe("!room:example.org");
        expect(ctx().own.identity).toBe("me");
    });

    it("addTrack hands an audio track to the listener", () => {
        const { inst, listener, ctx } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        const handle = ctx().remote.addTrack("alice", {
            source: "microphone",
            track: audioTrack(),
        });
        expect(listener.audioSubscribed).toHaveBeenCalledTimes(1);
        const [track, source, identity] =
            listener.audioSubscribed.mock.calls[0];
        expect(track).toBeDefined();
        expect(source).toBe("microphone");
        expect(identity).toBe("alice");
        expect(handle.enabled).toBe(true);
        expect(listener.changed).toHaveBeenCalled();
    });

    it("addTrack rejects an unknown member or a mismatched kind", () => {
        const { inst, ctx } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        expect(() =>
            ctx().remote.addTrack("bob", {
                source: "microphone",
                track: audioTrack(),
            }),
        ).toThrow(/isn't in the call/);
        expect(() =>
            ctx().remote.addTrack("alice", {
                source: "camera",
                track: audioTrack(),
            }),
        ).toThrow(TypeError);
    });

    it("setMembers removing a member ends their tracks", () => {
        const { inst, listener, ctx } = setup();
        inst.setMembers([
            member("alice", "@alice:example.org", "A1"),
            member("bob", "@bob:example.org", "B1"),
        ]);
        inst.start();
        ctx().remote.addTrack("alice", {
            source: "microphone",
            track: audioTrack(),
        });
        ctx().remote.addTrack("bob", {
            source: "microphone",
            track: audioTrack(),
        });
        expect(
            inst
                .participants()
                .map((p) => p.identity)
                .sort(),
        ).toEqual(["alice", "bob"]);

        inst.setMembers([member("bob", "@bob:example.org", "B1")]);

        expect(listener.audioUnsubscribed).toHaveBeenCalledTimes(1);
        expect(inst.participants().map((p) => p.identity)).toEqual(["bob"]);
    });

    it("participants() groups tracks by identity", () => {
        const { inst, ctx } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        expect(inst.participants()).toEqual([]);
        ctx().remote.addTrack("alice", {
            source: "microphone",
            track: audioTrack(),
        });
        const parts = inst.participants();
        expect(parts).toHaveLength(1);
        expect(parts[0].identity).toBe("alice");
        expect(parts[0].tracks).toHaveLength(1);
        expect(parts[0].tracks[0].kind).toBe("audio");
    });

    it("pushes the member list to the plugin as peers", () => {
        const { inst, plugin } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        expect(plugin.setMembers).toHaveBeenLastCalledWith([
            {
                identity: "alice",
                userId: "@alice:example.org",
                deviceId: "A1",
                publishes: true,
                data: null,
            },
        ]);
    });

    it("close ends every track and closes the plugin", async () => {
        const { inst, listener, plugin, client, ctx } = setup();
        inst.setMembers([member("alice", "@alice:example.org", "A1")]);
        inst.start();
        ctx().remote.addTrack("alice", {
            source: "microphone",
            track: audioTrack(),
        });
        await inst.close();
        expect(listener.audioUnsubscribed).toHaveBeenCalledTimes(1);
        expect(plugin.close).toHaveBeenCalledTimes(1);
        expect(client.off).toHaveBeenCalled();
        expect(() =>
            ctx().remote.addTrack("alice", {
                source: "microphone",
                track: audioTrack(),
            }),
        ).toThrow(/over/);
    });
});

describe("PluginTransportInstance call data", () => {
    function dataListener() {
        return {
            audioSubscribed: vi.fn(),
            audioUnsubscribed: vi.fn(),
            videoSubscribed: vi.fn(),
            changed: vi.fn(),
            speakers: vi.fn(),
            data: vi.fn(),
        };
    }

    function setupData(reached: string[] = ["alice"]) {
        let ctx: Parameters<PluginCallTransportFactory["create"]>[0] | null =
            null;
        const plugin = {
            setMembers: vi.fn(),
            close: vi.fn(),
            sendData: vi.fn(),
            reachable: vi.fn(() => reached),
        };
        register(
            "com.example.data",
            factory({
                create: (c) => {
                    ctx = c;
                    return plugin;
                },
            }),
        );
        const entry = registeredPluginTransports().find(
            (r) => r.pluginId === "com.example.data",
        ) as RegisteredTransport;
        const listener = dataListener();
        const inst = new PluginTransportInstance(entry, {
            client: {
                on: vi.fn(),
                off: vi.fn(),
                getCrypto: vi.fn(() => undefined),
                queueToDevice: vi.fn(),
            } as unknown as MatrixClient,
            roomId: "!room:example.org",
            slotId: "slot",
            own: { userId: "@me:example.org", deviceId: "ME", memberId: "me" },
            local: null,
            listener: listener as unknown as CallTransportListener,
        });
        inst.setMembers([
            member("alice", "@alice:example.org", "A1"),
            member("bob", "@bob:example.org", "B1"),
        ]);
        inst.start();
        return {
            inst,
            plugin,
            listener,
            ctx: () => {
                if (!ctx) throw new Error("create was not called");
                return ctx;
            },
        };
    }

    function member(
        memberId: string,
        userId: string,
        deviceId: string,
    ): PluginTransportMember {
        return { userId, deviceId, memberId, publishes: true, data: null };
    }

    it("carriesData needs a started instance with sendData", () => {
        const { inst } = setupData();
        expect(inst.carriesData).toBe(true);

        const noSend = {
            setMembers: vi.fn(),
            close: vi.fn(),
        };
        register("com.example.nosend", factory({ create: () => noSend }));
        const entry = registeredPluginTransports().find(
            (r) => r.pluginId === "com.example.nosend",
        ) as RegisteredTransport;
        const plain = new PluginTransportInstance(entry, {
            client: {
                on: vi.fn(),
                off: vi.fn(),
                getCrypto: vi.fn(() => undefined),
                queueToDevice: vi.fn(),
            } as unknown as MatrixClient,
            roomId: "!room:example.org",
            slotId: "slot",
            own: { userId: "@me:example.org", deviceId: "ME", memberId: "me" },
            local: null,
            listener: dataListener() as unknown as CallTransportListener,
        });
        expect(plain.carriesData).toBe(false);
        plain.start();
        expect(plain.carriesData).toBe(false);
    });

    it("publishData encodes the frame and passes destinations to sendData", async () => {
        const { inst, plugin } = setupData();
        const payload = new Uint8Array([4, 5]);
        await inst.publishData(payload, {
            reliable: true,
            topic: "zam.soundboard",
            destinationIdentities: ["alice"],
        });
        expect(plugin.sendData).toHaveBeenCalledTimes(1);
        const [to, frame, opts] = plugin.sendData.mock.calls[0];
        expect(to).toEqual(["alice"]);
        expect(opts).toEqual({ reliable: true });
        expect(decodePluginTransportData(frame)).toEqual({
            topic: "zam.soundboard",
            payload,
        });
    });

    it("publishData with no topic or destinations sends an empty topic to everyone", async () => {
        const { inst, plugin } = setupData();
        await inst.publishData(new Uint8Array([1]), { reliable: false });
        const [to, frame, opts] = plugin.sendData.mock.calls[0];
        expect(to).toBeNull();
        expect(opts).toEqual({ reliable: false });
        expect(decodePluginTransportData(frame)).toEqual({
            topic: "",
            payload: new Uint8Array([1]),
        });
    });

    it("publishData throws after close", async () => {
        const { inst, plugin } = setupData();
        await inst.close();
        await expect(
            inst.publishData(new Uint8Array(), { reliable: true }),
        ).rejects.toThrow(/over/);
        expect(plugin.sendData).not.toHaveBeenCalled();
    });

    it("publishData throws when the plugin has no sendData", async () => {
        register(
            "com.example.nosend2",
            factory({
                create: () => ({ setMembers: () => {}, close: () => {} }),
            }),
        );
        const entry = registeredPluginTransports().find(
            (r) => r.pluginId === "com.example.nosend2",
        ) as RegisteredTransport;
        const inst = new PluginTransportInstance(entry, {
            client: {
                on: vi.fn(),
                off: vi.fn(),
                getCrypto: vi.fn(() => undefined),
                queueToDevice: vi.fn(),
            } as unknown as MatrixClient,
            roomId: "!room:example.org",
            slotId: "slot",
            own: { userId: "@me:example.org", deviceId: "ME", memberId: "me" },
            local: null,
            listener: dataListener() as unknown as CallTransportListener,
        });
        inst.start();
        await expect(
            inst.publishData(new Uint8Array(), { reliable: true }),
        ).rejects.toThrow(/call data/);
    });

    it("deliverData from a member reaches listener.data with topic and payload", () => {
        const { listener, plugin, ctx } = setupData();
        void plugin;
        ctx().remote.deliverData(
            "alice",
            encodePluginTransportData("zam.soundboard", new Uint8Array([8])),
        );
        expect(listener.data).toHaveBeenCalledTimes(1);
        const [payload, identity, topic] = listener.data.mock.calls[0];
        expect(payload).toEqual(new Uint8Array([8]));
        expect(identity).toBe("alice");
        expect(topic).toBe("zam.soundboard");
    });

    it("deliverData with an empty topic passes undefined", () => {
        const { listener, ctx } = setupData();
        ctx().remote.deliverData(
            "bob",
            encodePluginTransportData("", new Uint8Array([3])),
        );
        expect(listener.data.mock.calls[0][2]).toBeUndefined();
    });

    it("deliverData ignores a non-member and garbage frames", () => {
        const { listener, ctx } = setupData();
        ctx().remote.deliverData(
            "carol",
            encodePluginTransportData("t", new Uint8Array([1])),
        );
        ctx().remote.deliverData("alice", new Uint8Array([9, 9, 9]));
        expect(listener.data).not.toHaveBeenCalled();
    });

    it("deliverData ignores data after close", async () => {
        const { inst, listener, ctx } = setupData();
        await inst.close();
        ctx().remote.deliverData(
            "alice",
            encodePluginTransportData("t", new Uint8Array([1])),
        );
        expect(listener.data).not.toHaveBeenCalled();
    });

    it("a throwing data listener is reported, not thrown into the plugin", () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const { listener, ctx } = setupData();
        listener.data.mockImplementation(() => {
            throw new Error("boom");
        });
        expect(() =>
            ctx().remote.deliverData(
                "alice",
                encodePluginTransportData("t", new Uint8Array([1])),
            ),
        ).not.toThrow();
        expect(err).toHaveBeenCalled();
    });

    it("subscriberIdentities keeps only current members the plugin reaches", () => {
        const { inst, plugin } = setupData(["alice", "stranger", "bob"]);
        expect(inst.subscriberIdentities().sort()).toEqual(["alice", "bob"]);
        plugin.reachable.mockReturnValue(["stranger"]);
        expect(inst.subscriberIdentities()).toEqual([]);
    });

    it("subscriberIdentities is [] when reachable throws", () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const { inst, plugin } = setupData();
        plugin.reachable.mockImplementation(() => {
            throw new Error("nope");
        });
        expect(inst.subscriberIdentities()).toEqual([]);
        expect(err).toHaveBeenCalled();
    });

    it("subscriberIdentities is [] before start", () => {
        const { inst } = setupData();
        void inst;
        expect(
            new PluginTransportInstance(
                registeredPluginTransports().find(
                    (r) => r.pluginId === "com.example.data",
                ) as RegisteredTransport,
                {
                    client: {
                        on: vi.fn(),
                        off: vi.fn(),
                        getCrypto: vi.fn(() => undefined),
                        queueToDevice: vi.fn(),
                    } as unknown as MatrixClient,
                    roomId: "!room:example.org",
                    slotId: "slot",
                    own: {
                        userId: "@me:example.org",
                        deviceId: "ME",
                        memberId: "me",
                    },
                    local: null,
                    listener:
                        dataListener() as unknown as CallTransportListener,
                },
            ).subscriberIdentities(),
        ).toEqual([]);
    });
});
