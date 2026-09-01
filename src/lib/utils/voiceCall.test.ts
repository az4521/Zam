import { describe, it, expect } from "vitest";
import {
    dedupeParticipants,
    connStateLabel,
    toggleMute,
    toggleDeafen,
    sfuJwtUrl,
    pickLivekitTransport,
    screenShareCaptureResolution,
    callEndedMembershipMessage,
    identityToUserId,
    usersFromIdentities,
    callBannerDecision,
} from "./voiceCall";

describe("screenShareCaptureResolution", () => {
    it("maps a known resolution key and frame rate", () => {
        expect(screenShareCaptureResolution("1440", 60)).toEqual({
            width: 2560,
            height: 1440,
            frameRate: 60,
        });
    });
    it("falls back to 1080p for an unknown key", () => {
        expect(screenShareCaptureResolution("bogus", 30)).toEqual({
            width: 1920,
            height: 1080,
            frameRate: 30,
        });
    });
    it("falls back to 30 fps for a non-preset rate", () => {
        expect(screenShareCaptureResolution("720", 24).frameRate).toBe(30);
    });
});

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

describe("callEndedMembershipMessage", () => {
    const me = "@me:server";
    const other = "@mod:server";
    it("names a ban regardless of who acted", () => {
        expect(callEndedMembershipMessage("ban", other, me)).toBe(
            "You were banned from this room - call ended",
        );
    });
    it("names a kick (removed by someone else)", () => {
        expect(callEndedMembershipMessage("leave", other, me)).toBe(
            "You were removed from this room - call ended",
        );
    });
    it("names a self-leave", () => {
        expect(callEndedMembershipMessage("leave", me, me)).toBe(
            "You left this room - call ended",
        );
    });
    it("treats an unknown sender as a self-leave (member already pruned)", () => {
        // Leaving from another device can drop my member object before this
        // fires; an absent sender must read as "You left", not "You were removed".
        expect(callEndedMembershipMessage("leave", undefined, me)).toBe(
            "You left this room - call ended",
        );
    });
    it("returns null for a still-present membership", () => {
        expect(callEndedMembershipMessage("join", other, me)).toBeNull();
        expect(callEndedMembershipMessage("invite", undefined, me)).toBeNull();
        expect(callEndedMembershipMessage("knock", me, me)).toBeNull();
    });
});

describe("identityToUserId / usersFromIdentities", () => {
    it("strips the device suffix from an identity", () => {
        expect(identityToUserId("@alice:example.org:DEVABC")).toBe(
            "@alice:example.org",
        );
    });
    it("collapses multiple devices of one user to a single user id", () => {
        const users = usersFromIdentities([
            "@alice:example.org:DEV1",
            "@alice:example.org:DEV2",
            "@bob:example.org:DEV9",
        ]);
        expect(users).toEqual(
            new Set(["@alice:example.org", "@bob:example.org"]),
        );
    });
    it("is empty for no identities", () => {
        expect(usersFromIdentities([])).toEqual(new Set());
    });
});

describe("callBannerDecision", () => {
    const me = "@me:s";

    it("shows Leave while in a call with others", () => {
        expect(
            callBannerDecision({
                inThisCall: true,
                participantUserIds: [me, "@a:s"],
                selfUserId: me,
            }),
        ).toEqual({ visible: true, action: "leave" });
    });

    it("shows Leave while in a call alone (ringing out / solo host)", () => {
        expect(
            callBannerDecision({
                inThisCall: true,
                participantUserIds: [me],
                selfUserId: me,
            }),
        ).toEqual({ visible: true, action: "leave" });
    });

    it("shows Join when someone else is in a call we are not in", () => {
        expect(
            callBannerDecision({
                inThisCall: false,
                participantUserIds: [me, "@a:s"],
                selfUserId: me,
            }),
        ).toEqual({ visible: true, action: "join" });
    });

    it("shows Join when another user is alone in a call we started watching", () => {
        expect(
            callBannerDecision({
                inThisCall: false,
                participantUserIds: ["@a:s"],
                selfUserId: me,
            }),
        ).toEqual({ visible: true, action: "join" });
    });

    it("hides when the roster is empty and we are not in the call", () => {
        expect(
            callBannerDecision({
                inThisCall: false,
                participantUserIds: [],
                selfUserId: me,
            }),
        ).toEqual({ visible: false, action: null });
    });

    // The bug this item fixes: leaving a call we were alone in flips
    // inThisCall false a beat before our own stale membership leaves the
    // roster. That transient state must never render a "Join" banner for a
    // call whose only member is us.
    it("never yields a can-join state on a leave-while-alone transition", () => {
        const decision = callBannerDecision({
            inThisCall: false,
            participantUserIds: [me],
            selfUserId: me,
        });
        expect(decision).toEqual({ visible: false, action: null });
        expect(decision.visible && decision.action === "join").toBe(false);
    });

    it("treats every participant as another user before self is known", () => {
        expect(
            callBannerDecision({
                inThisCall: false,
                participantUserIds: ["@a:s"],
                selfUserId: null,
            }),
        ).toEqual({ visible: true, action: "join" });
    });
});
