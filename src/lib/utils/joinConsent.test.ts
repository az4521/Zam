import { describe, it, expect } from "vitest";
import {
    serverName,
    describeJoinTarget,
    needsJoinConsent,
} from "./joinConsent";

describe("serverName", () => {
    it("returns the server after the first colon", () => {
        expect(serverName("#dev:matrix.org")).toBe("matrix.org");
        expect(serverName("!abc:evil.com")).toBe("evil.com");
    });
    it("keeps a port on the server part", () => {
        expect(serverName("!abc:host.example:8448")).toBe("host.example:8448");
    });
    it("returns null when there is no server part (v12 room id / malformed)", () => {
        expect(serverName("!v12roomidnoserver")).toBeNull();
        expect(serverName("")).toBeNull();
        expect(serverName("#trailingcolon:")).toBeNull();
    });
});

describe("describeJoinTarget", () => {
    it("for an alias whose server matches the resolved room, reports no mismatch", () => {
        expect(
            describeJoinTarget({
                kind: "alias",
                alias: "#dev:matrix.org",
                resolvedRoomId: "!room:matrix.org",
            }),
        ).toEqual({
            display: "#dev:matrix.org",
            resolvedRoomId: "!room:matrix.org",
            serverMismatch: false,
        });
    });
    it("flags a mismatch when the alias server differs from the resolved room server", () => {
        expect(
            describeJoinTarget({
                kind: "alias",
                alias: "#innocent:good.org",
                resolvedRoomId: "!room:evil.com",
            }),
        ).toEqual({
            display: "#innocent:good.org",
            resolvedRoomId: "!room:evil.com",
            serverMismatch: true,
        });
    });
    it("does not flag a mismatch when the resolved room id has no server (v12)", () => {
        const d = describeJoinTarget({
            kind: "alias",
            alias: "#dev:matrix.org",
            resolvedRoomId: "!v12noserver",
        });
        expect(d.serverMismatch).toBe(false);
    });
    it("for a room link, displays the link room id and never flags a mismatch", () => {
        expect(
            describeJoinTarget({
                kind: "room",
                linkRoomId: "!room:evil.com",
                resolvedRoomId: "!room:evil.com",
            }),
        ).toEqual({
            display: "!room:evil.com",
            resolvedRoomId: "!room:evil.com",
            serverMismatch: false,
        });
    });
});

describe("needsJoinConsent", () => {
    it("is false when already joined", () => {
        expect(needsJoinConsent("join")).toBe(false);
    });
    it("is true for every non-joined membership", () => {
        expect(needsJoinConsent("invite")).toBe(true);
        expect(needsJoinConsent("leave")).toBe(true);
        expect(needsJoinConsent(undefined)).toBe(true);
        expect(needsJoinConsent(null)).toBe(true);
    });
});
