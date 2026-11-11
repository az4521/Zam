import { beforeEach, describe, expect, it, vi } from "vitest";

type Api = typeof import("./callPluginData");

let api: Api;

beforeEach(async () => {
    // The registry is module state: start every test from a fresh one.
    vi.resetModules();
    api = await import("./callPluginData");
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeLocal() {
    return {
        tryPush: vi.fn(async (_frame: unknown) => {}),
        unpublish: vi.fn(async () => {}),
    };
}

function fakeHost(
    identities: string[] = ["@bob:server:BOBDEV", "@carol:server:CAROLPHONE"],
    roomId = "!room:server",
) {
    const local = fakeLocal();
    const host = {
        roomId,
        participantIdentities: () => identities,
        publishData: vi.fn(async (_p: Uint8Array, _o: unknown) => {}),
        publishDataTrack: vi.fn(async (_name: string) => local),
    };
    return { host, local };
}

interface FrameIn {
    payload: Uint8Array;
    userTimestamp?: bigint;
}

function fakeRemote(
    wire: string,
    sid: string,
    identity = "@bob:server:BOBDEV",
    frames: FrameIn[] = [],
) {
    return {
        info: { sid, name: wire },
        publisherIdentity: identity,
        subscribe: vi.fn(
            (_opts?: { signal?: AbortSignal }) =>
                new ReadableStream<FrameIn>({
                    start(controller) {
                        for (const f of frames) controller.enqueue(f);
                    },
                }),
        ),
    };
}

function fakeRoom(tracks: ReturnType<typeof fakeRemote>[] = []) {
    return {
        remoteParticipants: new Map([
            [
                "@bob:server:BOBDEV",
                { dataTracks: new Map(tracks.map((t) => [t.info.name, t])) },
            ],
        ]),
    };
}

describe("wire names", () => {
    it("namespaces a plugin's name under the plugin prefix", () => {
        expect(api.pluginWireName("com.zam.whisper", "level")).toBe(
            "zam.plugin/com.zam.whisper/level",
        );
    });

    it("parses back what it builds, keeping slashes in the name", () => {
        const wire = api.pluginWireName("com.zam.x", "a/b/c");
        expect(api.parsePluginWireName(wire)).toEqual({
            pluginId: "com.zam.x",
            name: "a/b/c",
        });
    });

    it("rejects anything outside a plugin namespace", () => {
        expect(api.parsePluginWireName("soundboard")).toBeNull();
        expect(api.parsePluginWireName("zam.audioloss")).toBeNull();
        expect(api.parsePluginWireName("zam.plugin/")).toBeNull();
        expect(api.parsePluginWireName("zam.plugin/pid")).toBeNull();
        expect(api.parsePluginWireName("zam.plugin/pid/")).toBeNull();
        expect(api.parsePluginWireName("zam.plugin//name")).toBeNull();
    });

    it("refuses to build a name for an invalid plugin id", () => {
        expect(() => api.pluginWireName("", "x")).toThrow(RangeError);
        expect(() => api.pluginWireName("a/b", "x")).toThrow(RangeError);
    });
});

describe("sending", () => {
    it("rejects outside a call", async () => {
        await expect(
            api.sendPluginCallData("p", "t", new Uint8Array(1)),
        ).rejects.toThrow(/Not in a voice call/);
    });

    it("sends under the plugin's wire topic, reliable by default", async () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        const payload = new Uint8Array([1, 2]);
        await api.sendPluginCallData("p", "ping", payload);
        expect(host.publishData).toHaveBeenCalledWith(payload, {
            reliable: true,
            topic: "zam.plugin/p/ping",
            destinationIdentities: undefined,
        });
    });

    it("enforces the reliable and lossy payload limits", async () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        await expect(
            api.sendPluginCallData("p", "t", new Uint8Array(15_001)),
        ).rejects.toThrow(RangeError);
        await expect(
            api.sendPluginCallData("p", "t", new Uint8Array(1_301), {
                reliable: false,
            }),
        ).rejects.toThrow(RangeError);
        await api.sendPluginCallData("p", "t", new Uint8Array(1_300), {
            reliable: false,
        });
        expect(host.publishData).toHaveBeenCalledTimes(1);
    });

    it("validates the topic", async () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        await expect(
            api.sendPluginCallData("p", "", new Uint8Array(1)),
        ).rejects.toThrow(RangeError);
        await expect(
            api.sendPluginCallData("p", "x".repeat(101), new Uint8Array(1)),
        ).rejects.toThrow(RangeError);
    });

    it("addresses only the users given in `to`, by their device identities", async () => {
        const { host } = fakeHost([
            "@bob:server:BOBDEV",
            "@bob:server:BOBPHONE",
            "@carol:server:CAROLPHONE",
        ]);
        api.bindPluginCallHost(host);
        await api.sendPluginCallData("p", "t", new Uint8Array(1), {
            to: ["@bob:server"],
        });
        expect(host.publishData.mock.calls[0][1]).toMatchObject({
            destinationIdentities: [
                "@bob:server:BOBDEV",
                "@bob:server:BOBPHONE",
            ],
        });
    });

    it("resolves without sending when `to` names nobody here", async () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        await api.sendPluginCallData("p", "t", new Uint8Array(1), {
            to: ["@nobody:server"],
        });
        expect(host.publishData).not.toHaveBeenCalled();
    });
});

