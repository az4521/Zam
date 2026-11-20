import { describe, it, expect } from "vitest";
import {
    deviceCountByUser,
    callTileStatus,
    rosterCallStatus,
    devicesByUser,
    deviceLabel,
} from "./callTileStatus";

describe("deviceCountByUser", () => {
    it("is empty for no memberships", () => {
        expect(deviceCountByUser([])).toEqual(new Map());
    });
    it("counts one per single-device user", () => {
        expect(deviceCountByUser([{ userId: "@a:s", deviceId: "D1" }])).toEqual(
            new Map([["@a:s", 1]]),
        );
    });
    it("counts multiple devices of one user", () => {
        expect(
            deviceCountByUser([
                { userId: "@a:s", deviceId: "D1" },
                { userId: "@a:s", deviceId: "D2" },
                { userId: "@b:s", deviceId: "D3" },
            ]),
        ).toEqual(
            new Map([
                ["@a:s", 2],
                ["@b:s", 1],
            ]),
        );
    });
    it("counts a repeated (user, device) as one device", () => {
        expect(
            deviceCountByUser([
                { userId: "@a:s", deviceId: "D1" },
                { userId: "@a:s", deviceId: "D1" },
            ]),
        ).toEqual(new Map([["@a:s", 1]]));
    });
});

describe("callTileStatus", () => {
    const base = {
        isOwn: false,
        remoteMuted: false,
        speaking: false,
        locallyMuted: false,
        selfMicMuted: false,
        selfDeafened: false,
        deviceCount: 1,
    };

    it("shows nothing for a plain remote tile", () => {
        expect(callTileStatus(base)).toEqual({
            micOff: false,
            deafened: false,
            locallyMuted: false,
            multiDevice: false,
        });
    });
    it("shows a remote peer's self-mute when silent", () => {
        expect(callTileStatus({ ...base, remoteMuted: true }).micOff).toBe(
            true,
        );
    });
    it("hides a remote peer's self-mute while they are speaking", () => {
        expect(
            callTileStatus({ ...base, remoteMuted: true, speaking: true })
                .micOff,
        ).toBe(false);
    });
    it("shows own mic-mute from local state, ignoring remoteMuted/speaking", () => {
        expect(
            callTileStatus({
                ...base,
                isOwn: true,
                selfMicMuted: true,
                remoteMuted: false,
                speaking: true,
            }).micOff,
        ).toBe(true);
    });
    it("does not show own mic-mute when not self-muted even if remoteMuted leaks in", () => {
        expect(
            callTileStatus({ ...base, isOwn: true, remoteMuted: true }).micOff,
        ).toBe(false);
    });
    it("shows deafen only on the own tile", () => {
        expect(
            callTileStatus({ ...base, isOwn: true, selfDeafened: true })
                .deafened,
        ).toBe(true);
        expect(
            callTileStatus({ ...base, isOwn: false, selfDeafened: true })
                .deafened,
        ).toBe(false);
    });
    it("shows local-mute only on a remote tile", () => {
        expect(
            callTileStatus({ ...base, locallyMuted: true }).locallyMuted,
        ).toBe(true);
        expect(
            callTileStatus({ ...base, isOwn: true, locallyMuted: true })
                .locallyMuted,
        ).toBe(false);
    });
    it("shows local-mute even while the peer is speaking", () => {
        expect(
            callTileStatus({ ...base, locallyMuted: true, speaking: true })
                .locallyMuted,
        ).toBe(true);
    });
    it("badges multi-device only above one device", () => {
        expect(callTileStatus({ ...base, deviceCount: 1 }).multiDevice).toBe(
            false,
        );
        expect(callTileStatus({ ...base, deviceCount: 2 }).multiDevice).toBe(
            true,
        );
    });
});

