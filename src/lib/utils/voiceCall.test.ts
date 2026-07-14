import { describe, it, expect } from "vitest";
import {
    dedupeParticipants,
    connStateLabel,
    toggleMute,
    toggleDeafen,
    sfuJwtUrl,
    pickLivekitTransport,
} from "./voiceCall";

describe("dedupeParticipants", () => {
    it("keeps one entry per user (earliest join wins) sorted by join time", () => {
        const list = [
            { userId: "@b:s", deviceId: "B1", joinedTs: 200 },
            { userId: "@a:s", deviceId: "A2", joinedTs: 300 },
            { userId: "@a:s", deviceId: "A1", joinedTs: 100 },
        ];
        expect(dedupeParticipants(list)).toEqual([
            { userId: "@a:s", deviceId: "A1", joinedTs: 100 },
            { userId: "@b:s", deviceId: "B1", joinedTs: 200 },
        ]);
    });
    it("handles empty input", () => {
        expect(dedupeParticipants([])).toEqual([]);
    });
});

describe("connStateLabel", () => {
    it("labels each state", () => {
        expect(connStateLabel("connecting")).toBe("Connecting…");
        expect(connStateLabel("connected")).toBe("Voice connected");
        expect(connStateLabel("reconnecting")).toBe("Reconnecting…");
        expect(connStateLabel(null)).toBe("");
    });
});

describe("mute/deafen transitions (Discord semantics)", () => {
    const base = { micMuted: false, deafened: false, mutedByDeafen: false };
    it("toggleMute flips the mic", () => {
        expect(toggleMute(base)).toEqual({
            micMuted: true,
            deafened: false,
            mutedByDeafen: false,
        });
    });
    it("deafen forces mute and remembers it did so", () => {
        expect(toggleDeafen(base)).toEqual({
            micMuted: true,
            deafened: true,
            mutedByDeafen: true,
        });
    });
    it("un-deafen restores mic only when the deafen muted it", () => {
        expect(
            toggleDeafen({
                micMuted: true,
                deafened: true,
                mutedByDeafen: true,
            }),
        ).toEqual(base);
    });
    it("un-deafen keeps mic muted when the user muted first", () => {
        const manualThenDeafened = toggleDeafen(toggleMute(base));
        expect(manualThenDeafened).toEqual({
            micMuted: true,
            deafened: true,
            mutedByDeafen: false,
        });
        expect(toggleDeafen(manualThenDeafened)).toEqual({
            micMuted: true,
            deafened: false,
            mutedByDeafen: false,
        });
    });
    it("unmuting while deafened also un-deafens", () => {
        expect(
            toggleMute({ micMuted: true, deafened: true, mutedByDeafen: true }),
        ).toEqual(base);
    });
});

describe("sfuJwtUrl", () => {
    it("appends /sfu/get and tolerates a trailing slash", () => {
        expect(sfuJwtUrl("https://lk.example/jwt")).toBe(
            "https://lk.example/jwt/sfu/get",
        );
        expect(sfuJwtUrl("https://lk.example/jwt/")).toBe(
            "https://lk.example/jwt/sfu/get",
        );
    });
});

describe("pickLivekitTransport", () => {
    const focus = {
        type: "livekit",
        livekit_service_url: "https://lk.example/jwt",
    };
    it("prefers an existing member's transport (their alias wins)", () => {
        const member = { ...focus, livekit_alias: "!other:alias" };
        expect(pickLivekitTransport([member], [focus], "!room:s")).toEqual({
            serviceUrl: "https://lk.example/jwt",
            alias: "!other:alias",
        });
    });
    it("falls back to configured foci with the room id as alias", () => {
        expect(pickLivekitTransport([], [focus], "!room:s")).toEqual({
            serviceUrl: "https://lk.example/jwt",
            alias: "!room:s",
        });
    });
    it("falls back to the room id when a member alias is not a string", () => {
        const member = { ...focus, livekit_alias: 42 };
        expect(pickLivekitTransport([member], [], "!room:s")).toEqual({
            serviceUrl: "https://lk.example/jwt",
            alias: "!room:s",
        });
    });
    it("ignores non-livekit and malformed entries", () => {
        expect(
            pickLivekitTransport(
                [{ type: "other" }, null],
                [{ type: "livekit" }],
                "!r:s",
            ),
        ).toBeNull();
    });
});