describe("receiving packets", () => {
    it("hands a plugin its own topic with the sender's ids", () => {
        const handler = vi.fn();
        api.onPluginCallData("p", "ping", handler);
        const handled = api.handlePluginCallData(
            "zam.plugin/p/ping",
            new Uint8Array([7]),
            "@bob:server:BOBDEV",
        );
        expect(handled).toBe(true);
        expect(handler).toHaveBeenCalledWith({
            payload: new Uint8Array([7]),
            userId: "@bob:server",
            deviceId: "BOBDEV",
            topic: "ping",
        });
    });

    it("leaves core topics to the core handlers", () => {
        const handler = vi.fn();
        api.onPluginCallData("p", "ping", handler);
        expect(
            api.handlePluginCallData("soundboard", new Uint8Array(), "@a:s:D"),
        ).toBe(false);
        expect(
            api.handlePluginCallData(
                "zam.audioloss",
                new Uint8Array(),
                "@a:s:D",
            ),
        ).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it("never delivers another plugin's topics", () => {
        const handler = vi.fn();
        api.onPluginCallData("other", "ping", handler);
        api.handlePluginCallData(
            "zam.plugin/p/ping",
            new Uint8Array(),
            "@a:s:D",
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it("keeps delivering after one handler throws", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const bad = vi.fn(() => {
            throw new Error("boom");
        });
        const good = vi.fn();
        api.onPluginCallData("p", "t", bad);
        api.onPluginCallData("p", "t", good);
        api.handlePluginCallData("zam.plugin/p/t", new Uint8Array(), "@a:s:D");
        expect(good).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("stops delivering after unsubscribe", () => {
        const handler = vi.fn();
        const off = api.onPluginCallData("p", "t", handler);
        off();
        api.handlePluginCallData("zam.plugin/p/t", new Uint8Array(), "@a:s:D");
        expect(handler).not.toHaveBeenCalled();
    });
});

describe("call changes", () => {
    it("fires the room id on join and null on leave, not on registration", () => {
        const handler = vi.fn();
        api.onPluginCallChange("p", handler);
        expect(handler).not.toHaveBeenCalled();
        expect(api.getPluginCallRoomId()).toBeNull();

        const { host } = fakeHost([], "!a:server");
        api.bindPluginCallHost(host);
        expect(handler).toHaveBeenLastCalledWith("!a:server");
        expect(api.getPluginCallRoomId()).toBe("!a:server");

        api.bindPluginCallHost(null);
        expect(handler).toHaveBeenLastCalledWith(null);
        expect(api.getPluginCallRoomId()).toBeNull();
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("ends the previous call before a new one starts", () => {
        const handler = vi.fn();
        api.onPluginCallChange("p", handler);
        api.bindPluginCallHost(fakeHost([], "!a:server").host);
        api.bindPluginCallHost(fakeHost([], "!b:server").host);
        expect(handler.mock.calls.map((c) => c[0])).toEqual([
            "!a:server",
            null,
            "!b:server",
        ]);
    });
});

describe("local data tracks", () => {
    it("rejects outside a call", async () => {
        await expect(api.publishPluginDataTrack("p", "level")).rejects.toThrow(
            /Not in a voice call/,
        );
    });

    it("publishes under the wire name and pushes frames with a timestamp", async () => {
        const { host, local } = fakeHost();
        api.bindPluginCallHost(host);
        const handle = await api.publishPluginDataTrack("p", "level");
        expect(host.publishDataTrack).toHaveBeenCalledWith(
            "zam.plugin/p/level",
        );
        expect(handle.name).toBe("level");

        const payload = new Uint8Array([3]);
        expect(await handle.push(payload, 1.5)).toBe(true);
        expect(local.tryPush).toHaveBeenCalledWith({
            payload,
            userTimestamp: 1500n,
        });
        expect(await handle.push(payload)).toBe(true);
        expect(local.tryPush).toHaveBeenLastCalledWith({
            payload,
            userTimestamp: undefined,
        });
    });

    it("reports a dropped frame as false", async () => {
        const { host, local } = fakeHost();
        api.bindPluginCallHost(host);
        const handle = await api.publishPluginDataTrack("p", "level");
        local.tryPush.mockRejectedValueOnce(new Error("dropped"));
        expect(await handle.push(new Uint8Array(1))).toBe(false);
    });

    it("stops pushing and unpublishes after unpublish", async () => {
        const { host, local } = fakeHost();
        api.bindPluginCallHost(host);
        const handle = await api.publishPluginDataTrack("p", "level");
        await handle.unpublish();
        expect(local.unpublish).toHaveBeenCalledTimes(1);
        expect(await handle.push(new Uint8Array(1))).toBe(false);
        expect(local.tryPush).not.toHaveBeenCalled();
    });

    it("unpublishes when the call ends", async () => {
        const { host, local } = fakeHost();
        api.bindPluginCallHost(host);
        const handle = await api.publishPluginDataTrack("p", "level");
        api.bindPluginCallHost(null);
        expect(local.unpublish).toHaveBeenCalledTimes(1);
        expect(await handle.push(new Uint8Array(1))).toBe(false);
    });

    it("rejects an empty track name", async () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        await expect(api.publishPluginDataTrack("p", "")).rejects.toThrow(
            RangeError,
        );
    });
});

describe("remote data tracks", () => {
    it("announces a plugin's track to handlers, and to ones registered later", () => {
        const { host } = fakeHost();
        api.bindPluginCallHost(host);
        const room = fakeRoom();
        const early = vi.fn();
        api.onPluginDataTrack("p", early);

        const remote = fakeRemote(
            "zam.plugin/p/level",
            "TR_1",
            "@bob:server:BOBDEV",
        );
        api.pluginDataTrackPublished(room, remote);
        expect(early).toHaveBeenCalledTimes(1);
        const handle = early.mock.calls[0][0];
        expect(handle).toMatchObject({
            name: "level",
            userId: "@bob:server",
            deviceId: "BOBDEV",
        });

        const late = vi.fn();
        api.onPluginDataTrack("p", late);
        expect(late).toHaveBeenCalledWith(handle);
    });

    it("ignores other plugins' and core tracks", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        const room = fakeRoom();
        api.pluginDataTrackPublished(
            room,
            fakeRemote("zam.plugin/q/level", "TR_1"),
        );
        api.pluginDataTrackPublished(room, fakeRemote("soundboard", "TR_2"));
        expect(handler).not.toHaveBeenCalled();
    });

    it("ignores tracks outside a call", () => {
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        api.pluginDataTrackPublished(
            fakeRoom(),
            fakeRemote("zam.plugin/p/level", "TR_1"),
        );
        expect(handler).not.toHaveBeenCalled();
    });

    it("dedupes a track seen both as an event and in a scan", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        const remote = fakeRemote("zam.plugin/p/level", "TR_1");
        const room = fakeRoom([remote]);
        api.pluginDataTrackPublished(room, remote);
        api.scanPluginDataTracks(room);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("streams frames with millisecond timestamps and stops on dispose", async () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        const remote = fakeRemote(
            "zam.plugin/p/level",
            "TR_1",
            "@bob:server:BOBDEV",
            [
                { payload: new Uint8Array([1]), userTimestamp: 2_000_000n },
                { payload: new Uint8Array([2]) },
            ],
        );
        api.pluginDataTrackPublished(fakeRoom(), remote);
        const got: unknown[] = [];
        const sub = handler.mock.calls[0][0].subscribe((f: unknown) =>
            got.push(f),
        );
        await flush();
        expect(got).toEqual([
            { payload: new Uint8Array([1]), timestamp: 2000 },
            { payload: new Uint8Array([2]), timestamp: null },
        ]);
        sub.dispose();
    });

    it("ends a track on unpublish and calls onEnded once", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        api.pluginDataTrackPublished(
            fakeRoom(),
            fakeRemote("zam.plugin/p/level", "TR_1"),
        );
        const ended = vi.fn();
        handler.mock.calls[0][0].onEnded(ended);
        api.pluginDataTrackUnpublished("TR_1");
        api.pluginDataTrackUnpublished("TR_1");
        expect(ended).toHaveBeenCalledTimes(1);
    });

    it("ends the tracks of a room that disconnects", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        const roomA = fakeRoom();
        const roomB = fakeRoom();
        api.pluginDataTrackPublished(
            roomA,
            fakeRemote("zam.plugin/p/a", "TR_A"),
        );
        api.pluginDataTrackPublished(
            roomB,
            fakeRemote("zam.plugin/p/b", "TR_B"),
        );
        const endedA = vi.fn();
        const endedB = vi.fn();
        handler.mock.calls[0][0].onEnded(endedA);
        handler.mock.calls[1][0].onEnded(endedB);
        api.pluginDataTracksRoomGone(roomA);
        expect(endedA).toHaveBeenCalledTimes(1);
        expect(endedB).not.toHaveBeenCalled();
    });

    it("ends remote tracks when the call ends", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        api.pluginDataTrackPublished(
            fakeRoom(),
            fakeRemote("zam.plugin/p/level", "TR_1"),
        );
        const ended = vi.fn();
        handler.mock.calls[0][0].onEnded(ended);
        api.bindPluginCallHost(null);
        expect(ended).toHaveBeenCalledTimes(1);
    });

    it("finds tracks already published when a room is scanned", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        api.scanPluginDataTracks(
            fakeRoom([fakeRemote("zam.plugin/p/level", "TR_9")]),
        );
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe("clearPluginCallData", () => {
    it("drops the plugin's handlers and unpublishes its local tracks", async () => {
        const { host, local } = fakeHost();
        const callChange = vi.fn();
        const packet = vi.fn();
        const track = vi.fn();
        api.onPluginCallChange("p", callChange);
        api.onPluginCallData("p", "t", packet);
        api.onPluginDataTrack("p", track);
        api.bindPluginCallHost(host);
        expect(callChange).toHaveBeenCalledWith("!room:server");
        await api.publishPluginDataTrack("p", "level");

        api.clearPluginCallData("p");
        expect(local.unpublish).toHaveBeenCalledTimes(1);

        callChange.mockClear();
        api.handlePluginCallData("zam.plugin/p/t", new Uint8Array(), "@a:s:D");
        api.bindPluginCallHost(null);
        expect(packet).not.toHaveBeenCalled();
        expect(callChange).not.toHaveBeenCalled();
    });

    it("ends the plugin's subscriptions without firing onEnded", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginDataTrack("p", handler);
        api.pluginDataTrackPublished(
            fakeRoom(),
            fakeRemote("zam.plugin/p/level", "TR_1"),
        );
        const ended = vi.fn();
        handler.mock.calls[0][0].onEnded(ended);
        api.clearPluginCallData("p");
        expect(ended).not.toHaveBeenCalled();
    });

    it("leaves other plugins alone", () => {
        api.bindPluginCallHost(fakeHost().host);
        const handler = vi.fn();
        api.onPluginCallData("other", "t", handler);
        api.clearPluginCallData("p");
        api.handlePluginCallData(
            "zam.plugin/other/t",
            new Uint8Array(),
            "@a:s:D",
        );
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
