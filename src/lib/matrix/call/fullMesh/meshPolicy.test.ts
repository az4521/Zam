import { describe, it, expect } from "vitest";
import {
    withMeshCanSubscribe,
    meshSenderDeviceMatches,
    isLivekitTransport,
    joinUsesMesh,
    meshIceConfig,
    hasTurnRelay,
    lacksIceServers,
    PUBLIC_STUN_URL,
    meshTransportOf,
    ownMeshTransport,
    receivesOverMesh,
} from "./meshPolicy";
import { FULL_MESH_TRANSPORT_TYPE } from "./protocol";

const meshFor = (deviceId: string) => ({
    type: FULL_MESH_TRANSPORT_TYPE,
    device_id: deviceId,
});
const livekit = { type: "livekit", livekit_service_url: "https://sfu.example" };

describe("ownMeshTransport", () => {
    it("names the mesh transport type and our device", () => {
        expect(ownMeshTransport("DEV1")).toEqual({
            type: "org.matrix.msc4575.full_mesh",
            device_id: "DEV1",
        });
    });
});

describe("meshTransportOf", () => {
    it("is true when a mesh transport names the device", () => {
        expect(meshTransportOf([meshFor("D1")], "D1")).toBe(true);
    });

    it("is true when the matching transport is among other transports", () => {
        expect(meshTransportOf([livekit, meshFor("D1")], "D1")).toBe(true);
    });

    it("is false when the mesh transport names another device", () => {
        expect(meshTransportOf([meshFor("D2")], "D1")).toBe(false);
    });

    it("ignores transports of other types that carry the same device id", () => {
        expect(
            meshTransportOf(
                [
                    { type: "livekit", device_id: "D1" },
                    {
                        type: "org.matrix.msc4575.full_mesh.other",
                        device_id: "D1",
                    },
                ],
                "D1",
            ),
        ).toBe(false);
    });

    it("ignores non-object entries", () => {
        expect(
            meshTransportOf(
                [null, undefined, "org.matrix.msc4575.full_mesh", 7, []],
                "D1",
            ),
        ).toBe(false);
    });

    it("is false for an empty list", () => {
        expect(meshTransportOf([], "D1")).toBe(false);
    });
});

describe("isLivekitTransport", () => {
    it("is true only for a livekit transport", () => {
        expect(isLivekitTransport(livekit)).toBe(true);
        expect(isLivekitTransport(meshFor("D1"))).toBe(false);
    });

    it("is false for non-objects and missing values", () => {
        expect(isLivekitTransport(undefined)).toBe(false);
        expect(isLivekitTransport(null)).toBe(false);
        expect(isLivekitTransport("livekit")).toBe(false);
    });
});

describe("receivesOverMesh", () => {
    it("is false when the picked transport is livekit, even if a mesh transport is published", () => {
        expect(receivesOverMesh(livekit, [livekit, meshFor("D1")], "D1")).toBe(
            false,
        );
    });

    it("is true when the picked transport is the mesh one", () => {
        const mesh = meshFor("D1");
        expect(receivesOverMesh(mesh, [mesh], "D1")).toBe(true);
    });

    it("is true when nothing was picked and a matching mesh transport exists", () => {
        expect(receivesOverMesh(undefined, [meshFor("D1")], "D1")).toBe(true);
    });

    it("is false when the mesh transport names another device", () => {
        expect(receivesOverMesh(undefined, [meshFor("D2")], "D1")).toBe(false);
    });

    it("is false when nothing is picked and no mesh transport exists", () => {
        expect(receivesOverMesh(undefined, [], "D1")).toBe(false);
    });
});

describe("joinUsesMesh", () => {
    it("is true when we have no SFU of our own", () => {
        expect(joinUsesMesh({ ownHasSfu: false, othersOverMesh: [] })).toBe(
            true,
        );
    });

    it("is false with our own SFU and nobody received over the mesh", () => {
        expect(
            joinUsesMesh({ ownHasSfu: true, othersOverMesh: [false, false] }),
        ).toBe(false);
    });

    it("is true with our own SFU when one member is received over the mesh", () => {
        expect(
            joinUsesMesh({ ownHasSfu: true, othersOverMesh: [false, true] }),
        ).toBe(true);
    });
});

