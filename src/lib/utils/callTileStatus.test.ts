import { describe, it, expect } from "vitest";
import { deviceCountByUser, callTileStatus } from "./callTileStatus";

describe("deviceCountByUser", () => {
    it("is empty for no memberships", () => {
        expect(deviceCountByUser([])).toEqual(new Map());
    });
    it("counts one per single-device user", () => {
        expect(deviceCountByUser([{ userId: "@a:s" }])).toEqual(
            new Map([["@a:s", 1]]),
        );
    });
    it("counts multiple devices of one user", () => {
        expect(
            deviceCountByUser([
                { userId: "@a:s" },
                { userId: "@a:s" },
                { userId: "@b:s" },
            ]),
        ).toEqual(
            new Map([
                ["@a:s", 2],
                ["@b:s", 1],
            ]),
        );
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
