import { describe, it, expect } from "vitest";
import {
    countVoiceParticipants,
    summarizeVoice,
    type LiveShareInfo,
    type VoiceRoomInput,
} from "./spaceVoice";

const NO_SHARE: LiveShareInfo = { roomId: null, userIds: new Set() };

function person(userId: string, name = userId) {
    return { userId, name, avatar: null };
}

function room(roomId: string, name: string, userIds: string[]): VoiceRoomInput {
    return { roomId, name, participants: userIds.map((u) => person(u)) };
}

describe("summarizeVoice", () => {
    it("is inactive for no rooms", () => {
        expect(summarizeVoice([], NO_SHARE)).toEqual({
            active: false,
            live: false,
            rooms: [],
        });
    });

    it("drops rooms with no participants", () => {
        const s = summarizeVoice(
            [room("!a", "empty", []), room("!b", "busy", ["@x"])],
            NO_SHARE,
        );
        expect(s.active).toBe(true);
        expect(s.rooms.map((r) => r.roomId)).toEqual(["!b"]);
    });

    it("is inactive when every room is empty", () => {
        const s = summarizeVoice([room("!a", "empty", [])], NO_SHARE);
        expect(s.active).toBe(false);
        expect(s.rooms).toEqual([]);
    });

    it("never marks anyone live without a share", () => {
        const s = summarizeVoice([room("!a", "a", ["@x"])], NO_SHARE);
        expect(s.live).toBe(false);
        expect(s.rooms[0].participants[0].live).toBe(false);
    });

    it("marks only the participant sharing in the device's own call room", () => {
        const share: LiveShareInfo = {
            roomId: "!a",
            userIds: new Set(["@x"]),
        };
        const s = summarizeVoice(
            [room("!a", "a", ["@x", "@y"]), room("!b", "b", ["@x"])],
            share,
        );
        const a = s.rooms.find((r) => r.roomId === "!a")!;
        const b = s.rooms.find((r) => r.roomId === "!b")!;
        expect(a.participants.find((p) => p.userId === "@x")!.live).toBe(true);
        expect(a.participants.find((p) => p.userId === "@y")!.live).toBe(false);
        // Same user in another room is not sharing there as far as we know.
        expect(b.participants[0].live).toBe(false);
        expect(s.live).toBe(true);
    });

    it("ignores a share set when the device is in a different room", () => {
        const share: LiveShareInfo = {
            roomId: "!other",
            userIds: new Set(["@x"]),
        };
        const s = summarizeVoice([room("!a", "a", ["@x"])], share);
        expect(s.live).toBe(false);
    });

    it("sorts live rooms first, then busiest, then by name", () => {
        const share: LiveShareInfo = {
            roomId: "!quiet",
            userIds: new Set(["@solo"]),
        };
        const s = summarizeVoice(
            [
                room("!zeta", "Zeta", ["@1", "@2", "@3"]),
                room("!alpha", "Alpha", ["@4", "@5", "@6"]),
                room("!beta", "beta", ["@7"]),
                room("!quiet", "Quiet", ["@solo"]),
            ],
            share,
        );
        expect(s.rooms.map((r) => r.roomId)).toEqual([
            "!quiet",
            "!alpha",
            "!zeta",
            "!beta",
        ]);
    });

    it("puts live participants first within a room, keeping join order otherwise", () => {
        const share: LiveShareInfo = {
            roomId: "!a",
            userIds: new Set(["@late"]),
        };
        const s = summarizeVoice(
            [room("!a", "a", ["@early", "@mid", "@late"])],
            share,
        );
        expect(s.rooms[0].participants.map((p) => p.userId)).toEqual([
            "@late",
            "@early",
            "@mid",
        ]);
    });

    it("dedupes repeated rooms and repeated participants", () => {
        const s = summarizeVoice(
            [room("!a", "a", ["@x", "@x"]), room("!a", "a again", ["@y"])],
            NO_SHARE,
        );
        expect(s.rooms).toHaveLength(1);
        expect(s.rooms[0].name).toBe("a");
        expect(s.rooms[0].participants.map((p) => p.userId)).toEqual(["@x"]);
    });

    it("carries names and avatars through", () => {
        const s = summarizeVoice(
            [
                {
                    roomId: "!a",
                    name: "General",
                    participants: [
                        { userId: "@x", name: "Xan", avatar: "https://a/b" },
                    ],
                },
            ],
            NO_SHARE,
        );
        expect(s.rooms[0].name).toBe("General");
        expect(s.rooms[0].participants[0]).toEqual({
            userId: "@x",
            name: "Xan",
            avatar: "https://a/b",
            live: false,
        });
    });
});

describe("countVoiceParticipants", () => {
    it("counts distinct people across rooms", () => {
        const s = summarizeVoice(
            [room("!a", "a", ["@x", "@y"]), room("!b", "b", ["@y", "@z"])],
            NO_SHARE,
        );
        expect(countVoiceParticipants(s)).toBe(3);
    });

    it("is zero for an inactive summary", () => {
        expect(countVoiceParticipants(summarizeVoice([], NO_SHARE))).toBe(0);
    });
});