describe("rosterCallStatus", () => {
    const base = {
        isSelf: false,
        muted: false,
        speaking: false,
        selfMicMuted: false,
        selfDeafened: false,
    };

    it("shows the mic-off icon on the self row when my mic is muted", () => {
        expect(
            rosterCallStatus({ ...base, isSelf: true, selfMicMuted: true }),
        ).toEqual({ micOff: true, deafened: false });
    });

    it("ignores selfMicMuted on a remote row", () => {
        expect(
            rosterCallStatus({ ...base, isSelf: false, selfMicMuted: true }),
        ).toEqual({ micOff: false, deafened: false });
    });

    it("shows the deafen icon on the self row when deafened", () => {
        expect(
            rosterCallStatus({ ...base, isSelf: true, selfDeafened: true }),
        ).toEqual({ micOff: false, deafened: true });
    });

    it("does not show deafen on the self row when not deafened", () => {
        expect(
            rosterCallStatus({ ...base, isSelf: true, selfDeafened: false }),
        ).toEqual({ micOff: false, deafened: false });
    });

    it("never shows deafen on a remote row even if selfDeafened is set", () => {
        // selfDeafened is a self-only concept; a remote row must ignore it.
        expect(
            rosterCallStatus({ ...base, isSelf: false, selfDeafened: true }),
        ).toEqual({ micOff: false, deafened: false });
    });

    it("shows the mic-off icon for a muted, non-speaking remote participant", () => {
        expect(
            rosterCallStatus({ ...base, muted: true, speaking: false }),
        ).toEqual({ micOff: true, deafened: false });
    });

    it("suppresses the mic-off icon while the participant is speaking", () => {
        expect(
            rosterCallStatus({ ...base, muted: true, speaking: true }),
        ).toEqual({ micOff: false, deafened: false });
    });

    it("does not gate the self deafen icon on speaking or mute state", () => {
        expect(
            rosterCallStatus({
                isSelf: true,
                muted: false,
                speaking: true,
                selfMicMuted: false,
                selfDeafened: true,
            }),
        ).toEqual({ micOff: false, deafened: true });
    });
});

describe("devicesByUser", () => {
    it("is empty for no memberships", () => {
        expect(devicesByUser([])).toEqual(new Map());
    });
    it("lists each user's distinct devices, earliest joined first", () => {
        expect(
            devicesByUser([
                { userId: "@a:s", deviceId: "D2", joinedTs: 300 },
                { userId: "@b:s", deviceId: "D3", joinedTs: 50 },
                { userId: "@a:s", deviceId: "D1", joinedTs: 100 },
            ]),
        ).toEqual(
            new Map([
                [
                    "@a:s",
                    [
                        { deviceId: "D1", joinedTs: 100 },
                        { deviceId: "D2", joinedTs: 300 },
                    ],
                ],
                ["@b:s", [{ deviceId: "D3", joinedTs: 50 }]],
            ]),
        );
    });
    it("counts a repeated (user, device) once, keeping the earliest join", () => {
        expect(
            devicesByUser([
                { userId: "@a:s", deviceId: "D1", joinedTs: 200 },
                { userId: "@a:s", deviceId: "D1", joinedTs: 100 },
            ]),
        ).toEqual(new Map([["@a:s", [{ deviceId: "D1", joinedTs: 100 }]]]));
    });
});

describe("deviceLabel", () => {
    it("uses the this-device text for the local device", () => {
        expect(deviceLabel("D1", "Phone", true, "This device")).toBe(
            "This device",
        );
    });
    it("uses the trimmed display name for other devices", () => {
        expect(deviceLabel("D2", "  Laptop  ", false, "This device")).toBe(
            "Laptop",
        );
    });
    it("falls back to the device id when the name is missing or blank", () => {
        expect(deviceLabel("D2", null, false, "This device")).toBe("D2");
        expect(deviceLabel("D3", undefined, false, "This device")).toBe("D3");
        expect(deviceLabel("D4", "   ", false, "This device")).toBe("D4");
    });
});
