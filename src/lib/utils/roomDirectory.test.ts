import { describe, it, expect } from "vitest";
import {
    mapPublicRooms,
    mergeRoomPages,
    normalizeServerInput,
    type DirectoryRoom,
} from "./roomDirectory";

describe("mapPublicRooms — /publicRooms chunk to view entries", () => {
    it("maps a fully-populated entry", () => {
        expect(
            mapPublicRooms([
                {
                    room_id: "!abc:example.org",
                    name: "General",
                    canonical_alias: "#general:example.org",
                    topic: "Chit-chat",
                    avatar_url: "mxc://example.org/media123",
                    num_joined_members: 42,
                    join_rule: "public",
                    world_readable: true,
                },
            ]),
        ).toEqual([
            {
                roomId: "!abc:example.org",
                name: "General",
                alias: "#general:example.org",
                topic: "Chit-chat",
                avatarMxc: "mxc://example.org/media123",
                memberCount: 42,
                joinRule: "public",
                isSpace: false,
            },
        ]);
    });

    it("falls back name → canonical_alias → room_id", () => {
        const [noName, noAlias] = mapPublicRooms([
            {
                room_id: "!a:x.org",
                canonical_alias: "#a:x.org",
                num_joined_members: 1,
            },
            { room_id: "!b:x.org", num_joined_members: 1 },
        ]);
        expect(noName.name).toBe("#a:x.org");
        expect(noAlias.name).toBe("!b:x.org");
    });

    it("defaults absent optional fields (continuwuity omits some)", () => {
        const [room] = mapPublicRooms([{ room_id: "!bare:x.org" }]);
        expect(room).toEqual({
            roomId: "!bare:x.org",
            name: "!bare:x.org",
            alias: null,
            topic: null,
            avatarMxc: null,
            memberCount: 0,
            joinRule: "public",
            isSpace: false,
        });
    });

    it("flags spaces via room_type and keeps knock join rules", () => {
        const [space, knock] = mapPublicRooms([
            {
                room_id: "!s:x.org",
                room_type: "m.space",
                num_joined_members: 3,
            },
            { room_id: "!k:x.org", join_rule: "knock", num_joined_members: 2 },
        ]);
        expect(space.isSpace).toBe(true);
        expect(knock.isSpace).toBe(false);
        expect(knock.joinRule).toBe("knock");
    });

    it("drops junk entries without a room_id", () => {
        expect(
            mapPublicRooms([
                { room_id: "" },
                { room_id: undefined } as never,
                { room_id: "!ok:x.org" },
            ]),
        ).toHaveLength(1);
    });
});

describe("mergeRoomPages — paginated results without duplicates", () => {
    const entry = (roomId: string): DirectoryRoom => ({
        roomId,
        name: roomId,
        alias: null,
        topic: null,
        avatarMxc: null,
        memberCount: 0,
        joinRule: "public",
        isSpace: false,
    });

    it("appends a next page after the existing entries", () => {
        const merged = mergeRoomPages(
            [entry("!a:x"), entry("!b:x")],
            [entry("!c:x")],
        );
        expect(merged.map((r) => r.roomId)).toEqual(["!a:x", "!b:x", "!c:x"]);
    });

    it("dedupes by roomId, keeping the first occurrence", () => {
        const first = { ...entry("!a:x"), name: "kept" };
        const dupe = { ...entry("!a:x"), name: "dropped" };
        const merged = mergeRoomPages([first], [dupe, entry("!b:x")]);
        expect(merged).toHaveLength(2);
        expect(merged[0].name).toBe("kept");
    });

    it("handles the first page (nothing existing)", () => {
        expect(mergeRoomPages([], [entry("!a:x")])).toHaveLength(1);
    });
});

describe("normalizeServerInput — optional 'other server' field", () => {
    it("passes a plain server name through, trimmed", () => {
        expect(normalizeServerInput("  matrix.org ")).toBe("matrix.org");
    });

    it("returns undefined for empty or whitespace input", () => {
        expect(normalizeServerInput("")).toBeUndefined();
        expect(normalizeServerInput("   ")).toBeUndefined();
    });

    it("strips a pasted scheme and any path", () => {
        expect(normalizeServerInput("https://matrix.org/")).toBe("matrix.org");
        expect(normalizeServerInput("http://matrix.org/_matrix/foo")).toBe(
            "matrix.org",
        );
    });

    it("keeps an explicit port", () => {
        expect(normalizeServerInput("matrix.org:8448")).toBe("matrix.org:8448");
    });
});
