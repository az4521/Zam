import { describe, it, expect } from "vitest";
import {
    pickDmRoomVersion,
    FEDERATION_SAFE_DM_VERSION_CEILING,
} from "./dmRoomVersion";

const conti = "@a:matrix.mystravil.xyz";
const contiOther = "@b:matrix.mystravil.xyz";
const crafty = "@c:matrix.crafty.moe";

describe("pickDmRoomVersion", () => {
    it("returns undefined for a same-server DM (let the server default stand)", () => {
        expect(
            pickDmRoomVersion({
                inviteeUserId: contiOther,
                ownUserId: conti,
                available: ["10", "11", "12"],
                default: "12",
            }),
        ).toBeUndefined();
    });

    it("caps a cross-server DM to the highest available version <= the ceiling when the server default is too new", () => {
        // continuwuity default v12 → crafty rejected the federated v12 invite
        // (live 2026-08-15). Cap to v11.
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: conti,
                available: ["3", "10", "11", "12"],
                default: "12",
            }),
        ).toBe("11");
    });

    it("does not override a cross-server DM when the server default is already federation-safe", () => {
        expect(
            pickDmRoomVersion({
                inviteeUserId: conti,
                ownUserId: crafty,
                available: ["10", "11", "12"],
                default: "11",
            }),
        ).toBeUndefined();
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: conti,
                available: ["9", "10"],
                default: "10",
            }),
        ).toBeUndefined();
    });

    it("caps to the ceiling itself, never above it, even if a higher version is available", () => {
        const v = pickDmRoomVersion({
            inviteeUserId: crafty,
            ownUserId: conti,
            available: ["11", "12", "13"],
            default: "13",
        });
        expect(v).toBe("11");
        expect(parseInt(v!, 10)).toBeLessThanOrEqual(
            FEDERATION_SAFE_DM_VERSION_CEILING,
        );
    });

    it("falls back to undefined (server default) when no available version is <= the ceiling", () => {
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: conti,
                available: ["12", "13"],
                default: "12",
            }),
        ).toBeUndefined();
    });

    it("treats an unadvertised/malformed default as needing a cap and picks a safe available version", () => {
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: conti,
                available: ["10", "11", "12"],
                default: "",
            }),
        ).toBe("11");
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: conti,
                available: ["10", "11"],
                default: "org.example.unstable",
            }),
        ).toBe("11");
    });

    it("handles messy/unknown mxids without throwing (no colon → not same-server)", () => {
        // A malformed own id can't be proven same-server, so err toward capping.
        expect(
            pickDmRoomVersion({
                inviteeUserId: crafty,
                ownUserId: "garbage",
                available: ["11", "12"],
                default: "12",
            }),
        ).toBe("11");
    });
});