describe("meshIceConfig", () => {
    it("gives no ICE servers when there is no TURN server", () => {
        expect(meshIceConfig(null, false)).toEqual({ iceServers: [] });
    });

    it("relays through a TURN server even when a relay isn't required", () => {
        expect(
            meshIceConfig(
                {
                    uris: ["turn:turn.example:3478", "turns:turn.example:5349"],
                    username: "user",
                    password: "secret",
                },
                false,
            ),
        ).toEqual({
            iceServers: [
                {
                    urls: ["turn:turn.example:3478", "turns:turn.example:5349"],
                    username: "user",
                    credential: "secret",
                },
            ],
            iceTransportPolicy: "relay",
        });
    });

    it("connects directly with only stun: uris unless a relay is required", () => {
        expect(
            meshIceConfig({ uris: ["stun:stun.example:3478"] }, false),
        ).toEqual({
            iceServers: [
                {
                    urls: ["stun:stun.example:3478"],
                    username: undefined,
                    credential: undefined,
                },
            ],
        });
    });

    it("required relay with a turn: or turns: uri forces the relay policy", () => {
        const turn = {
            uris: ["turn:turn.example:3478"],
            username: "u",
            password: "p",
        };
        expect(meshIceConfig(turn, true)).toEqual({
            iceServers: [
                {
                    urls: ["turn:turn.example:3478"],
                    username: "u",
                    credential: "p",
                },
            ],
            iceTransportPolicy: "relay",
        });
        const turns = { uris: ["turns:turn.example:5349"] };
        expect(meshIceConfig(turns, true)).toEqual({
            iceServers: [
                {
                    urls: ["turns:turn.example:5349"],
                    username: undefined,
                    credential: undefined,
                },
            ],
            iceTransportPolicy: "relay",
        });
    });

    it("required relay with only stun: uris returns null", () => {
        expect(
            meshIceConfig({ uris: ["stun:stun.example:3478"] }, true),
        ).toBeNull();
    });

    it("required relay with no TURN server returns null", () => {
        expect(meshIceConfig(null, true)).toBeNull();
    });
});

describe("public STUN fallback", () => {
    it("is used only with no homeserver servers and the user's yes", () => {
        expect(meshIceConfig(null, false, true)).toEqual({
            iceServers: [{ urls: PUBLIC_STUN_URL }],
        });
        expect(meshIceConfig({ uris: [] }, false, true)).toEqual({
            iceServers: [{ urls: PUBLIC_STUN_URL }],
        });
        expect(meshIceConfig(null, false, false)).toEqual({ iceServers: [] });
    });

    it("never replaces the homeserver's own servers", () => {
        const config = meshIceConfig(
            { uris: ["turn:hs.example"], username: "u", password: "p" },
            false,
            true,
        );
        expect(JSON.stringify(config)).not.toContain(PUBLIC_STUN_URL);
    });

    it("can't stand in for a relay when one is required", () => {
        expect(meshIceConfig(null, true, true)).toBeNull();
    });

    it("drops the relay policy for a direct retry unless a relay is required", () => {
        const turn = {
            uris: ["turn:hs.example"],
            username: "u",
            password: "p",
        };
        expect(meshIceConfig(turn, false, false, true)).toEqual({
            iceServers: [
                { urls: ["turn:hs.example"], username: "u", credential: "p" },
            ],
        });
        expect(meshIceConfig(turn, true, false, true)?.iceTransportPolicy).toBe(
            "relay",
        );
    });

    it("hasTurnRelay", () => {
        expect(hasTurnRelay(null)).toBe(false);
        expect(hasTurnRelay({ uris: ["stun:x"] })).toBe(false);
        expect(hasTurnRelay({ uris: ["stun:x", "TURNS:y"] })).toBe(true);
    });

    it("lacksIceServers", () => {
        expect(lacksIceServers(null)).toBe(true);
        expect(lacksIceServers({ uris: [] })).toBe(true);
        expect(lacksIceServers({ uris: ["turn:x"] })).toBe(false);
    });
});

describe("withMeshCanSubscribe", () => {
    it("adds the mesh to an m.rtc.member's can_subscribe", () => {
        const content = {
            slot_id: "m.call#",
            transports: { published: [], can_subscribe: ["livekit"] },
        };
        expect(withMeshCanSubscribe(content)).toEqual({
            slot_id: "m.call#",
            transports: {
                published: [],
                can_subscribe: ["livekit", FULL_MESH_TRANSPORT_TYPE],
            },
        });
        // The SDK's object is not changed in place.
        expect(content.transports.can_subscribe).toEqual(["livekit"]);
    });

    it("doesn't add it twice", () => {
        const content = {
            transports: { can_subscribe: [FULL_MESH_TRANSPORT_TYPE] },
        };
        expect(withMeshCanSubscribe(content)).toBe(content);
    });

    it("leaves content without transports (m.call.member) alone", () => {
        const legacy = { foci_preferred: [], device_id: "D" };
        expect(withMeshCanSubscribe(legacy)).toBe(legacy);
    });
});

describe("meshSenderDeviceMatches", () => {
    it("passes an unencrypted event, whose sending device is unknown", () => {
        expect(meshSenderDeviceMatches(null, undefined)).toBe(true);
        expect(meshSenderDeviceMatches(undefined, "KEY")).toBe(true);
    });

    it("passes an encrypted event sent by the device it names", () => {
        expect(meshSenderDeviceMatches("KEY", "KEY")).toBe(true);
    });

    it("refuses one sent by another device", () => {
        expect(meshSenderDeviceMatches("OTHER", "KEY")).toBe(false);
    });

    it("refuses one naming a device we don't know", () => {
        expect(meshSenderDeviceMatches("KEY", undefined)).toBe(false);
    });
});
