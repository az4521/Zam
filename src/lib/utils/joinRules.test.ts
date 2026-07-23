import { describe, it, expect } from "vitest";
import {
    roomVersionSupportsRestricted,
    buildRestrictedJoinRuleContent,
    getRestrictedJoinState,
    RESTRICTED_JOIN_RULE,
    ROOM_MEMBERSHIP_ALLOW_TYPE,
} from "./joinRules";

describe("roomVersionSupportsRestricted", () => {
    it("is true for v8 and every later version", () => {
        for (const v of ["8", "9", "10", "11", "12"]) {
            expect(roomVersionSupportsRestricted(v)).toBe(true);
        }
    });
    it("is false for versions below 8 and empty input", () => {
        expect(roomVersionSupportsRestricted("7")).toBe(false);
        expect(roomVersionSupportsRestricted("1")).toBe(false);
        expect(roomVersionSupportsRestricted("")).toBe(false);
    });
    it("is false for a non-numeric / unstable version string", () => {
        expect(roomVersionSupportsRestricted("org.matrix.msc3083")).toBe(false);
    });
});

describe("buildRestrictedJoinRuleContent", () => {
    it("builds a single allow entry for one parent space", () => {
        expect(buildRestrictedJoinRuleContent(["!a"])).toEqual({
            join_rule: RESTRICTED_JOIN_RULE,
            allow: [{ type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: "!a" }],
        });
    });
    it("preserves order across multiple parent spaces", () => {
        expect(buildRestrictedJoinRuleContent(["!a", "!b"]).allow).toEqual([
            { type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: "!a" },
            { type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: "!b" },
        ]);
    });
    it("de-dupes repeated ids", () => {
        expect(buildRestrictedJoinRuleContent(["!a", "!a"]).allow).toEqual([
            { type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: "!a" },
        ]);
    });
    it("drops falsy ids", () => {
        expect(
            buildRestrictedJoinRuleContent(["!a", "", null as any]).allow,
        ).toEqual([{ type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: "!a" }]);
    });
    it("returns an empty allow list for empty input", () => {
        expect(buildRestrictedJoinRuleContent([])).toEqual({
            join_rule: RESTRICTED_JOIN_RULE,
            allow: [],
        });
    });
});

describe("getRestrictedJoinState", () => {
    it("is available when editable, supported version, and a parent space exists", () => {
        expect(
            getRestrictedJoinState({
                roomVersion: "10",
                parentSpaceIds: ["!s"],
                canEditState: true,
            }),
        ).toEqual({ available: true, reason: "" });
    });
    it("is unavailable with a reason when there is no parent space", () => {
        const r = getRestrictedJoinState({
            roomVersion: "10",
            parentSpaceIds: [],
            canEditState: true,
        });
        expect(r.available).toBe(false);
        expect(r.reason).toBe("Only available for rooms inside a space");
    });
    it("is unavailable with the version reason when the room version is too old", () => {
        const r = getRestrictedJoinState({
            roomVersion: "7",
            parentSpaceIds: ["!s"],
            canEditState: true,
        });
        expect(r.available).toBe(false);
        expect(r.reason).toBe(
            "This room's version doesn't support space-restricted joining",
        );
    });
    it("is unavailable with an empty reason when the user cannot edit state", () => {
        expect(
            getRestrictedJoinState({
                roomVersion: "10",
                parentSpaceIds: ["!s"],
                canEditState: false,
            }),
        ).toEqual({ available: false, reason: "" });
    });
});
